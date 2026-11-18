/**
 * Feature 5: cable engineering checks. Copper resistance uses standard annealed-copper values
 * (ohms per km at 20 C). Results are design checks for training, not certification.
 */
import type {Cable,Device,Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';

/** Ohms per metre, single conductor, copper at 20 C. */
export const OHM_PER_M:Record<number,number>={26:0.1337,24:0.0842,22:0.0530,20:0.0333,18:0.0210,16:0.0132,14:0.00829};
export const ETHERNET_MAX_M=100;
export const COAX_RG59_MAX_M=300; // typical analog-HD practical limit; varies with standard
export const POE_MIN_PD_VOLTS=37; // 802.3af minimum at the powered device

export function dcDrop(voltage:number,currentA:number,lengthM:number,awg:number){
 const r=OHM_PER_M[awg];
 if(r===undefined)throw new Error(`Unsupported AWG ${awg}`);
 if(!(voltage>0)||currentA<0||lengthM<0)throw new Error('Invalid supply, current or length');
 const loopOhms=2*lengthM*r,dropV=currentA*loopOhms;
 return {loopOhms,dropV,atLoadV:voltage-dropV,dropPercent:dropV/voltage*100,ok:dropV/voltage<=0.1};
}
/** Smallest standard AWG (largest number = thinnest) that keeps the drop within maxPercent. */
export function minimumAwg(voltage:number,currentA:number,lengthM:number,maxPercent=10):number|null{
 for(const awg of Object.keys(OHM_PER_M).map(Number).sort((a,b)=>b-a)){
  if(dcDrop(voltage,currentA,lengthM,awg).dropPercent<=maxPercent)return awg;
 }
 return null;
}
/**
 * PoE delivery over a twisted-pair run. Two pairs (802.3af/at): both conductors of each pair in parallel,
 * so loop resistance = length * ohmPerM (24 AWG default). Solves P = I*(Vs - I*R) for the powered device.
 */
export function poeDelivery(pdPowerW:number,lengthM:number,sourceVolts=50,awg=24){
 const r=OHM_PER_M[awg]*lengthM; // loop resistance with 2 parallel conductors per leg
 if(pdPowerW<=0)return {ok:true,currentA:0,pdVolts:sourceVolts,lossW:0,reason:'No load'};
 const disc=sourceVolts*sourceVolts-4*r*pdPowerW;
 if(disc<0)return {ok:false,currentA:NaN,pdVolts:NaN,lossW:NaN,reason:'Cable resistance too high to deliver this power'};
 const i=r===0?pdPowerW/sourceVolts:(sourceVolts-Math.sqrt(disc))/(2*r),pdVolts=sourceVolts-i*r;
 const lossW=i*i*r,ok=pdVolts>=POE_MIN_PD_VOLTS&&lengthM<=ETHERNET_MAX_M;
 return {ok,currentA:i,pdVolts,lossW,reason:ok?'Within limits':lengthM>ETHERNET_MAX_M?'Run exceeds the 100 m Ethernet limit':`PD voltage ${pdVolts.toFixed(1)} V below ${POE_MIN_PD_VOLTS} V`};
}

export type CableFinding={cableId:string;medium:string;lengthM:number;ok:boolean;messages:string[];pdVolts?:number};
export function analyseCables(project:Project,units=project.unitsPerMeter??10):CableFinding[]{
 const byId=new Map(project.devices.map(d=>[d.id,d]));
 return project.cables.map(c=>{
  const a=byId.get(c.a),b=byId.get(c.b);
  const straight=a&&b?Math.hypot(a.x-b.x,a.y-b.y)/units:0;
  const length=Math.max(c.lengthMeters||0,straight);
  const medium=c.medium??'ethernet',messages:string[]=[];let ok=true,pdVolts:number|undefined;
  if(!c.connected){ok=false;messages.push('Cable is disconnected');}
  if(c.termination==='open'){ok=false;messages.push('Continuity tester: open conductor');}
  if(c.termination==='short'){ok=false;messages.push('Continuity tester: short circuit');}
  if(c.termination==='split-pair'&&medium==='ethernet'){ok=false;messages.push('Wire-map tester: split pair');}
  if(medium==='ethernet'){
   if(length>ETHERNET_MAX_M){ok=false;messages.push(`Length ${length.toFixed(0)} m exceeds the ${ETHERNET_MAX_M} m Ethernet limit`);}
   const load=poeLoad(a,b);
   if(load>0){const r=poeDelivery(load,length);pdVolts=Number.isFinite(r.pdVolts)?r.pdVolts:undefined;if(!r.ok){ok=false;messages.push(`PoE: ${r.reason}`);}}
  }else if(medium==='coax'&&length>COAX_RG59_MAX_M){ok=false;messages.push(`Coax run ${length.toFixed(0)} m exceeds ${COAX_RG59_MAX_M} m`);}
  else if(medium==='alarm'&&length>150){messages.push('Long alarm loop: check loop resistance against the panel specification');}
  if(!messages.length)messages.push('OK');
  return {cableId:c.id,medium,lengthM:length,ok,messages,pdVolts};
 });
}
function poeLoad(a?:Device,b?:Device):number{
 const dev=[a,b].find(d=>d&&profile(d.profileId).kind==='camera'&&profile(d.profileId).signal!=='analog');
 const sw=[a,b].find(d=>d&&profile(d.profileId).kind==='switch');
 return dev&&sw?profile(dev.profileId).powerW:0;
}
export type {Cable};
