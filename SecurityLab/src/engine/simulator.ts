import {wallsOnFloor,cableRiseM} from '../tools/floors.js';
import {applyEnvironment,adjustDevice} from './environment.js';
import type {Cable,Device,DeviceStatus,PoEStatus,Project,SimResult,LabEvent,Point,RecorderStatus,RecordingClip} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {manufacturerVideoCompatible} from '../domain/manufacturers/index.js';
import {evaluateNetwork} from './networking.js';
import {evaluateAlarms} from './alarm.js';
import {evaluateAccess} from './access.js';
import {evaluatePower,isPowerDevice,isPowerCable} from './power.js';
import {visible} from './geometry.js';
import {bitrateOf,clockOf, gigabytesFor,insideMotionZone,isCamera,isRecorder,mediumOf,motionThresholdMet,recordingActive,modeOf,recorderBandwidth,signalOf,supportedResolution,powerDrawOf} from './cctv.js';

const isSwitch=(d:Device)=>profile(d.profileId).kind==='switch';
const networkInfrastructure=(d:Device)=>['switch','router','ap'].includes(profile(d.profileId).kind);
const isNvr=(d:Device)=>profile(d.profileId).kind==='nvr';
const isDvr=(d:Device)=>profile(d.profileId).kind==='dvr';
const issue=(s:DeviceStatus,message:string)=>{if(!s.faults.includes(message))s.faults.push(message);};
const storageOf=(d:Device)=>Math.max(0,d.storageGB??profile(d.profileId).defaultStorageGB);
const usedOf=(d:Device)=>Math.max(0,d.usedGB||0);
const compare=(a:Device,b:Device)=>a.id.localeCompare(b.id);
const incident=(project:Project,at:string,kind:LabEvent['kind'],message:string,point?:Point,cameraId?:string,recorded=false):LabEvent=>({id:`evt-${crypto.randomUUID()}`,at,kind,message,recorded,...(point?{x:point.x,y:point.y}:{}),...(cameraId?{deviceId:cameraId}:{})});

