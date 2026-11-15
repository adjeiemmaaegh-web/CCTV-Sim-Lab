/**
 * SecurityLab Stage 6: offline deterministic *teaching* model of wired alarm circuits.
 * It is not an EN50131-certified panel, a cryptographic keypad, a real bus protocol,
 * an intrusion detection service, or a substitute for manufacturer's installation manuals.
 * State transitions require explicit commands and are saved as part of the project.
 */
import type {AlarmArmMode,AlarmPanelConfig,AlarmPanelStatus,AlarmResult,AlarmRuntime,AlarmSensorType,AlarmZone,Device,LabEvent,Point,Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {visible} from './geometry.js';
const panelKind=(d:Device)=>profile(d.profileId).kind==='alarm-panel';
const sensorKind=(d:Device)=>profile(d.profileId).kind==='alarm-sensor';
const outputKind=(d:Device)=>profile(d.profileId).kind==='alarm-output';
const keypadKind=(d:Device)=>profile(d.profileId).kind==='alarm-keypad';
const alarmKind=(d:Device)=>panelKind(d)||sensorKind(d)||outputKind(d)||keypadKind(d);
export const DEFAULT_PANEL_PIN='1234'; // Classroom-only demonstration credential, never real access security.
export function panelConfig(d:Device):AlarmPanelConfig {
 const count=profile(d.profileId).alarmZones||8;
 return d.alarmPanel||{pin:DEFAULT_PANEL_PIN,entryDelaySec:30,exitDelaySec:45,sirenDurationSec:180,batteryCapacityWh:84,batteryChargeWh:84,batteryEnabled:true,tamper:false,zones:Array.from({length:count},(_,i)=>({number:i+1,name:`Zone ${i+1}`,type:i===0?'entry':i===1?'interior':'instant',enabled:true,bypassed:false}))};
}
export function runtimeOf(project:Project,panelId:string):AlarmRuntime {return project.alarmStates?.[panelId]||{mode:'disarmed',phase:'idle',remainingSeconds:0,triggeredZones:[],sirenSeconds:0};}
const deviceZone=(d:Device)=>d.alarmDevice?.zone??1;
const wireLengthOK=(n:number)=>Number.isFinite(n)&&n>0&&n<=300;
const message=(p:Project,kind:LabEvent['kind'],body:string,deviceId?:string,point?:Point):LabEvent=>({id:`alarm-${crypto.randomUUID()}`,at:new Date().toISOString(),kind,message:body,deviceId,recorded:false,...(point?{x:point.x,y:point.y}:{})});
const append=(p:Project,entry:LabEvent):Project=>({...p,events:[...p.events,entry].slice(-250),updatedAt:entry.at});
function setRuntime(p:Project,id:string,state:AlarmRuntime):Project{return {...p,alarmStates:{...p.alarmStates,[id]:state}};}
const isAlarmCable=(c:Project['cables'][number])=>c.medium==='alarm';
/** Alarm signals, wiring continuity, zone assignment, and battery/AC power are derived independently of IP networking. */
export function evaluateAlarms(p:Project):AlarmResult {
 const panels:AlarmResult['panels']={},devices:AlarmResult['devices']={},wires:AlarmResult['wires']={},issues:string[]=[];
 const all=new Map(p.devices.map(d=>[d.id,d]));
 const candidates=p.devices.filter(alarmKind);
 for(const d of candidates)devices[d.id]={powered:false,wired:false,faults:[]};
 const wireUsage=new Map<string,number>();
 const connectedByDevice=new Map<string,{panelId:string;wireId:string}[]>();
 const outputAllocation=new Map<string,number>();
 for(const wire of [...p.cables].filter(isAlarmCable).sort((a,b)=>a.id.localeCompare(b.id))){
  const a=all.get(wire.a),b=all.get(wire.b);
  const parent=a&&panelKind(a)?a:b&&panelKind(b)?b:undefined;
  const child=parent?.id===a?.id?b:a;
  let reason='';
  if(!a||!b||!parent||!child||!alarmKind(child)||panelKind(child)||a.id===b.id)reason='Alarm circuit requires one panel and one sensor, keypad or annunciator';
  else if(!wire.connected)reason='Alarm circuit disconnected';
  else if(!wireLengthOK(wire.lengthMeters))reason='Alarm cable exceeds virtual 300 m maximum';
  else if((wireUsage.get(child.id)||0)>=1)reason='Alarm accessory has more than one active panel connection';
  else if((wireUsage.get(parent.id)||0)>=(profile(parent.profileId).alarmWirePorts||12))reason='Alarm panel terminal count exceeded';
  else if(outputKind(child)&&(outputAllocation.get(parent.id)||0)>=(profile(parent.profileId).alarmOutputs||2))reason='Panel output capacity exceeded';
  if(reason){wires[wire.id]={up:false,reason};issues.push(`Alarm wire ${wire.id.slice(-6)}: ${reason}`);continue;}
  wires[wire.id]={up:true,reason:'Supervised virtual alarm circuit connected'};
  wireUsage.set(parent!.id,(wireUsage.get(parent!.id)||0)+1);wireUsage.set(child!.id,1);
  if(outputKind(child!))outputAllocation.set(parent!.id,(outputAllocation.get(parent!.id)||0)+1);
  connectedByDevice.set(child!.id,[...(connectedByDevice.get(child!.id)||[]),{panelId:parent!.id,wireId:wire.id}]);
 }
 for(const panel of p.devices.filter(panelKind)){
  const conf=panelConfig(panel),run=runtimeOf(p,panel.id);
  const battery=conf.batteryEnabled&&conf.batteryCapacityWh>0&&conf.batteryChargeWh>0;
  const powered=panel.enabled&&(p.mainsOn||battery);
  const related=candidates.filter(d=>connectedByDevice.get(d.id)?.some(c=>c.panelId===panel.id));
  const faults:string[]=[];
  if(!panel.enabled)faults.push('Panel is disabled');
  else if(!powered)faults.push('Panel lost AC and has no usable battery');
  else if(!p.mainsOn)faults.push('AC failure — operating on finite backup battery');
  if(conf.tamper)faults.push('Panel tamper circuit active');
  if(battery&&conf.batteryChargeWh<conf.batteryCapacityWh*0.15)faults.push('Backup battery charge critically low');
  if(!battery)faults.push('No usable backup battery');
  const zstates:AlarmPanelStatus['zones']=conf.zones.map(zone=>{
   const members=related.filter(d=>sensorKind(d)&&deviceZone(d)===zone.number);
   const f:string[]=[];
   // Empty zones are unused, not failed circuits; assigned detectors must be healthy.
   for(const d of members){
    const alarm=d.alarmDevice;
    if(!d.enabled)f.push(`${d.name}: detector disabled`);
    if(alarm?.fault&&alarm.fault!=='none')f.push(`${d.name}: ${alarm.fault} circuit fault`);
    if((alarm?.normallyClosed??true)!==(zone.contact!=='no'))f.push(`${d.name}: NC/NO input polarity mismatch`);
    if(!powered)f.push(`${d.name}: panel power unavailable`);
   }
   const armed=zone.enabled&&!zone.bypassed&&!(run.mode==='stay'&&zone.type==='interior')&&(run.mode!=='disarmed'||zone.type==='24h');
   return {number:zone.number,name:zone.name,type:zone.type,armed,ready:f.length===0,triggered:run.triggeredZones.includes(zone.number),faults:f,devices:members.map(d=>d.id)};
  });
  for(const orphan of related.filter(d=>sensorKind(d)&&!conf.zones.some(z=>z.number===deviceZone(d)))){
   faults.push(`${orphan.name}: sensor zone ${deviceZone(orphan)} outside panel configuration`);
  }
  const outputs=related.filter(outputKind);
  const outputW=outputs.filter(d=>d.enabled).reduce((sum,d)=>sum+profile(d.profileId).powerW,0);
  if(outputW>24)faults.push(`Alarm output load ${outputW.toFixed(1)} W exceeds simulated 24 W panel output supply`);
  const sounding=powered&&run.phase==='triggered'&&run.sirenSeconds>0&&outputW<=24;
  const activeOutputs=sounding?outputs.filter(d=>d.enabled).map(d=>d.id):[];
  panels[panel.id]={id:panel.id,powered,acOn:panel.enabled&&p.mainsOn,usingBattery:panel.enabled&&!p.mainsOn&&battery,
   batteryWh:conf.batteryChargeWh,mode:run.mode,phase:run.phase,remainingSeconds:run.remainingSeconds,zones:zstates,activeOutputs,
   faults:[...faults,...zstates.filter(z=>z.faults.length>0).map(z=>`${z.name}: ${z.faults.join(', ')}`)]};
  devices[panel.id]={powered,wired:true,faults};
  for(const d of related){
   const isOn=powered&&d.enabled&&(d.alarmDevice?.fault!=='short');
   devices[d.id]={powered:isOn,panelId:panel.id,wired:true,...(sensorKind(d)?{zone:deviceZone(d)}:{}),faults:[]};
   if(!isOn)devices[d.id].faults.push(!powered?'No panel power':!d.enabled?'Accessory disabled':'Shorted circuit');
   if(d.alarmDevice?.fault&&d.alarmDevice.fault!=='none')devices[d.id].faults.push(`${d.alarmDevice.fault} circuit fault`);
  }
  issues.push(...panels[panel.id].faults.map(f=>`${panel.name}: ${f}`));
 }
 for(const d of candidates.filter(d=>!panelKind(d)&&!devices[d.id]?.wired)){
  devices[d.id]={powered:false,wired:false,faults:['Alarm accessory not connected to panel']};issues.push(`${d.name}: not wired to an alarm panel`);
 }
 return {panels,devices,wires,issues,activeSirenCount:Object.values(panels).reduce((n,x)=>n+x.activeOutputs.filter(id=>profile(all.get(id)!.profileId).id==='alarm-siren').length,0)};
}
const getPanel=(p:Project,id:string)=>{const panel=p.devices.find(d=>d.id===id);if(!panel||!panelKind(panel))throw new Error('Choose a valid alarm control panel');return panel;};
/** UI supplies the virtual PIN; acceptance never treats it as actual secure authentication. */
export function commandAlarm(p:Project,panelId:string,command:'stay'|'away'|'disarm'|'silence',pin:string):Project {
 const panel=getPanel(p,panelId),conf=panelConfig(panel),snapshot=evaluateAlarms(p),alarm=snapshot.panels[panelId],old=runtimeOf(p,panelId);
 if(pin!==conf.pin)throw new Error('Virtual keypad PIN does not match the panel configuration');
 const installedKeypad=p.devices.some(d=>keypadKind(d)&&snapshot.devices[d.id]?.panelId===panelId&&snapshot.devices[d.id]?.powered);
 if(!installedKeypad)throw new Error('A powered wired alarm keypad is required to operate this panel');
 if(!alarm.powered)throw new Error('Alarm panel has no power');
 if(command==='silence'){
  if(old.phase!=='triggered')throw new Error('No active alarm to silence');
  return append(setRuntime(p,panelId,{...old,sirenSeconds:0}),message(p,'info',`${panel.name}: siren silenced; alarm remains latched`,panelId));
 }
 if(command==='disarm')return append(setRuntime(p,panelId,{mode:'disarmed',phase:'idle',remainingSeconds:0,triggeredZones:[],sirenSeconds:0}),message(p,'info',`${panel.name}: disarmed and event latch cleared`,panelId));
 if(old.mode!=='disarmed')throw new Error('Disarm before selecting another arming mode');
 if(conf.tamper)throw new Error('Cannot arm while panel tamper is active');
 // Only armed zones in the *requested* mode block arming; an entry door may remain open during the exit delay.
 const notReady=alarm.zones.filter(z=>z.type!=='entry'&&conf.zones.find(q=>q.number===z.number)?.enabled&&!conf.zones.find(q=>q.number===z.number)?.bypassed&&
   (command==='away'||z.type!=='interior')&&!z.ready);
 if(notReady.length)throw new Error(`Unready alarm zones: ${notReady.map(z=>z.name).join(', ')}`);
 const state:AlarmRuntime={mode:command,phase:conf.exitDelaySec>0?'exit':'armed',remainingSeconds:conf.exitDelaySec,triggeredZones:[],sirenSeconds:0};
 return append(setRuntime(p,panelId,state),message(p,'info',`${panel.name}: armed ${command}; ${conf.exitDelaySec}s exit delay`,panelId));
}
export type AlarmStimulus='motion'|'door'|'window'|'glass'|'vibration'|'beam'|'panic';
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
function detects(d:Device,type:AlarmStimulus,point:Point,p:Project,intensity:number){
 const sensor=profile(d.profileId).alarmSensorType;
 if(sensor===undefined||sensor==='panic')return type==='panic'&&sensor==='panic'&&distance(d,point)<=20;
 if(sensor!==type&&!(sensor==='pir'&&type==='motion'))return false;
 if(intensity<100-(d.alarmDevice?.sensitivity??50))return false;
 if(sensor==='door'||sensor==='window')return distance(d,point)<=24;
 if(sensor==='vibration')return distance(d,point)<=Math.max(10,d.range||28);
 if(sensor==='glass')return distance(d,point)<=Math.max(10,d.range||90);
 if(sensor==='beam'){
  const r=(d.heading||0)*Math.PI/180,dx=point.x-d.x,dy=point.y-d.y;
  const along=dx*Math.cos(r)+dy*Math.sin(r),across=Math.abs(-dx*Math.sin(r)+dy*Math.cos(r));
  return along>=0&&along<=(d.range||260)&&across<=8;
 }
 // IR motion detectors use wall occlusion and a simplified two-dimensional view cone.
 return visible(d,point,p.walls,false);
}
function startAlarm(run:AlarmRuntime,zone:number,duration:number):AlarmRuntime {
 return {...run,phase:'triggered',remainingSeconds:0,pendingZone:undefined,triggeredZones:[...new Set([...run.triggeredZones,zone])],sirenSeconds:duration};
}
/** Event detection changes physical alarm state; if disarmed, only 24h zones (e.g. panic) remain active. */
export function triggerAlarmStimulus(p:Project,type:AlarmStimulus,point:Point,intensity=90):{project:Project;detected:number;alerts:number} {
 const sim=evaluateAlarms(p);let next=p,detected=0,alerts=0;
 for(const sensor of [...p.devices].filter(sensorKind).sort((a,b)=>a.id.localeCompare(b.id))){
  const status=sim.devices[sensor.id];if(!status?.powered||!status.panelId||sensor.alarmDevice?.bypassed||sensor.alarmDevice?.fault&&sensor.alarmDevice.fault!=='none')continue;
  if(!detects(sensor,type,point,p,intensity))continue;
  const panelId=status.panelId,zone=sim.panels[panelId]?.zones.find(z=>z.number===status.zone);
  if(!zone||!zone.ready)continue;
  detected++;
  const current=runtimeOf(next,panelId),panel=getPanel(next,panelId),conf=panelConfig(panel);
  if(!zone.armed){next=append(next,message(p,'info',`${sensor.name}: ${type} detected while zone is unarmed/bypassed`,sensor.id,point));continue;}
  if(current.phase==='exit'&&zone.type!=='24h'){
   next=append(next,message(p,'info',`${sensor.name}: ${type} during exit delay (no alarm)`,sensor.id,point));continue;
  }
  if(current.phase==='triggered'){
   next=setRuntime(next,panelId,{...current,triggeredZones:[...new Set([...current.triggeredZones,zone.number])]});
   next=append(next,message(p,'warning',`${sensor.name}: further alarm detection in zone ${zone.number}`,sensor.id,point));continue;
  }
  if(zone.type==='entry'&&conf.entryDelaySec>0&&current.phase!=='entry'){
   next=setRuntime(next,panelId,{...current,phase:'entry',remainingSeconds:conf.entryDelaySec,pendingZone:zone.number});
   next=append(next,message(p,'warning',`${sensor.name}: entry delay started (${conf.entryDelaySec}s)`,sensor.id,point));
  }else if(current.phase==='entry'&&zone.type==='entry'){
   next=append(next,message(p,'warning',`${sensor.name}: entry event during existing delay`,sensor.id,point));
  }else{
   const newState=startAlarm(current,zone.number,conf.sirenDurationSec);
   next=setRuntime(next,panelId,newState);alerts++;
   next=append(next,message(p,'fault',`${panel.name}: ALARM — ${sensor.name}, zone ${zone.number} (${zone.type})`,sensor.id,point));
  }
 }
 if(!detected)next=append(next,message(p,'info',`No operational ${type} detector responded at the selected position`,undefined,point));
 return {project:next,detected,alerts};
}
/** One-second deterministic virtual timers; no background browser clock or real-world monitoring is claimed. */
export function advanceAlarmTime(p:Project,seconds:number):Project {
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>3600)throw new Error('Advance alarm by 1–3600 whole seconds');
 let next:Project={...p,alarmElapsedSec:(p.alarmElapsedSec||0)+seconds};
 for(const panel of p.devices.filter(panelKind)){
  const conf=panelConfig(panel),run=runtimeOf(next,panel.id);let state={...run};
  const powered=panel.enabled&&(p.mainsOn||(conf.batteryEnabled&&conf.batteryChargeWh>0));
  let charge=conf.batteryChargeWh;
  if(!p.mainsOn&&panel.enabled&&conf.batteryEnabled&&charge>0){
   const linked=p.devices.filter(d=>p.cables.some(c=>c.medium==='alarm'&&c.connected&&((c.a===panel.id&&c.b===d.id)||(c.b===panel.id&&c.a===d.id))));
   const baseLoad=profile(panel.profileId).powerW*0.35; // Teaching approximation of panel standby draw.
   const accessory=linked.filter(d=>!outputKind(d)&&d.enabled).reduce((n,d)=>n+profile(d.profileId).powerW,0);
   const sounding=run.phase==='triggered'&&run.sirenSeconds>0;
   const activeOutput=sounding?linked.filter(outputKind).reduce((n,d)=>n+(d.enabled?profile(d.profileId).powerW:0),0):0;
   charge=Math.max(0,charge-(baseLoad+accessory+activeOutput)*seconds/3600);
  }
  if(powered&&charge===0&&!p.mainsOn){state={...state,phase:'idle',mode:'disarmed',remainingSeconds:0,sirenSeconds:0};}
  else if(powered){
   if(state.phase==='exit'){
    state.remainingSeconds=Math.max(0,state.remainingSeconds-seconds);
    if(!state.remainingSeconds)state.phase='armed';
   }else if(state.phase==='entry'){
    state.remainingSeconds=Math.max(0,state.remainingSeconds-seconds);
    if(!state.remainingSeconds){state=startAlarm(state,state.pendingZone||0,conf.sirenDurationSec);next=append(next,message(next,'fault',`${panel.name}: entry delay expired; alarm latched`,panel.id));}
   }
   if(run.phase==='triggered')state.sirenSeconds=Math.max(0,run.sirenSeconds-seconds);
  }
  if(charge!==conf.batteryChargeWh)next={...next,devices:next.devices.map(d=>d.id===panel.id?{...d,alarmPanel:{...conf,batteryChargeWh:charge}}:d)};
  next=setRuntime(next,panel.id,state);
 }
 return {...next,updatedAt:new Date().toISOString()};
}
/** Injects deterministic, repairable failures; fault fields are visible in the device inspector. */
export function injectAlarmFault(p:Project,kind:'open'|'short'|'tamper'|'battery'|'mains'|'zone'|'wire'):Project {
 const panel=p.devices.find(panelKind),sensor=p.devices.find(sensorKind);if(!panel)return p;
 let next=p,description='';
 if(kind==='mains'){next={...p,mainsOn:false};description='AC failure: alarm panel switched to backup if battery available';}
 else if(kind==='battery'){next={...p,devices:p.devices.map(d=>d.id===panel.id?{...d,alarmPanel:{...panelConfig(d),batteryChargeWh:0}}:d)};description='Alarm backup battery discharged';}
 else if(kind==='zone'&&sensor){next={...p,devices:p.devices.map(d=>d.id===sensor.id?{...d,alarmDevice:{zone:99,normallyClosed:true,bypassed:false,sensitivity:50,fault:'none',...d.alarmDevice}}:d)};description='Sensor assigned outside panel zone capacity';}
 else if(kind==='wire'){
  const target=p.cables.find(c=>c.medium==='alarm'&&c.connected);if(!target)return p;
  next={...p,cables:p.cables.map(c=>c.id===target.id?{...c,connected:false}:c)};description='Virtual alarm circuit wire disconnected';
 }else if(sensor&&kind!=='zone'){next={...p,devices:p.devices.map(d=>d.id===sensor.id?{...d,alarmDevice:{zone:1,normallyClosed:true,bypassed:false,sensitivity:50,...d.alarmDevice,fault:kind}}:d)};description=`Detector ${kind} circuit injected`;}
 if(next===p)return p;
 // Simulated tamper contacts latch an alarm when an armed panel loses its supervised circuit.
 if(kind==='tamper'&&sensor){
  const origin=evaluateAlarms(p).devices[sensor.id];
  if(origin?.panelId){const active=runtimeOf(p,origin.panelId);if(active.mode!=='disarmed'){
   const parent=getPanel(p,origin.panelId),zone=deviceZone(sensor);
   next=setRuntime(next,origin.panelId,startAlarm(active,zone,panelConfig(parent).sirenDurationSec));
   description+=' — tamper alarm latched on armed panel';
  }}
 }
 return append(next,message(next,'fault',description));
}
export const ALARM_STIMULI:readonly {type:AlarmStimulus;label:string}[]=[{type:'motion',label:'PIR movement'},{type:'door',label:'Door opened'},{type:'window',label:'Window opened'},{type:'glass',label:'Glass broken'},{type:'vibration',label:'Vibration'},{type:'beam',label:'Perimeter crossed'},{type:'panic',label:'Panic pressed'}];
