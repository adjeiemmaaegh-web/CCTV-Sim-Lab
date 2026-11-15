/**
 * Stage 7 offline access-control teaching engine. This is NOT a real access
 * controller, credential authentication service, biometric matcher, fire-egress
 * design, or vendor protocol. IDs and codes are synthetic classroom tokens.
 * Access decisions depend exclusively on project data and the virtual clock.
 */
import type {AccessClock,AccessControllerConfig,AccessDoorRuntime,AccessIdentity,AccessLog,AccessMethod,AccessResult,Device,LabEvent,Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {evaluatePower} from './power.js';
import type {PowerResult} from '../domain/types.js';

export const accessKind=(d:Device)=>profile(d.profileId).kind.startsWith('access-');
const isController=(d:Device)=>profile(d.profileId).kind==='access-controller';
const isReader=(d:Device)=>profile(d.profileId).kind==='access-reader';
const isLock=(d:Device)=>profile(d.profileId).kind==='access-lock';
const isExit=(d:Device)=>profile(d.profileId).kind==='access-exit';
const clockDefault:AccessClock={day:0,minute:9*60,second:0};
export const accessClock=(p:Project):AccessClock=>p.accessClock||clockDefault;
export const clockText=(p:Project)=>{
 const c=accessClock(p);return `${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][c.day]} ${String(Math.floor(c.minute/60)).padStart(2,'0')}:${String(c.minute%60).padStart(2,'0')}:${String(c.second).padStart(2,'0')}`;
};
export const controllerConfig=(d:Device):AccessControllerConfig=>d.accessController||{doorWallId:'',unlockSeconds:5,heldOpenLimitSeconds:30,supplyCapacityW:25,batteryEnabled:true,batteryCapacityWh:48,batteryChargeWh:48};
const defaultRuntime=():AccessDoorRuntime=>({open:false,unlockedSeconds:0,heldOpenSeconds:0,forced:false,alarm:false});
export const doorRuntime=(p:Project,wallId:string):AccessDoorRuntime=>p.accessDoorStates?.[wallId]||defaultRuntime();
const append=(p:Project,entry:Omit<AccessLog,'id'|'at'|'clock'>):Project=>{
 const at=new Date().toISOString(),clock={...accessClock(p)};
 const log:AccessLog={id:`access-${crypto.randomUUID()}`,at,clock,...entry};
 const event:LabEvent={id:log.id,at,kind:entry.decision==='alarm'?'fault':entry.decision==='denied'?'warning':'info',message:`Access control: ${entry.reason}`,recorded:false};
 return {...p,updatedAt:at,accessLog:[...(p.accessLog||[]),log].slice(-250),events:[...p.events,event].slice(-250)};
};
const findController=(p:Project,id:string)=>{
 const d=p.devices.find(d=>d.id===id);if(!d||!isController(d))throw new Error('Choose an installed access control panel');return d;
};
const updateDoor=(p:Project,wallId:string,change:Partial<AccessDoorRuntime>):Project=>({...p,accessDoorStates:{...p.accessDoorStates,[wallId]:{...doorRuntime(p,wallId),...change}}});

/** Every access accessory must have exactly one valid direct cable to a controller. */
export function evaluateAccess(p:Project,supply?:PowerResult):AccessResult {
 const controllers:AccessResult['controllers']={},devices:AccessResult['devices']={},cables:AccessResult['cables']={},doors:AccessResult['doors']={},issues:string[]=[];
 const power=supply??evaluatePower(p);
 const hardware=p.devices.filter(accessKind),byId=new Map(p.devices.map(d=>[d.id,d]));
 for(const d of hardware)devices[d.id]={id:d.id,powered:false,wired:false,faults:[]};
 const allocated=new Map<string,string[]>(),accessories=new Set<string>();
 for(const c of [...p.cables].filter(c=>c.medium==='access').sort((a,b)=>a.id.localeCompare(b.id))){
  const a=byId.get(c.a),b=byId.get(c.b),panel=a&&isController(a)?a:b&&isController(b)?b:undefined,part=panel?.id===a?.id?b:a;
  let reason='';
  if(!a||!b||a.id===b.id||!panel||!part||!accessKind(part)||isController(part)||profile(part.profileId).kind==='access-server')reason='Dedicated access wiring requires one controller and one reader, lock or exit button';
  else if(!c.connected)reason='Access wire disconnected';
  else if(!Number.isFinite(c.lengthMeters)||c.lengthMeters<=0||c.lengthMeters>100)reason='Access wire exceeds simulated 100 m limit';
  else if(accessories.has(part.id))reason='Accessory connected to more than one panel';
  else if((allocated.get(panel.id)||[]).length>=(profile(panel.profileId).accessWirePorts||5))reason='Controller terminal count exceeded';
  if(reason){cables[c.id]={up:false,reason};issues.push(`Access wire ${c.id.slice(-6)}: ${reason}`);continue;}
  cables[c.id]={up:true,reason:'Virtual access circuit connected'};
  accessories.add(part!.id);allocated.set(panel!.id,[...(allocated.get(panel!.id)||[]),part!.id]);
 }
 const occupied=new Set<string>();
 for(const panel of hardware.filter(isController).sort((a,b)=>a.id.localeCompare(b.id))){
  const config=controllerConfig(panel),members=(allocated.get(panel.id)||[]).map(id=>byId.get(id)!);
  const locks=members.filter(isLock),readers=members.filter(isReader),buttons=members.filter(isExit);
  const faults:string[]=[];
  const battery=config.batteryEnabled&&config.batteryChargeWh>0;
  const ac=power.mode==='wired'?!!power.devices[panel.id]?.powered:p.mainsOn;
  const powered=panel.enabled&&(ac||battery);
  const supply=members.filter(d=>d.enabled).reduce((sum,d)=>sum+profile(d.profileId).powerW,0);
  if(!powered)faults.push('Controller power unavailable');
  if(panel.enabled&&!ac&&battery)faults.push('AC unavailable — operating on finite controller battery');
  if(config.batteryEnabled&&config.batteryChargeWh<config.batteryCapacityWh*.1)faults.push('Backup battery is critically low');
  if(supply>config.supplyCapacityW)faults.push(`Accessory demand ${supply.toFixed(1)} W exceeds controller output supply ${config.supplyCapacityW.toFixed(1)} W`);
  const active=powered&&supply<=config.supplyCapacityW;
  if(locks.length!==1)faults.push('Exactly one connected electronic lock is required per single-door controller');
  if(readers.length<1)faults.push('No wired reader installed');
  const doorWall=p.walls.find(w=>w.kind==='door'&&w.id===config.doorWallId);
  if(!doorWall)faults.push('Controller is not assigned to an existing physical door opening');
  if(doorWall&&occupied.has(doorWall.id))faults.push('Door opening is assigned to multiple controllers');
  if(doorWall)occupied.add(doorWall.id);
  for(const d of members){
   const f:string[]=[];
   if(!d.enabled)f.push('Device disabled');
   if(isReader(d)&&d.accessReader?.fault&&d.accessReader.fault!=='none')f.push(`Reader ${d.accessReader.fault} fault`);
   if(isReader(d)&&d.accessReader?.method&&d.accessReader.method!==profile(d.profileId).accessReaderMethod)f.push('Reader method incompatible with training hardware profile');
   if(isLock(d)&&d.accessLock?.fault&&d.accessLock.fault!=='none')f.push(`Lock ${d.accessLock.fault} fault`);
   if(!active)f.push(!powered?'Controller is unpowered':'Power supply overloaded');
   devices[d.id]={id:d.id,powered:active&&d.enabled&&f.length===0,wired:true,controllerId:panel.id,faults:f};
   issues.push(...f.map(x=>`${d.name}: ${x}`));
  }
  devices[panel.id]={id:panel.id,powered,wired:true,faults};
  if(doorWall){
   const rt=doorRuntime(p,doorWall.id),lock=locks[0],lockOk=lock&&devices[lock.id]?.powered;
   const lockFault=lock?.accessLock?.fault||'none';
   const mode=lock?.accessLock?.failMode||'fail-secure';
   // Relay timer only releases a functional powered lock; on loss of power fail-safe releases.
   const locked=lockFault==='stuck-locked'?true:lockFault==='stuck-open'?false:lockOk?rt.unlockedSeconds<=0:mode==='fail-secure';
   const doorFaults=[...faults];
   if(!lock)doorFaults.push('Missing lock — physical security cannot be assessed');
   if(rt.forced)doorFaults.push('Forced-entry event latched');
   if(rt.heldOpenSeconds>config.heldOpenLimitSeconds)doorFaults.push('Door held open beyond configured limit');
   const door={controllerId:panel.id,wallId:doorWall.id,name:panel.name,open:rt.open,locked,forced:rt.forced,alarm:rt.alarm||rt.forced||rt.heldOpenSeconds>config.heldOpenLimitSeconds,unlockSeconds:rt.unlockedSeconds,heldOpenSeconds:rt.heldOpenSeconds,faults:doorFaults};
   doors[doorWall.id]=door;controllers[panel.id]={id:panel.id,powered,usingBattery:panel.enabled&&!ac&&battery,connectedReaderIds:readers.map(d=>d.id),lockIds:locks.map(d=>d.id),exitIds:buttons.map(d=>d.id),door,powerUsedW:supply,powerBudgetW:config.supplyCapacityW,faults};
  }else controllers[panel.id]={id:panel.id,powered,usingBattery:panel.enabled&&!ac&&battery,connectedReaderIds:readers.map(d=>d.id),lockIds:locks.map(d=>d.id),exitIds:buttons.map(d=>d.id),powerUsedW:supply,powerBudgetW:config.supplyCapacityW,faults};
  issues.push(...faults.map(f=>`${panel.name}: ${f}`));
 }
 for(const d of hardware.filter(d=>!isController(d)&&!devices[d.id]?.wired)){
  if(profile(d.profileId).kind==='access-server'){
   const online=d.enabled&&(power.mode==='wired'?!!power.devices[d.id]?.powered:p.mainsOn);devices[d.id]={id:d.id,powered:online,wired:true,faults:online?[]:['Event console has no mains power']};continue;
  }
  devices[d.id]={id:d.id,powered:false,wired:false,faults:['Accessory has no valid controller circuit']};issues.push(`${d.name}: no access control circuit`);
 }
 return {controllers,devices,cables,doors,issues,grantedCount:(p.accessLog||[]).filter(e=>e.decision==='granted').length,deniedCount:(p.accessLog||[]).filter(e=>e.decision==='denied').length};
}
/** Simple virtual calendar schedules, including overnight intervals. 0 = Monday. */
export function permitAt(identity:AccessIdentity,controllerId:string,c:AccessClock):boolean {
 return identity.enabled&&identity.grants.some(g=>g.controllerId===controllerId&&(
  g.startMinute<g.endMinute?g.days.includes(c.day)&&c.minute>=g.startMinute&&c.minute<g.endMinute:
  g.startMinute>g.endMinute?(g.days.includes(c.day)&&c.minute>=g.startMinute||g.days.includes((c.day+6)%7)&&c.minute<g.endMinute):false));
}
/** A real reader is required; a typed virtual token alone does not grant a relay. */
export function presentAccessToken(p:Project,controllerId:string,readerId:string,method:AccessMethod,token:string):Project {
 const controller=findController(p,controllerId),network=evaluateAccess(p),reader=p.devices.find(d=>d.id===readerId);
 const readerOnline=reader&&isReader(reader)&&network.devices[reader.id]?.controllerId===controllerId&&network.devices[reader.id]?.powered&&reader.accessReader?.method===method;
 const matches=(p.accessIdentities||[]).filter(i=>i.enabled&&i[method==='card'?'cardToken':method==='pin'?'pinToken':'biometricToken']===token&&token.length>0);
 const identity=matches.length===1?matches[0]:undefined;
 const permitted=identity&&permitAt(identity,controllerId,accessClock(p));
 const door=network.controllers[controller.id]?.door;
 const good=!!readerOnline&&!!door&&network.controllers[controller.id]?.powered&&network.controllers[controller.id].lockIds.length===1&&!!permitted&&network.devices[network.controllers[controller.id].lockIds[0]]?.powered&&!door.faults.some(f=>f.includes('multiple'));
 const reason=!readerOnline?'Reader is disconnected, faulty or set to a different method':!door?'No controlled door assigned':!identity?'Unknown, disabled or ambiguous synthetic credential':!permitted?'Credential has no valid door/time permission':'Access granted — virtual relay energized';
 let next=p;
 if(good&&door)next=updateDoor(p,door.wallId,{unlockedSeconds:controllerConfig(controller).unlockSeconds,forced:false});
 return append(next,{controllerId,readerId,identityId:identity?.id,action:method,decision:good?'granted':'denied',reason});
}
export function requestExit(p:Project,controllerId:string,buttonId:string):Project {
 const controller=findController(p,controllerId),status=evaluateAccess(p).controllers[controllerId];
 const button=p.devices.find(d=>d.id===buttonId);
 const okay=!!status?.powered&&!!status.door&&button&&isExit(button)&&evaluateAccess(p).devices[buttonId]?.powered&&evaluateAccess(p).devices[buttonId]?.controllerId===controllerId;
 let next=p;if(okay&&status.door)next=updateDoor(p,status.door.wallId,{unlockedSeconds:controllerConfig(controller).unlockSeconds,forced:false});
 return append(next,{controllerId,action:'exit',decision:okay?'granted':'denied',reason:okay?'Request-to-exit relay released the door':'Exit button is unavailable or door is not configured'});
}
export function operateDoor(p:Project,controllerId:string,open:boolean):Project {
 findController(p,controllerId);const before=evaluateAccess(p).controllers[controllerId]?.door;
 if(!before)throw new Error('Assign this controller to a physical door opening');
 const state=doorRuntime(p,before.wallId);
 const forced=open&&!state.open&&before.locked;
 const next=updateDoor(p,before.wallId,{open,heldOpenSeconds:open?state.heldOpenSeconds:0,forced:state.forced||forced,alarm:state.alarm||forced});
 return append(next,{controllerId,action:open?'open':'close',decision:forced?'alarm':'info',reason:forced?'Door opened while locked — forced entry alert':open?'Door contact opened':'Door contact closed'});
}
export function clearAccessAlarm(p:Project,controllerId:string):Project {
 findController(p,controllerId);const door=evaluateAccess(p).controllers[controllerId]?.door;if(!door)throw new Error('No door assigned');
 if(door.open)throw new Error('Close the door before acknowledging an access alarm');
 return append(updateDoor(p,door.wallId,{forced:false,alarm:false,heldOpenSeconds:0}),{controllerId,action:'fault',decision:'info',reason:'Door alarm acknowledged after closing'});
}
export function advanceAccessTime(p:Project,seconds:number):Project {
 if(!Number.isSafeInteger(seconds)||seconds<1||seconds>3600)throw new Error('Advance access clock by 1–3600 seconds');
 const before=accessClock(p),absolute=((before.day*86400)+(before.minute*60)+before.second+seconds)%(7*86400),day=Math.floor(absolute/86400),minute=Math.floor(absolute%86400/60),second=absolute%60;
 const states={...p.accessDoorStates};
 for(const [wallId,rt] of Object.entries(states)){
  const controller=p.devices.find(d=>isController(d)&&controllerConfig(d).doorWallId===wallId);
  const limit=controller?controllerConfig(controller).heldOpenLimitSeconds:30;
  const held=rt.open?rt.heldOpenSeconds+seconds:0;
  states[wallId]={...rt,unlockedSeconds:Math.max(0,rt.unlockedSeconds-seconds),heldOpenSeconds:held,alarm:rt.alarm||held>limit};
 }
 const devices=p.devices.map(d=>{
  if(!isController(d)||!d.accessController||!d.accessController.batteryEnabled||(p.powerSettings?.mode==='wired'?!!evaluatePower(p).devices[d.id]?.powered:p.mainsOn))return d;
  // Wh = power(W) × seconds / 3600; simple fixed-load virtual battery model.
  const c=d.accessController,dependent=p.cables.filter(x=>x.medium==='access'&&x.connected&&(x.a===d.id||x.b===d.id)).map(x=>p.devices.find(v=>v.id===(x.a===d.id?x.b:x.a))).filter((x):x is Device=>!!x&&x.enabled);
  const watts=profile(d.profileId).powerW+dependent.reduce((sum,x)=>sum+profile(x.profileId).powerW,0);
  return {...d,accessController:{...c,batteryChargeWh:Math.max(0,c.batteryChargeWh-watts*seconds/3600)}};
 });
 return append({...p,devices,accessClock:{day,minute,second},accessDoorStates:states},{controllerId:'virtual-clock',action:'time',decision:'info',reason:`Access clock advanced ${seconds}s; door timers and backup loads updated`});
}
export function injectAccessFault(p:Project,kind:'wire'|'reader'|'lock'|'battery'|'power'):Project {
 const controller=p.devices.find(isController),accessories=p.devices.filter(d=>accessKind(d)&&!isController(d));if(!controller)return p;
 let next=p,reason='';
 if(kind==='wire'){
  const cable=p.cables.find(c=>c.medium==='access'&&c.connected);
  if(cable){next={...p,cables:p.cables.map(c=>c.id===cable.id?{...c,connected:false}:c)};reason='Access circuit cable disconnected';}
 }else if(kind==='reader'){
  const reader=accessories.find(isReader);
  if(reader){next={...p,devices:p.devices.map(d=>d.id===reader.id?{...d,accessReader:{method:d.accessReader?.method||'card',fault:'offline'}}:d)};reason='Reader module placed offline';}
 }else if(kind==='lock'){
  const lock=accessories.find(isLock);
  if(lock){next={...p,devices:p.devices.map(d=>d.id===lock.id?{...d,accessLock:{failMode:d.accessLock?.failMode||'fail-safe',fault:'stuck-locked'}}:d)};reason='Electronic lock relay jammed';}
 }else if(kind==='battery'){
  next={...p,devices:p.devices.map(d=>d.id===controller.id?{...d,accessController:{...controllerConfig(d),batteryChargeWh:0}}:d)};reason='Controller backup battery depleted';
 }else if(kind==='power'){
  next={...p,mainsOn:false};reason='AC power failure injected';
 }
 return reason?append(next,{controllerId:controller.id,action:'fault',decision:'alarm',reason}):p;
}