/** Stateless source-of-truth derivation: project inputs alone determine the technical state. */
export function simulate(projectInput:Project):SimResult {
 const project=applyEnvironment(projectInput);
 const devices=project.devices,byId=new Map(devices.map(d=>[d.id,d]));
 const power=evaluatePower(project),strictPower=power.mode==='wired';
 const statuses:Record<string,DeviceStatus>={},cableStatuses:SimResult['cables']={},poe:Record<string,PoEStatus>={},recorders:Record<string,RecorderStatus>={};
 const usableEthernet=new Set<string>(),usableCoax=new Set<string>();
 const ethernetUsage=new Map<string,number>(),coaxUsage=new Map<string,number>();
 const cableList=[...project.cables].sort((a,b)=>a.id.localeCompare(b.id));
 // Derive actual occupied virtual ports before allocating PoE. Stage 9 must not treat
 // every switch Ethernet port as a PoE output (e.g. TP-Link 4 PoE + 1 uplink).
 const assignedPorts=new Map<string,number>();
 const occupiedPorts=new Map<string,Set<number>>();
 const portUsed=(id:string)=>{if(!occupiedPorts.has(id))occupiedPorts.set(id,new Set<number>());return occupiedPorts.get(id)!;};
 const assignPhysicalPort=(device:Device,requested:number|undefined,cableId:string)=>{
  const used=portUsed(device.id),max=profile(device.profileId).ethernetPorts;
  const port=requested??Array.from({length:max},(_,n)=>n+1).find(n=>!used.has(n))??0;
  if(!Number.isInteger(port)||port<1||port>max||used.has(port))return 0;
  used.add(port);assignedPorts.set(`${cableId}:${device.id}`,port);return port;
 };
 // Respect user-assigned physical ports first, then reserve PoE-capable ports for
 // camera leads before filling ordinary uplinks. Never let random UUID ordering
 // put the fourth camera on a non-PoE uplink simply because the NVR was visited first.
 const autoPortPriority=(c:Cable):number=>{
  if(c.aPort!==undefined||c.bPort!==undefined)return 0;
  const a=byId.get(c.a),b=byId.get(c.b);
  return a&&b&&((isSwitch(a)&&isCamera(b)&&signalOf(b)==='ip')||(isSwitch(b)&&isCamera(a)&&signalOf(a)==='ip'))?1:2;
 };
 for(const c of cableList.filter(c=>(c.medium??'ethernet')==='ethernet'&&c.connected)
  .sort((a,b)=>autoPortPriority(a)-autoPortPriority(b)||a.id.localeCompare(b.id))){
  const a=byId.get(c.a),b=byId.get(c.b);if(!a||!b)continue;
  assignPhysicalPort(a,c.aPort,c.id);assignPhysicalPort(b,c.bPort,c.id);
 }

 for(const d of devices){statuses[d.id]={id:d.id,powered:false,connected:false,networkOk:false,recordingReady:false,faults:[],...(isCamera(d)?{signal:signalOf(d)}:{})};}
 // Link media, topology, physical length, and port count are enforced before power or IP checks.
 for(const c of cableList){
  const a=byId.get(c.a),b=byId.get(c.b),medium=mediumOf(c);
  if(medium==='alarm'||medium==='access'||isPowerCable(c))continue; // Dedicated circuit engines handle non-Ethernet wiring.
  let reason='';
  if(!a||!b||c.a===c.b)reason='Invalid cable endpoint';
  else if(!c.connected)reason='Cable disconnected';
  else if(!Number.isFinite(c.lengthMeters)||c.lengthMeters<=0||c.lengthMeters+cableRiseM(a,b)>(medium==='coax'?300:100))reason=`${medium==='coax'?'Coaxial':'Ethernet'} run exceeds simulated maximum length`;
  else if(medium==='coax'){
   const cam=isCamera(a)?a:isCamera(b)?b:null,rec=isDvr(a)?a:isDvr(b)?b:null;
   if(!cam||!rec||signalOf(cam)!=='analog')reason='Coax is supported only between an analog camera and a DVR';
   else if((coaxUsage.get(rec.id)||0)>=(profile(rec.profileId).coaxInputs||0))reason='DVR coaxial input capacity exceeded';
   else if((coaxUsage.get(cam.id)||0)>=1)reason='Analog camera coaxial video output already in use';
   else {coaxUsage.set(rec.id,(coaxUsage.get(rec.id)||0)+1);coaxUsage.set(cam.id,1);usableCoax.add(c.id);}
  }else{
   if((isCamera(a)&&signalOf(a)==='analog')||(isCamera(b)&&signalOf(b)==='analog'))reason='Analog camera requires coaxial video cable to a DVR';
   else if(!networkInfrastructure(a)&&!networkInfrastructure(b))reason='Ethernet endpoints require a switch, access point or router';
   else if(!assignedPorts.has(`${c.id}:${a.id}`)||!assignedPorts.has(`${c.id}:${b.id}`))reason='Ethernet port unassigned, occupied or out of range';
   else if((ethernetUsage.get(a.id)||0)>=profile(a.profileId).ethernetPorts||(ethernetUsage.get(b.id)||0)>=profile(b.profileId).ethernetPorts)reason='Ethernet port capacity exceeded';
   else {ethernetUsage.set(a.id,(ethernetUsage.get(a.id)||0)+1);ethernetUsage.set(b.id,(ethernetUsage.get(b.id)||0)+1);usableEthernet.add(c.id);}
  }
  cableStatuses[c.id]={id:c.id,up:false,reason:reason||`${medium==='coax'?'Coaxial':'Ethernet'} physical cable ready`};
 }
 const powered=new Set<string>();
 for(const d of devices){
  const s=statuses[d.id];
  if(profile(d.profileId).kind.startsWith('alarm-')||profile(d.profileId).kind.startsWith('access-'))continue;
  if(isPowerDevice(d)){
   if(power.devices[d.id]?.powered){powered.add(d.id);s.powered=true;}
   else if(strictPower)issue(s,power.devices[d.id]?.faults[0]||'Electrical supply unavailable');
   continue;
  }
  const hasSupply=strictPower?!!power.devices[d.id]?.powered:project.mainsOn;
  if((!isCamera(d)||profile(d.profileId).wirelessCapable)&&d.enabled&&hasSupply){powered.add(d.id);s.powered=true;}
  else if((!isCamera(d)||profile(d.profileId).wirelessCapable)&&!d.enabled)issue(s,'Equipment powered off');
  else if((!isCamera(d)||profile(d.profileId).wirelessCapable)&&!hasSupply)issue(s,strictPower?'No powered electrical circuit':'Mains failure (no backup fitted)');
  if(isCamera(d)&&signalOf(d)==='analog'){
   if(d.enabled&&hasSupply&&d.analogPowerConnected!==false){powered.add(d.id);s.powered=true;}
   else issue(s,!d.enabled?'Camera disabled':!hasSupply?(strictPower?'No 12 V DC supply':'Mains failure (analog adapter has no backup)'):'Analog 12 V DC adapter disconnected');
  }
 }
 // Deterministic switch/camera ordering ensures reproducible PoE allocation.
 for(const sw of devices.filter(isSwitch).sort(compare)){
  const spec=profile(sw.profileId);const requestedBudget=Number.isFinite(sw.poeBudgetW)?Math.max(0,sw.poeBudgetW!):spec.poeBudgetW;const budget=spec.manufacturerSpec?Math.min(requestedBudget,spec.poeBudgetW):requestedBudget;
  const entry:PoEStatus={id:sw.id,budgetW:budget,consumedW:0,allocatedCount:0,deniedIds:[]};poe[sw.id]=entry;
  const cameras=cableList.filter(c=>usableEthernet.has(c.id)&&(c.a===sw.id||c.b===sw.id))
   .map(c=>byId.get(c.a===sw.id?c.b:c.a)!).filter(d=>isCamera(d)&&signalOf(d)==='ip').sort(compare);
  for(const cam of cameras){
   if(!powered.has(sw.id)||!cam.enabled||powered.has(cam.id))continue;
   const link=cableList.find(c=>usableEthernet.has(c.id)&&((c.a===sw.id&&c.b===cam.id)||(c.b===sw.id&&c.a===cam.id)));
   const swPort=link?assignedPorts.get(`${link.id}:${sw.id}`):undefined;
   const eligible=spec.manufacturerSpec?.poePortNumbers??Array.from({length:spec.poePorts},(_,n)=>n+1);
   if(swPort===undefined||!eligible.includes(swPort)){
    entry.deniedIds.push(cam.id);issue(statuses[cam.id],`PoE unavailable on virtual switch port ${swPort??'unassigned'} (only ${eligible.join(', ')||'no'} PoE ports)`);continue;
   }
   const need=powerDrawOf(cam,project.night);
   if(entry.allocatedCount>=spec.poePorts||need>spec.maxPortW||entry.consumedW+need>budget+1e-9){entry.deniedIds.push(cam.id);continue;}
   entry.consumedW+=need;entry.allocatedCount++;powered.add(cam.id);statuses[cam.id].powered=true;statuses[cam.id].poeSourceId=sw.id;
  }
 }
 for(const entry of Object.values(poe)){
  entry.deniedIds=entry.deniedIds.filter(id=>!powered.has(id));
  if(entry.deniedIds.length)issue(statuses[entry.id],`PoE allocation denied for ${entry.deniedIds.length} camera(s)`);
 }
 for(const d of devices){
  const s=statuses[d.id];
  if(profile(d.profileId).kind.startsWith('alarm-')||profile(d.profileId).kind.startsWith('access-'))continue;
  if(isPowerDevice(d)){
   if(power.devices[d.id]?.powered){powered.add(d.id);s.powered=true;}
   else if(strictPower)issue(s,power.devices[d.id]?.faults[0]||'Electrical supply unavailable');
   continue;
  }
  const hasSupply=strictPower?!!power.devices[d.id]?.powered:project.mainsOn;
  if(isCamera(d)&&signalOf(d)==='ip'&&!s.powered)issue(s,d.enabled?(profile(d.profileId).wirelessCapable?'Wireless camera has no DC power':'No usable PoE supply'):'Camera disabled');
  s.connected=project.cables.some(c=>(usableEthernet.has(c.id)||usableCoax.has(c.id))&&(c.a===d.id||c.b===d.id));
  if(!s.connected&&!profile(d.profileId).wirelessCapable)issue(s,isCamera(d)&&signalOf(d)==='analog'?'No usable coaxial video cable':'No usable Ethernet cable');

 }
 for(const c of cableList){
  if(usableEthernet.has(c.id)||usableCoax.has(c.id)){
   const medium=mediumOf(c);
   const up=powered.has(c.a)&&powered.has(c.b);
   cableStatuses[c.id]={id:c.id,up,reason:up?`${medium==='coax'?'Coaxial video':'Ethernet'} link up`:'One or both endpoints unpowered'};
  }
 }
 const upCables=new Set(project.cables.filter(c=>mediumOf(c)==='ethernet'&&cableStatuses[c.id]?.up).map(c=>c.id));
 const net=evaluateNetwork(project,upCables,powered);
 for(const d of devices){
  const s=statuses[d.id],addr=net.snapshot.addresses[d.id];
  if(s.powered&&addr)for(const f of addr.faults)issue(s,f);
  if(profile(d.profileId).wirelessCapable){
   const assoc=net.snapshot.wireless[d.id];s.connected=!!assoc?.connected;
   if(s.powered&&!s.connected)issue(s,assoc?.reason||'Wireless not associated');
  }
  if(['router','ap','server'].includes(profile(d.profileId).kind)){
   s.connected=project.cables.some(c=>(c.a===d.id||c.b===d.id)&&net.snapshot.links[c.id]&&net.snapshot.links[c.id].vlans.length>0);
   s.networkOk=s.powered&&s.connected&&!(addr?.faults.some(f=>f.includes('Invalid')||f.includes('Duplicate')||f.includes('DHCP')));
  }
 }
 for(const c of project.cables){
  const link=net.snapshot.links[c.id];
  if(link?.faults.length){cableStatuses[c.id]={id:c.id,up:false,reason:link.faults.join('; ')};}
 }
 const recs=devices.filter(isRecorder).sort(compare);
 for(const recorder of recs){
  const spec=profile(recorder.profileId);const total=storageOf(recorder),used=usedOf(recorder);
  recorders[recorder.id]={id:recorder.id,channelsTotal:spec.nvrChannels,channelsUsed:0,bandwidthLimitMbps:recorderBandwidth(recorder),bandwidthUsedMbps:0,storageGB:total,usedGB:used,freeGB:Math.max(0,total-used),estimatedRetentionHours:0,cameras:[],faults:[]};
  if(spec.manufacturerSpec&&spec.maxInstalledStorageGB&&total>spec.maxInstalledStorageGB)issue(statuses[recorder.id],`Installed disk capacity ${total} GB exceeds model limit ${spec.maxInstalledStorageGB} GB`);
  if(recorder.storageFailed)issue(statuses[recorder.id],'Recorder storage drive failure');
  if(total<=0)issue(statuses[recorder.id],'No storage installed');
  if(used>=total)issue(statuses[recorder.id],'Recording storage full');
  statuses[recorder.id].networkOk=statuses[recorder.id].powered&&statuses[recorder.id].connected&&
   (isDvr(recorder)||!!(net.snapshot.addresses[recorder.id]?.ip&&net.snapshot.addresses[recorder.id]?.faults.length===0));
 }
 for(const sw of devices.filter(isSwitch))statuses[sw.id].networkOk=statuses[sw.id].powered&&statuses[sw.id].connected;
 // Network/video availability is independent of available recording channels or free disk.
 for(const cam of devices.filter(isCamera).sort(compare)){
  const s=statuses[cam.id],signal=signalOf(cam),rate=bitrateOf(cam);
  s.streamMbps=rate;s.scheduleActive=recordingActive(cam,project);
  if(!s.powered||!s.connected)continue;
  if(!supportedResolution(cam)){issue(s,'Requested video resolution exceeds camera sensor capability');continue;}
  const sensorSpec=profile(cam.profileId);if(sensorSpec.manufacturerSpec&&sensorSpec.maxFrameRate&&(cam.frameRate||20)>sensorSpec.maxFrameRate){issue(s,`Configured frame rate exceeds documented ${sensorSpec.maxFrameRate} fps maximum`);continue;}
  const transportReachable=recs.filter(rec=>{
   if(!statuses[rec.id].powered)return false;
   if(signal==='analog')return isDvr(rec)&&project.cables.some(c=>usableCoax.has(c.id)&&cableStatuses[c.id]?.up&&((c.a===cam.id&&c.b===rec.id)||(c.b===cam.id&&c.a===rec.id)));
   return isNvr(rec)&&net.trace(cam.id,rec.id).ok;
  });
  // A common simulated IPv4 route is necessary but not proof of real vendor video interoperability.
  const reachable=transportReachable.filter(rec=>signal==='analog'||manufacturerVideoCompatible(profile(cam.profileId),profile(rec.profileId)).ok);
  if(!reachable.length){
   if(transportReachable.length)issue(s,`Recorder video incompatibility: ${manufacturerVideoCompatible(profile(cam.profileId),profile(transportReachable[0].profileId)).reason}`);
   else {const trace=signal==='ip'?recs.filter(isNvr).map(rec=>net.trace(cam.id,rec.id))[0]:undefined;
    issue(s,signal==='analog'?'No reachable DVR over coaxial video':`No reachable NVR: ${trace?.reason||'IP/VLAN/network path failure'}`);}
   continue;
  }
  s.networkOk=true;
  if(!recordingActive(cam,project)){issue(s,modeOf(cam)==='off'?'Recording disabled':'Recording schedule inactive');continue;}
  let allocated=false;
  for(const rec of reachable){
   const r=recorders[rec.id];
   if(rec.storageFailed||r.freeGB<=0||r.storageGB<=0||!!(profile(rec.profileId).manufacturerSpec&&profile(rec.profileId).maxInstalledStorageGB&&r.storageGB>profile(rec.profileId).maxInstalledStorageGB!))continue;
   if(r.channelsUsed>=r.channelsTotal)continue;
   if(r.bandwidthUsedMbps+rate>r.bandwidthLimitMbps+1e-9)continue;
   if(signal==='ip'&&!net.reserve(net.trace(cam.id,rec.id),rate))continue;
   r.channelsUsed++;r.bandwidthUsedMbps+=rate;r.cameras.push(cam.id);
   s.recorderId=rec.id;s.channel=r.channelsUsed;s.recordingReady=true;allocated=true;break;
  }
  if(!allocated){
   if(reachable.every(rec=>rec.storageFailed||recorders[rec.id].freeGB<=0||recorders[rec.id].storageGB<=0))issue(s,'Recorder storage unavailable');
   else if(reachable.every(rec=>recorders[rec.id].channelsUsed>=recorders[rec.id].channelsTotal))issue(s,'Recorder channel capacity exceeded');
   else issue(s,signal==='ip'?'Network link or recorder incoming bandwidth exceeded':'Recorder incoming bandwidth exceeded');
  }
 }
 for(const r of Object.values(recorders)){
  // Conservative continuous-stream capacity estimate (not a guaranteed retention period).
  r.estimatedRetentionHours=r.bandwidthUsedMbps>0?r.freeGB*8000/r.bandwidthUsedMbps/3600:0;
  r.faults=[...statuses[r.id].faults];
 }
 const coverage=project.targets.map(t=>{
  const cameraIds=devices.filter(isCamera).filter(d=>statuses[d.id].powered&&statuses[d.id].networkOk&&(d.floor??0)===(t.floor??0)&&visible(d,t,wallsOnFloor(project.walls,d.floor??0),project.night)).map(d=>d.id);
  return {id:t.id,name:t.name,covered:cameraIds.length>0,cameraIds};
 });
 const alarm=evaluateAlarms(project,power);
 const access=evaluateAccess(project,power);
 for(const [id,a] of Object.entries(alarm.devices)){if(!statuses[id])continue;statuses[id]={...statuses[id],powered:a.powered,connected:a.wired,networkOk:a.powered&&a.wired,recordingReady:false,faults:a.faults};}
 for(const [id,w] of Object.entries(alarm.wires))cableStatuses[id]={id,up:w.up,reason:w.reason};
 for(const [id,a] of Object.entries(access.devices)){if(!statuses[id])continue;statuses[id]={...statuses[id],powered:a.powered,connected:a.wired,networkOk:a.powered&&a.wired,recordingReady:false,faults:a.faults};}
 for(const [id,w] of Object.entries(access.cables))cableStatuses[id]={id,up:w.up,reason:w.reason};
 for(const [id,w] of Object.entries(power.cables))cableStatuses[id]={id,up:w.up,reason:w.faults.join('; ')||`${w.voltageV} V power line · ${w.watts.toFixed(1)} / ${w.maxWatts.toFixed(1)} W`};
 const issues=[...power.issues,...alarm.issues,...access.issues,...net.snapshot.diagnostics,...Object.values(statuses).filter(s=>!profile(byId.get(s.id)!.profileId).kind.startsWith('alarm-')&&!profile(byId.get(s.id)!.profileId).kind.startsWith('access-')&&!isPowerDevice(byId.get(s.id)!)).flatMap(s=>s.faults.map(f=>`${byId.get(s.id)?.name||s.id}: ${f}`)),
  ...project.cables.filter(c=>mediumOf(c)!=='alarm'&&mediumOf(c)!=='access'&&!isPowerCable(c)&&!cableStatuses[c.id]?.up).map(c=>`Cable ${c.id.slice(-5)}: ${cableStatuses[c.id]?.reason||'Unknown cable'}`),
  ...coverage.filter(t=>!t.covered).map(t=>`Uncovered objective: ${t.name}`)];
 return {power,alarm,access,network:net.snapshot,devices:statuses,cables:cableStatuses,poe,recorders,coverage,issues,
  onlineCameras:devices.filter(isCamera).filter(d=>statuses[d.id].powered&&statuses[d.id].networkOk).length,
  recordingCameras:devices.filter(isCamera).filter(d=>statuses[d.id].recordingReady).length,
  requiredCameras:devices.filter(isCamera).length,
  budgetUsedGhs:devices.reduce((sum,d)=>sum+(profile(d.profileId).manufacturerSpec?(d.unitCostGhs??0):profile(d.profileId).costGhs),0),budgetGhs:0};
}

