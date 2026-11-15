import type {Cable,Device,DeviceStatus,PoEStatus,Project,SimResult,LabEvent,Point} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {activeCableGraph,duplicateIPs,ipv4,pathThroughSwitches,sameSubnet,validMask} from './network.js';
import {visible} from './geometry.js';
const isCamera=(d:Device)=>profile(d.profileId).kind==='camera';
const isSwitch=(d:Device)=>profile(d.profileId).kind==='switch';
const isNvr=(d:Device)=>profile(d.profileId).kind==='nvr';
const issue=(s:DeviceStatus,message:string)=>{if(!s.faults.includes(message))s.faults.push(message);};
export function simulate(project:Project):SimResult {
 const devices=project.devices,byId=new Map(devices.map(d=>[d.id,d]));
 const statuses:Record<string,DeviceStatus>={}, cableStatuses:SimResult['cables']={}, poe:Record<string,PoEStatus>={};
 for(const d of devices)statuses[d.id]={id:d.id,powered:false,connected:false,networkOk:false,recordingReady:false,faults:[]};
 const usable=new Set<string>();
 const portUsage=new Map<string,number>();
 // Physical links are separately evaluated: a connected cable is not automatically a usable Ethernet path.
 for(const c of project.cables){
  let reason='';if(!byId.has(c.a)||!byId.has(c.b)||c.a===c.b)reason='Invalid cable endpoint';
  else if(!c.connected)reason='Cable disconnected';
  else if(!(c.lengthMeters>0)||c.lengthMeters>100)reason='Cable exceeds 100m Ethernet length or has invalid length';
  else if(c.a===c.b)reason='Self-link unsupported';
  else if(c.a&&c.b){
   const a=byId.get(c.a)!,b=byId.get(c.b)!;
   if(!isSwitch(a)&&!isSwitch(b))reason='Endpoints require a switching device';
  }
  if(!reason){
   const overflow=[c.a,c.b].some(id=>{
    const d=byId.get(id)!;return (portUsage.get(id)||0)>=profile(d.profileId).ethernetPorts;
   });
   if(overflow)reason='Ethernet port capacity exceeded';
   else {portUsage.set(c.a,(portUsage.get(c.a)||0)+1);portUsage.set(c.b,(portUsage.get(c.b)||0)+1);usable.add(c.id);}
  }
  cableStatuses[c.id]={id:c.id,up:false,reason:reason||'Physical cable ready'};
 }
 const powered=new Set<string>();
 for(const d of devices){
  if((isSwitch(d)||isNvr(d))&&d.enabled&&project.mainsOn){powered.add(d.id);statuses[d.id].powered=true;}
  else if((isSwitch(d)||isNvr(d))&&!d.enabled)issue(statuses[d.id],'Equipment powered off');
  else if((isSwitch(d)||isNvr(d))&&!project.mainsOn)issue(statuses[d.id],'Mains failure (no backup fitted)');
 }
 // Deterministic PoE allocation. Camera power is not implied by a data connection.
 for(const sw of devices.filter(isSwitch)){
  const spec=profile(sw.profileId);const budget=Number.isFinite(sw.poeBudgetW)?Math.max(0,sw.poeBudgetW!):spec.poeBudgetW;
  const record:PoEStatus={id:sw.id,budgetW:budget,consumedW:0,allocatedCount:0,deniedIds:[]};poe[sw.id]=record;
  const links=project.cables.filter(c=>usable.has(c.id)&&(c.a===sw.id||c.b===sw.id));
  const cameraLinks=links.map(c=>byId.get(c.a===sw.id?c.b:c.a)!).filter(isCamera);
  for(const cam of cameraLinks){
   const need=profile(cam.profileId).powerW;
   if(!powered.has(sw.id)||!cam.enabled)continue;
   if(powered.has(cam.id))continue;
   if(record.allocatedCount>=spec.poePorts||need>spec.maxPortW||record.consumedW+need>budget+1e-9){
    if(!record.deniedIds.includes(cam.id))record.deniedIds.push(cam.id);continue;
   }
   record.allocatedCount++;record.consumedW+=need;powered.add(cam.id);statuses[cam.id].powered=true;statuses[cam.id].poeSourceId=sw.id;
  }
  if(record.deniedIds.length)issue(statuses[sw.id],`PoE allocation denied for ${record.deniedIds.length} camera(s)`);
 }
 const duplicate=duplicateIPs(devices,powered);
 for(const d of devices){
  const s=statuses[d.id];
  if(!s.powered&&isCamera(d))issue(s,d.enabled?'No usable PoE supply':'Camera disabled');
  s.connected=project.cables.some(c=>usable.has(c.id)&&(c.a===d.id||c.b===d.id));
  if(!s.connected)issue(s,'No usable Ethernet cable');
  if(!isSwitch(d)){
   if(ipv4(d.ip)===undefined||!validMask(d.mask))issue(s,'Invalid IP address or subnet mask');
   if(duplicate.has(d.id))issue(s,'Duplicate IP address');
  }
 }
 for(const c of project.cables){
  if(usable.has(c.id)&&powered.has(c.a)&&powered.has(c.b)){cableStatuses[c.id]={id:c.id,up:true,reason:'Link up'};}
  else if(usable.has(c.id)){cableStatuses[c.id]={id:c.id,up:false,reason:'One or both endpoints unpowered'};}
 }
 const graph=activeCableGraph(devices,project.cables,powered,new Set(project.cables.filter(c=>!cableStatuses[c.id]?.up).map(c=>c.id)));
 const nvrs=devices.filter(isNvr);
 const allocations=new Map<string,number>();
 for(const d of devices.filter(isCamera)){
  const s=statuses[d.id];if(!s.powered||!s.connected||duplicate.has(d.id)||ipv4(d.ip)===undefined||!validMask(d.mask))continue;
  let routeFound=false;
  for(const nvr of nvrs){
   const ns=statuses[nvr.id];if(!ns.powered||!ns.connected||duplicate.has(nvr.id)||ipv4(nvr.ip)===undefined||!validMask(nvr.mask))continue;
   if(!pathThroughSwitches(d.id,nvr.id,graph,devices)||!sameSubnet(d,nvr))continue;
   routeFound=true;s.networkOk=true;
   if(!d.recordingEnabled)break;
   if((nvr.usedGB||0)>=(nvr.storageGB||profile(nvr.profileId).defaultStorageGB))continue;
   const num=allocations.get(nvr.id)||0;if(num>=profile(nvr.profileId).nvrChannels)continue;
   allocations.set(nvr.id,num+1);s.recordingReady=true;s.recorderId=nvr.id;break;
  }
  if(!routeFound)issue(s,'No reachable NVR on matching IP subnet');
  else if(!s.recordingReady)issue(s,d.recordingEnabled?'Recorder storage/channel unavailable':'Recording disabled');
 }
 for(const nvr of nvrs){
  const s=statuses[nvr.id];s.networkOk=s.powered&&s.connected&&!duplicate.has(nvr.id)&&ipv4(nvr.ip)!==undefined&&validMask(nvr.mask);
  if(s.powered&&(nvr.usedGB||0)>=(nvr.storageGB||profile(nvr.profileId).defaultStorageGB))issue(s,'Recording storage full');
 }
 for(const sw of devices.filter(isSwitch)){statuses[sw.id].networkOk=statuses[sw.id].powered&&statuses[sw.id].connected;}
 const coverage=project.targets.map(t=>{
  const cameraIds=devices.filter(isCamera).filter(d=>statuses[d.id].powered&&statuses[d.id].networkOk&&visible(d,t,project.walls,project.night)).map(d=>d.id);
  return {id:t.id,name:t.name,covered:cameraIds.length>0,cameraIds};
 });
 const issues=[...Object.values(statuses).flatMap(s=>s.faults.map(f=>`${byId.get(s.id)?.name||s.id}: ${f}`)),
  ...project.cables.filter(c=>!cableStatuses[c.id].up).map(c=>`Cable ${c.id.slice(-5)}: ${cableStatuses[c.id].reason}`),
  ...coverage.filter(t=>!t.covered).map(t=>`Uncovered objective: ${t.name}`)];
 return {devices:statuses,cables:cableStatuses,poe,coverage,issues,
  onlineCameras:devices.filter(isCamera).filter(d=>statuses[d.id].powered&&statuses[d.id].networkOk).length,
  recordingCameras:devices.filter(isCamera).filter(d=>statuses[d.id].recordingReady).length,
  requiredCameras:devices.filter(isCamera).length,
  budgetUsedGhs:devices.reduce((sum,d)=>sum+profile(d.profileId).costGhs,0),budgetGhs:0};
}
export function triggerMotion(project:Project,point:Point,at:string=new Date().toISOString()):{project:Project;detected:number;recorded:number}{
 const result=simulate(project);const triggered=project.devices.filter(d=>isCamera(d)&&d.motionEnabled&&result.devices[d.id].powered&&result.devices[d.id].networkOk&&visible(d,point,project.walls,project.night));
 const events:LabEvent[]=[];let recorded=0;
 if(triggered.length===0)events.push({id:`evt-${project.events.length}`,at,kind:'warning',message:'Movement not detected: no operational camera covers this point',x:point.x,y:point.y,recorded:false});
 for(const d of triggered){
  const ready=result.devices[d.id].recordingReady;
  events.push({id:`evt-${project.events.length+events.length}`,at,kind:ready?'recorded':'motion',message:`${d.name} detected movement${ready?' — NVR clip stored':' — no recording path'}`,x:point.x,y:point.y,deviceId:d.id,recorded:ready});
  if(ready)recorded++;
 }
 const devices=project.devices.map(d=>{
  const count=events.filter(e=>e.recorded&&result.devices[e.deviceId||'']?.recorderId===d.id).length;
  return count?{...d,usedGB:Math.min(d.storageGB||0,(d.usedGB||0)+count*0.01)}:d;
 });
 return {project:{...project,devices,events:[...project.events,...events].slice(-250),updatedAt:at},detected:triggered.length,recorded};
}
export function injectFault(project:Project,kind:string):{project:Project;message:string}{
 const cameras=project.devices.filter(isCamera),switches=project.devices.filter(isSwitch),nvrs=project.devices.filter(isNvr);
 const first=cameras[0],second=cameras[1],sw=switches[0],nvr=nvrs[0];
 let next=project;let message='The required equipment is not installed for this fault.';
 switch(kind){
  case 'disconnect':{
   const c=project.cables.find(c=>c.connected&&(first?(c.a===first.id||c.b===first.id):true));
   if(c){next={...project,cables:project.cables.map(x=>x.id===c.id?{...x,connected:false}:x)};message='A camera Ethernet cable was disconnected.';}break;
  }
  case 'ipconflict':if(first&&second){next={...project,devices:project.devices.map(d=>d.id===second.id?{...d,ip:first.ip}:d)};message=`${second.name} now shares an IP address with ${first.name}.`;}break;
  case 'badsubnet':if(first){next={...project,devices:project.devices.map(d=>d.id===first.id?{...d,mask:'255.255.0.0'}:d)};message=`${first.name} has an incompatible subnet mask.`;}break;
  case 'lowpoe':if(sw){next={...project,devices:project.devices.map(d=>d.id===sw.id?{...d,poeBudgetW:1}:d)};message=`${sw.name} PoE budget reduced to 1 W.`;}break;
  case 'power':if(sw){next={...project,devices:project.devices.map(d=>d.id===sw.id?{...d,enabled:false}:d)};message=`${sw.name} is powered off.`;}break;
  case 'storage':if(nvr){next={...project,devices:project.devices.map(d=>d.id===nvr.id?{...d,usedGB:d.storageGB}:d)};message=`${nvr.name} recording storage is full.`;}break;
  case 'orientation':if(first){next={...project,devices:project.devices.map(d=>d.id===first.id?{...d,heading:(d.heading+180)%360}:d)};message=`${first.name} was rotated away from its target.`;}break;
 }
 if(next!==project){const event:LabEvent={id:`evt-${project.events.length}`,at:new Date().toISOString(),kind:'fault',message,recorded:false};next={...next,events:[...next.events,event].slice(-250)};}
 return {project:next,message};
}
