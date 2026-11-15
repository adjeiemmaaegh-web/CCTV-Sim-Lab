/**
 * Stage 8: deterministic instructional AC/DC/PV/PoE source-and-load model.
 * No actual voltages, switching transients, earthing, short-circuit currents,
 * battery chemistry, MPPT algorithm, protection discrimination or firmware.
 * Virtual circuits are directed from the source terminal (c.a) to load (c.b).
 */
import type {Cable,CableMedia,Device,PowerCableStatus,PowerConfig,PowerDeviceStatus,PowerResult,Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';

export const isPowerDevice=(d:Device)=>profile(d.profileId).kind.startsWith('power-');
export const isPowerCable=(c:Cable)=>c.medium==='power-ac'||c.medium==='power-dc'||c.medium==='power-pv';
export const DEFAULT_POWER_SETTINGS={mode:'legacy' as const,solarPercent:70,virtualMinutes:0};
const kind=(d:Device)=>profile(d.profileId).kind;
const validNumber=(v:number)=>Number.isFinite(v)&&v>=0;
const clamp=(x:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,x));
export function configOf(d:Device):PowerConfig {
 const spec=profile(d.profileId),capacity=spec.powerCapacityWh||0;
 return d.powerConfig??{ratedW:spec.powerRatedW||0,capacityWh:capacity,chargeWh:capacity,efficiency:
  kind(d)==='power-inverter'?0.88:kind(d)==='power-ups'?0.86:kind(d)==='power-controller'?0.94:0.95,
  fault:'none',chargeLimitW:kind(d)==='power-battery'?300:kind(d)==='power-ups'?140:0,dischargeLimitW:spec.powerRatedW||0};
}
const configGood=(d:Device)=>d.enabled&&configOf(d).fault==='none';
const currentLimit=(c:Cable)=>c.powerMaxAmps??(c.medium==='power-ac'?16:c.medium==='power-pv'?15:60);
const outputType=(d:Device)=>profile(d.profileId).powerOutputType||'none';
const inputType=(d:Device):'ac'|'dc'|'pv'|'poe'|'none'=>{
 const spec=profile(d.profileId),k=spec.kind;
 if(spec.powerInputType)return spec.powerInputType;
 if(k==='camera')return spec.signal==='analog'||spec.wirelessCapable?'dc':'poe';
 if(k.startsWith('alarm-')&&k!=='alarm-panel')return 'none';
 if(k.startsWith('access-')&&k!=='access-controller'&&k!=='access-server')return 'none';
 return 'ac';
};
const inputVoltage=(d:Device)=>profile(d.profileId).powerInputV||((inputType(d)==='dc')?12:230);
const outputVoltage=(d:Device)=>profile(d.profileId).powerOutputV||0;
const terminal=(d:Device)=>!isPowerDevice(d)&&!['none','poe'].includes(inputType(d));
const loadWatts=(d:Device,p:Project)=>{
 let watts=profile(d.profileId).powerW;
 // Count camera draw at the PoE switch INPUT, otherwise supply sizing is misleading.
 if(kind(d)==='switch')watts+=p.cables.filter(c=>(c.medium??'ethernet')==='ethernet'&&c.connected&&(c.a===d.id||c.b===d.id))
  .map(c=>p.devices.find(v=>v.id===(c.a===d.id?c.b:c.a)))
  .filter((x):x is Device=>!!x&&x.enabled&&profile(x.profileId).kind==='camera'&&profile(x.profileId).signal!=='analog'&&!profile(x.profileId).wirelessCapable)
  .reduce((n,x)=>n+profile(x.profileId).powerW*(p.night&&x.infraredEnabled!==false?1.3:1),0);
 if(kind(d)==='switch')watts=Math.min(watts,profile(d.profileId).powerW+Math.max(0,d.poeBudgetW??profile(d.profileId).poeBudgetW));
 if(kind(d)==='camera'&&p.night&&d.infraredEnabled!==false)watts*=1.3;
 // Access and intrusion wired accessories draw through their controllers.
 if(kind(d)==='access-controller')watts+=p.cables.filter(c=>c.medium==='access'&&c.connected&&(c.a===d.id||c.b===d.id))
  .map(c=>p.devices.find(v=>v.id===(c.a===d.id?c.b:c.a)))
  .filter((x):x is Device=>!!x&&x.enabled).reduce((n,x)=>n+profile(x.profileId).powerW,0);
 if(kind(d)==='alarm-panel')watts+=p.cables.filter(c=>c.medium==='alarm'&&c.connected&&(c.a===d.id||c.b===d.id))
  .map(c=>p.devices.find(v=>v.id===(c.a===d.id?c.b:c.a)))
  .filter((x):x is Device=>!!x&&x.enabled).reduce((n,x)=>n+profile(x.profileId).powerW,0);
 return Math.max(.01,watts);
};
function wireReason(c:Cable,a:Device|undefined,b:Device|undefined):string {
 if(!a||!b||a.id===b.id)return 'Both endpoints must be distinct installed devices';
 if(!c.connected)return 'Electrical cable disconnected';
 if(!validNumber(c.lengthMeters)||c.lengthMeters<.1||c.lengthMeters>100)return 'Electrical cable length outside 0.1–100 m training limit';
 if(!isPowerDevice(a))return 'Source terminal is not a power output device';
 if(!configGood(a)||!b.enabled)return 'Source or load is disabled or faulty';
 const media={'power-ac':'ac','power-dc':'dc','power-pv':'pv'} as const;
 const t=media[c.medium as keyof typeof media];
 if(outputType(a)!==t||inputType(b)!==t)return `Cable ${c.medium} incompatible with source/load terminals`;
 if(outputVoltage(a)!==inputVoltage(b))return `Voltage mismatch: ${outputVoltage(a)} V source to ${inputVoltage(b)} V input`;
 if(!Number.isFinite(currentLimit(c))||currentLimit(c)<=0||currentLimit(c)>200)return 'Invalid circuit maximum current';
 return '';
}
/** Return the appropriate directed power cable type, or null for an invalid connection. */
export function plannedPowerCable(a:Device,b:Device):{a:string;b:string;medium:CableMedia}|null {
 for(const [source,sink] of [[a,b],[b,a]]){
  const media=outputType(source),load=inputType(sink);
  if(media!=='none'&&media===load&&outputVoltage(source)===inputVoltage(sink))return {a:source.id,b:sink.id,medium:`power-${media}` as CableMedia};
 }
 return null;
}
/** Sources and circuits are independently evaluated; no wall-clock or external device access. */
export function evaluatePower(project:Project):PowerResult {
 const mode=project.powerSettings?.mode||'legacy',sun=project.night?0:clamp(project.powerSettings?.solarPercent??70,0,100);
 const ordered=[...project.devices].sort((a,b)=>a.id.localeCompare(b.id));
 const byId=new Map(ordered.map(d=>[d.id,d]));
 const devices:Record<string,PowerDeviceStatus>={},cables:Record<string,PowerCableStatus>={},issues:string[]=[];
 const valid=new Map<string,Cable>();
 for(const c of [...project.cables].filter(isPowerCable).sort((a,b)=>a.id.localeCompare(b.id))){
  const a=byId.get(c.a),b=byId.get(c.b),reason=wireReason(c,a,b),voltage=a?outputVoltage(a):0;
  const limit=voltage*currentLimit(c),faults=reason?[reason]:[];
  if(!reason)valid.set(c.id,c);
  cables[c.id]={id:c.id,up:!reason,media:c.medium!,voltageV:voltage,watts:0,maxWatts:limit,faults};
  if(reason)issues.push(`Power cable ${c.id.slice(-6)}: ${reason}`);
 }
 const inbound=new Map<string,Cable[]>();
 for(const c of valid.values()){const list=inbound.get(c.b)||[];list.push(c);inbound.set(c.b,list);}
 const loadStatus=(d:Device,draw=0,ok=false):PowerDeviceStatus=>({id:d.id,powered:ok,inputW:draw,outputW:0,availableW:0,
  capacityW:isPowerDevice(d)?configOf(d).ratedW:loadWatts(d,project),chargeWh:isPowerDevice(d)?configOf(d).chargeWh:0,
  capacityWh:isPowerDevice(d)?configOf(d).capacityWh:0,faults:[]});
 for(const d of ordered)devices[d.id]=loadStatus(d);
 if(mode==='legacy'){
  for(const d of ordered){if(isPowerDevice(d))continue;
   const parent=kindaLegacyPower(d,project);devices[d.id]={...devices[d.id],powered:parent,outputW:0,inputW:parent?loadWatts(d,project):0};
  }
 }
 // A source claims a finite output budget. Reservations are atomic per consumer.
 type Ledger=Map<string,number>;
 let committed:Ledger=new Map();
 const cap=(d:Device)=>{
  const k=kind(d),c=configOf(d);if(!configGood(d))return 0;
  if(k==='power-grid')return project.mainsOn?c.ratedW:0;
  if(k==='power-solar')return c.ratedW*sun/100;
  if(k==='power-battery'||k==='power-ups')return c.chargeWh>0?Math.min(c.ratedW,c.dischargeLimitW):0;
  return c.ratedW;
 };
 // This recursion takes a copy of the ledger before trying each upstream supplier,
 // so failed branches cannot consume capacity or allow partial energisation.
 const take=(id:string,requiredW:number,seen:Set<string>,ledger:Ledger,depth:number):Ledger|null=>{
  if(depth>24||seen.has(id)||!validNumber(requiredW)||requiredW<=0)return null;
  const d=byId.get(id);if(!d||!isPowerDevice(d)||!configGood(d))return null;
  const remaining=cap(d)-(ledger.get(`dev:${id}`)||0);
  if(remaining+1e-9<requiredW)return null;
  const base=new Map(ledger);base.set(`dev:${id}`,(base.get(`dev:${id}`)||0)+requiredW);
  const k=kind(d),cfg=configOf(d);
  if(k==='power-grid')return project.mainsOn?base:null;
  if(k==='power-solar')return sun>0?base:null;
  if(k==='power-battery')return cfg.chargeWh>0?base:null;
  const incoming=[...(inbound.get(id)||[])].sort((a,b)=>{
   const score=(c:Cable)=>{const parent=byId.get(c.a);return parent&&kind(parent)==='power-grid'&&project.mainsOn?0:parent&&kind(parent)==='power-ups'&&project.mainsOn?1:parent&&kind(parent)==='power-solar'?2:parent&&kind(parent)==='power-inverter'?4:5;};
   return score(a)-score(b)||a.id.localeCompare(b.id);
  });
  const inputNeeded=requiredW/Math.max(.5,cfg.efficiency)+profile(d.profileId).powerW;
  for(const edge of incoming){
   if(cables[edge.id].maxWatts+1e-9<inputNeeded+(base.get(`wire:${edge.id}`)||0))continue;
   const next=new Map(base);next.set(`wire:${edge.id}`,(next.get(`wire:${edge.id}`)||0)+inputNeeded);
   const found=take(edge.a,inputNeeded,new Set([...seen,id]),next,depth+1);
   if(found)return found;
  }
  // A UPS can supply without grid as long as its internal battery has charge.
  if(k==='power-ups'&&cfg.chargeWh>0&&cfg.dischargeLimitW>=requiredW){base.set(`backup:${id}`,(base.get(`backup:${id}`)||0)+requiredW);return base;}
  return null;
 };
 // Energization without load is distinct from energy allocation. A correctly fed
 // distribution board should show live even before its first consumer is wired.
 const energized=(id:string,seen=new Set<string>()):boolean=>{
  if(seen.has(id))return false;
  const d=byId.get(id);if(!d||!isPowerDevice(d)||!configGood(d)||cap(d)<=0)return false;
  const k=kind(d);
  if(k==='power-grid')return project.mainsOn;
  if(k==='power-solar')return sun>0;
  if(k==='power-battery')return configOf(d).chargeWh>0;
  if(k==='power-ups'&&configOf(d).chargeWh>0)return true;
  for(const c of inbound.get(id)||[])if(energized(c.a,new Set([...seen,id])))return true;
  return false;
 };
 const wired=mode==='wired';
 const consumers=ordered.filter(terminal);
 for(const d of consumers){
  const draw=loadWatts(d,project);if(!d.enabled){devices[d.id].faults.push('Equipment disabled');continue;}
  if(!wired)continue;
  let okay=false;
  const inputs=[...(inbound.get(d.id)||[])].sort((a,b)=>a.id.localeCompare(b.id));
  for(const edge of inputs){
   if((committed.get(`wire:${edge.id}`)||0)+draw>cables[edge.id].maxWatts+1e-9)continue;
   const draft=new Map(committed);draft.set(`wire:${edge.id}`,(draft.get(`wire:${edge.id}`)||0)+draw);
   const next=take(edge.a,draw,new Set([d.id]),draft,0);
   if(next){committed=next;okay=true;break;}
  }
  devices[d.id].powered=okay;devices[d.id].inputW=okay?draw:0;
  if(!okay){devices[d.id].faults.push(`No available ${inputType(d).toUpperCase()} supply, or source/wiring over capacity`);issues.push(`${d.name}: ${devices[d.id].faults[0]}`);}
 }
 let gridDrawW=0,batteryDrawW=0,solarGenerationW=0;
 for(const d of ordered.filter(isPowerDevice)){
  const cfg=configOf(d),use=committed.get(`dev:${d.id}`)||0,k=kind(d);
  const isSource=['power-grid','power-solar','power-battery'].includes(k);
  const live=configGood(d)&&(
   k==='power-grid'?project.mainsOn:
   k==='power-solar'?sun>0:
   k==='power-battery'?cfg.chargeWh>0:
   k==='power-ups'?(use>0||cfg.chargeWh>0||project.mainsOn&&!!(inbound.get(d.id)||[]).length):
   use>0||energized(d.id));
  const note:string[]=[];
  if(!d.enabled)note.push('Device disabled');
  if(cfg.fault!=='none')note.push(`Power device ${cfg.fault}`);
  if(['power-battery','power-ups'].includes(k)&&cfg.chargeWh<=0)note.push('Backup storage exhausted');
  if(k==='power-solar'&&sun===0)note.push('No solar irradiance');
  if(k==='power-grid'&&!project.mainsOn)note.push('Grid outage');
  if(cfg.chargeWh>cfg.capacityWh||cfg.capacityWh<0)note.push('Invalid stored energy');
  devices[d.id]={...devices[d.id],powered:live,inputW:0,outputW:use,availableW:Math.max(0,cap(d)-use),faults:note,source:k==='power-ups'?(committed.get(`backup:${d.id}`)?'battery':'grid'):k==='power-battery'?'battery':k==='power-grid'?'grid':k==='power-solar'?'solar':undefined};
  if(k==='power-grid')gridDrawW+=use;
  if(k==='power-solar')solarGenerationW+=cap(d);
  if(k==='power-battery')batteryDrawW+=use;
  if(k==='power-ups')batteryDrawW+=committed.get(`backup:${d.id}`)||0;
  if(wired&&note.length)issues.push(`${d.name}: ${note.join('; ')}`);
  // Show source capacity even when there are no connected loads.
  if(isSource&&k==='power-solar'&&live)devices[d.id].availableW=cap(d)-use;
 }
 for(const [id,status] of Object.entries(cables)){
  if(!valid.has(id))continue;
  const watts=committed.get(`wire:${id}`)||0;
  status.watts=watts;
  if(watts>status.maxWatts+1e-9){status.up=false;status.faults.push('Over-current limit');}
 }
 let totalLoadW=0;
 for(const d of consumers)if(devices[d.id].powered)totalLoadW+=devices[d.id].inputW;
 const usableBackup=ordered.filter(d=>isPowerDevice(d)&&['power-battery','power-ups'].includes(kind(d))&&configGood(d))
  .reduce((n,d)=>n+configOf(d).chargeWh*configOf(d).efficiency,0);
 const backupW=gridDrawW>0?totalLoadW:Math.max(1,batteryDrawW);
 const estimatedBackupMinutes=backupW>0?usableBackup/backupW*60:0;
 return {mode,devices,cables,issues,totalLoadW,solarGenerationW,gridDrawW,batteryDrawW,estimatedBackupMinutes};
}
function kindaLegacyPower(d:Device,p:Project):boolean{
 const k=kind(d);if(k.startsWith('alarm-')||k.startsWith('access-'))return false;
 if(k==='camera'&&profile(d.profileId).signal!=='analog'&&!profile(d.profileId).wirelessCapable)return false;
 return p.mainsOn&&d.enabled&&(k!=='camera'||d.analogPowerConnected!==false);
}
/** Advances simulation time; finite Wh storage is actually decremented on discharge. */
export function advancePower(p:Project,minutes:number):Project {
 if(!Number.isSafeInteger(minutes)||minutes<1||minutes>1440)throw new Error('Advance power simulation by 1–1440 whole minutes');
 const sim=evaluatePower(p),hours=minutes/60,all=p.devices;
 const wires=Object.values(sim.cables).filter(c=>c.up),connected=(a:string,b:string,media:CableMedia)=>p.cables.some(c=>c.a===a&&c.b===b&&c.medium===media&&wires.some(w=>w.id===c.id));
 const chargers=all.filter(d=>kind(d)==='power-controller'&&configGood(d));
 const updates=all.map(d=>{
  if(!isPowerDevice(d)||!d.powerConfig||!configGood(d))return d;
  const cfg=d.powerConfig,k=kind(d);let charge=cfg.chargeWh;
  if(k==='power-battery'){
   const discharging=(sim.devices[d.id]?.outputW||0)>0;
   const outW=sim.devices[d.id]?.outputW||0;
   charge=Math.max(0,charge-outW*hours/Math.max(0.5,cfg.efficiency));
   // Solar charge: solar panels -> charge controller -> battery (all live valid cables).
   const solarW=chargers.filter(c=>connected(c.id,d.id,'power-dc')&&p.powerSettings?.mode==='wired').reduce((sum,c)=>{
    const panels=all.filter(s=>kind(s)==='power-solar'&&configGood(s)&&!p.night&&connected(s.id,c.id,'power-pv'));
    const pv=panels.reduce((n,s)=>n+configOf(s).ratedW*(p.powerSettings?.solarPercent??70)/100,0);
    return sum+Math.min(pv*configOf(c).efficiency,configOf(c).ratedW);
   },0);
   charge=Math.min(cfg.capacityWh,charge+Math.min(Math.max(0,solarW),cfg.chargeLimitW)*hours*cfg.efficiency);
  }
  if(k==='power-ups'){
   const connectedToAC=(p.cables||[]).some(c=>c.b===d.id&&c.medium==='power-ac'&&sim.cables[c.id]?.up&&sim.devices[c.a]?.powered);
   const loadW=sim.devices[d.id]?.outputW||0;
   if(p.mainsOn&&connectedToAC&&sim.devices[d.id]?.source!=='battery')charge=Math.min(cfg.capacityWh,charge+cfg.chargeLimitW*hours*cfg.efficiency);
   else if(sim.devices[d.id]?.source==='battery')charge=Math.max(0,charge-loadW*hours/Math.max(0.5,cfg.efficiency));
  }
  return {...d,powerConfig:{...cfg,chargeWh:clamp(charge,0,cfg.capacityWh)}};
 });
 const when=new Date().toISOString();
 return {...p,devices:updates,powerSettings:{mode:p.powerSettings?.mode||'legacy',solarPercent:p.powerSettings?.solarPercent??70,
   virtualMinutes:(p.powerSettings?.virtualMinutes||0)+minutes},updatedAt:when,
  events:[...p.events,{id:`power-${crypto.randomUUID()}`,at:when,kind:'info' as const,recorded:false,message:`Power clock advanced ${minutes} min; battery/UPS energy recalculated` }].slice(-250)};
}
export type PowerFault='grid'|'solar'|'battery'|'ups'|'inverter'|'breaker'|'wire'|'overload'|'reset';
export function injectPowerFault(p:Project,fault:PowerFault):Project {
 let next=p,description='';
 const chosen=(kindId:string)=>p.devices.find(d=>kind(d)===kindId);
 const target=fault==='solar'?chosen('power-solar'):fault==='battery'?chosen('power-battery'):fault==='ups'?chosen('power-ups'):
  fault==='inverter'?chosen('power-inverter'):fault==='breaker'?chosen('power-ac-panel'):fault==='overload'?chosen('power-ups'):undefined;
 if(fault==='grid'){next={...p,mainsOn:false};description='Grid outage simulated';}
 else if(fault==='wire'){
  const cable=p.cables.find(c=>isPowerCable(c)&&c.connected);
  if(cable){next={...p,cables:p.cables.map(c=>c.id===cable.id?{...c,connected:false}:c)};description='Power cable disconnected';}
 }else if(fault==='reset'){
  next={...p,mainsOn:true,devices:p.devices.map(d=>d.powerConfig?{...d,powerConfig:{...d.powerConfig,fault:'none' as const}}:d),
   cables:p.cables.map(c=>isPowerCable(c)?{...c,connected:true}:c)};description='Virtual breaker/fault flags reset (charge is not fabricated)';
 }else if(target){
  next={...p,devices:p.devices.map(d=>d.id!==target.id?d:{...d,powerConfig:{...configOf(d),
   ...(fault==='battery'?{chargeWh:0}:fault==='overload'?{ratedW:5}:fault==='solar'?{fault:'failed' as const}:fault==='breaker'?{fault:'tripped' as const}:{fault:'failed' as const})}})};
  description=`${target.name}: ${fault} fault injected`;
 }
 if(!description)return p;
 const at=new Date().toISOString();return {...next,updatedAt:at,events:[...p.events,{id:`power-${crypto.randomUUID()}`,at,kind:'fault' as const,recorded:false,message:description}].slice(-250)};
}