/** Inject a virtual movement event. Clip records contain metadata, not real video footage. */
export function triggerMotion(project:Project,point:Point,at:string=new Date().toISOString(),intensity=75,floor?:number):{project:Project;detected:number;recorded:number}{
 const result=simulate(project),events:LabEvent[]=[],clips:RecordingClip[]=[];
 let recorded=0;const clock=clockOf(project),storageIncrement=new Map<string,number>();
 const triggered=project.devices.filter(d=>isCamera(d)&&d.motionEnabled&&result.devices[d.id].powered&&result.devices[d.id].networkOk&&
  (floor===undefined||(d.floor??0)===floor)&&visible(adjustDevice(project,d),point,wallsOnFloor(project.walls,d.floor??0),project.night)&&insideMotionZone(d,point)&&motionThresholdMet(d,intensity));
 if(!triggered.length)events.push(incident(project,at,'warning','Movement not detected by any operational camera/active detection zone',point));
 for(const d of triggered){
  const status=result.devices[d.id],ready=status.recordingReady&&!!status.recorderId;
  // Motion-only capture consumes additional simulated disk space. A continuous recording
  // already accounts for its video in advanceRecording; this event is a time marker.
  const clipSeconds=30,bytes=ready&&modeOf(d)!=='continuous'?gigabytesFor(bitrateOf(d),clipSeconds):0;
  const rec=ready?project.devices.find(x=>x.id===status.recorderId):undefined;
  const free=rec?Math.max(0,(rec.storageGB||0)-(rec.usedGB||0)-(storageIncrement.get(rec.id)||0)):0;
  const stored=ready&&!!rec&&free+1e-10>=bytes;
  if(stored&&rec){
   storageIncrement.set(rec.id,(storageIncrement.get(rec.id)||0)+bytes);
   clips.push({id:`clip-${crypto.randomUUID()}`,cameraId:d.id,recorderId:rec.id,at,simulatedDay:clock.day,simulatedMinute:clock.minute,durationSeconds:clipSeconds,sizeGB:bytes,kind:'motion',x:point.x,y:point.y});recorded++;
  }
  events.push(incident(project,at,stored?'recorded':'motion',`${d.name} detected movement${stored?' — simulated event metadata stored':' — video recording unavailable'}`,point,d.id,stored));
 }
 const devices=project.devices.map(d=>storageIncrement.has(d.id)?{...d,usedGB:Math.min(storageOf(d),usedOf(d)+(storageIncrement.get(d.id)||0))}:d);
 return {project:{...project,devices,clips:[...(project.clips||[]),...clips].slice(-500),events:[...project.events,...events].slice(-250),updatedAt:at},detected:triggered.length,recorded};
}

/** Advances a virtual clock and accounts for continuous or scheduled video storage. */
export function advanceRecording(project:Project,minutes:number):Project {
 if(!Number.isSafeInteger(minutes)||minutes<1||minutes>1440)throw new Error('Advance time by 1–1440 whole minutes');
 let next=project;let accrued=0;
 for(let step=0;step<minutes;step++){
  const time=clockOf(next),minute=time.minute+1;
  next={...next,simulationDay:(time.day+(minute>=1440?1:0))%7,simulationMinute:minute%1440};
  const state=simulate(next),increases=new Map<string,number>();
  for(const cam of next.devices.filter(isCamera)){
   const s=state.devices[cam.id];if(!s?.recordingReady||!s.recorderId||modeOf(cam)==='motion')continue;
   increases.set(s.recorderId,(increases.get(s.recorderId)||0)+gigabytesFor(bitrateOf(cam),60));
  }
  next={...next,devices:next.devices.map(d=>{
   if(!isRecorder(d)||!increases.has(d.id))return d;
   const old=usedOf(d),newUse=Math.min(storageOf(d),old+(increases.get(d.id)||0));accrued+=newUse-old;
   return {...d,usedGB:newUse};
  })};
 }
 const at=new Date().toISOString(),event=incident(next,at,'info',`Virtual clock advanced ${minutes} min; ${accrued.toFixed(4)} GB simulated continuous recording added`);
 return {...next,events:[...next.events,event].slice(-250),updatedAt:at};
}

export function injectFault(project:Project,kind:string):{project:Project;message:string}{
 const cameras=project.devices.filter(isCamera),switches=project.devices.filter(isSwitch),recs=project.devices.filter(isRecorder);
 const first=cameras[0],second=cameras[1],sw=switches[0],rec=recs[0];
 let next=project;let message='The required equipment is not installed for this fault.';
 switch(kind){
  case 'disconnect':{
   const c=project.cables.find(c=>c.connected&&(first?(c.a===first.id||c.b===first.id):true));
   if(c){next={...project,cables:project.cables.map(x=>x.id===c.id?{...x,connected:false}:x)};message='Camera video cable disconnected.';}break;
  }
  case 'ipconflict':{
   const ipCameras=cameras.filter(d=>signalOf(d)==='ip');
   if(ipCameras.length>=2){next={...project,devices:project.devices.map(d=>d.id===ipCameras[1].id?{...d,ip:ipCameras[0].ip}:d)};message='Two IP cameras now share an IPv4 address.';}break;
  }
  case 'badsubnet':{
   const ipCam=cameras.find(d=>signalOf(d)==='ip');if(ipCam){next={...project,devices:project.devices.map(d=>d.id===ipCam.id?{...d,mask:'255.255.0.0'}:d)};message='Camera subnet mask changed.';}break;
  }
  case 'lowpoe':if(sw){next={...project,devices:project.devices.map(d=>d.id===sw.id?{...d,poeBudgetW:1}:d)};message='PoE switch power budget reduced to 1 W.';}break;
  case 'power':if(sw||rec){const device=sw||rec!;next={...project,devices:project.devices.map(d=>d.id===device.id?{...d,enabled:false}:d)};message=`${device.name} powered off.`;}break;
  case 'storage':if(rec){next={...project,devices:project.devices.map(d=>d.id===rec.id?{...d,usedGB:storageOf(d)}:d)};message='Recorder storage filled.';}break;
  case 'diskfail':if(rec){next={...project,devices:project.devices.map(d=>d.id===rec.id?{...d,storageFailed:true}:d)};message='Recorder disk fault injected.';}break;
  case 'bandwidth':if(rec){next={...project,devices:project.devices.map(d=>d.id===rec.id?{...d,incomingMbps:0.5}:d)};message='Recorder incoming video bandwidth restricted.';}break;
  case 'dhcp':{
   const client=cameras.find(d=>signalOf(d)==='ip');
   if(client){next={...project,devices:project.devices.map(d=>d.id===client.id?{...d,addressMode:'dhcp',ip:''}:d)};message='Camera requests DHCP; check that a reachable router serves its VLAN.';}break;
  }
  case 'vlan':{
   const client=cameras.find(d=>signalOf(d)==='ip');
   if(client){next={...project,devices:project.devices.map(d=>d.id===client.id?{...d,vlanId:99}:d)};message='Camera placed into the wrong access VLAN.';}break;
  }
  case 'wifi':{
   const client=cameras.find(d=>profile(d.profileId).wirelessCapable);
   if(client){next={...project,devices:project.devices.map(d=>d.id===client.id?{...d,wifiKey:'incorrect-psk'}:d)};message='Wireless camera PSK deliberately mismatched.';}break;
  }
  case 'orientation':if(first){next={...project,devices:project.devices.map(d=>d.id===first.id?{...d,heading:(d.heading+180)%360}:d)};message=`${first.name} turned away from its surveillance target.`;}break;
  case 'coax':{
   const c=project.cables.find(c=>c.connected&&mediumOf(c)==='coax');if(c){next={...project,cables:project.cables.map(v=>v.id===c.id?{...v,connected:false}:v)};message='Analog coax video cable disconnected.';}break;
  }
  case 'nightir':if(first){next={...project,night:true,devices:project.devices.map(d=>d.id===first.id?{...d,infraredEnabled:false}:d)};message='Night conditions enabled and a camera IR illuminator disabled.';}break;
 }
 if(next!==project){const at=new Date().toISOString();next={...next,events:[...next.events,incident(project,at,'fault',message)].slice(-250),updatedAt:at};}
 return {project:next,message};
}
