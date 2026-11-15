import {profile} from '../domain/catalog.js';
import type {Cable,Device,Project,Profile} from '../domain/types.js';

/**
 * Explainable port guidance for the existing deterministic teaching engine.
 * Port choices model virtual switch/NVR/camera interfaces, NOT manufacturer firmware.
 * Previously imported cables without explicit port numbers are still supported.
 */
export type PortChoice = {number:number;label:string;poe:boolean;usedBy:string|null;available:boolean};
export type SuggestedPorts = {ok:boolean;aPort?:number;bPort?:number;reason:string;notes:string[]};

const ethernet = (c:Cable)=> (c.medium??'ethernet')==='ethernet';
const poeNumbers=(p:Profile)=>p.manufacturerSpec?.poePortNumbers??Array.from({length:p.poePorts},(_,i)=>i+1);
const connectionIsCamera=(p:Profile)=>p.kind==='camera'&&p.signal!=='analog';
const isSwitch=(p:Profile)=>p.kind==='switch';
const order=(p:Profile,other?:Profile)=>{
 const all=Array.from({length:p.ethernetPorts},(_,i)=>i+1),poe=poeNumbers(p);
 if(!isSwitch(p))return all;
 // Reserve PoE sockets for cameras whenever possible. Uplink/recorder traffic
 // should normally occupy non-PoE sockets to avoid wasting scarce outputs.
 const preferPoE=other?connectionIsCamera(other):false;
 return preferPoE?[...all.filter(n=>poe.includes(n)),...all.filter(n=>!poe.includes(n))]
  :[...all.filter(n=>!poe.includes(n)),...all.filter(n=>poe.includes(n))];
};

/** Explicit assignments win; legacy automatic assignments are inferred for UI guidance. */
export function usedEthernetPorts(project:Project,deviceId:string,exceptCableId?:string):Map<number,string>{
 const device=project.devices.find(d=>d.id===deviceId);
 if(!device)return new Map();
 const p=profile(device.profileId),occupied=new Map<number,string>();
 const links=project.cables.filter(c=>c.id!==exceptCableId&&ethernet(c)&&c.connected&&(c.a===deviceId||c.b===deviceId));
 // Reserve explicitly configured ports before assigning any legacy auto ports.
 for(const cable of links){
  const n=cable.a===deviceId?cable.aPort:cable.bPort;
  if(n!==undefined&&n>=1&&n<=p.ethernetPorts&&!occupied.has(n))occupied.set(n,cable.id);
 }
 for(const cable of links.filter(c=>(c.a===deviceId?c.aPort:c.bPort)===undefined).sort((a,b)=>a.id.localeCompare(b.id))){
  const other=project.devices.find(d=>d.id===(cable.a===deviceId?cable.b:cable.a));
  const candidate=order(p,other?profile(other.profileId):undefined).find(n=>!occupied.has(n));
  if(candidate!==undefined)occupied.set(candidate,cable.id);
 }
 return occupied;
}

export function ethernetPortChoices(project:Project,deviceId:string,exceptCableId?:string,peerId?:string):PortChoice[]{
 const device=project.devices.find(d=>d.id===deviceId);if(!device)return [];
 const p=profile(device.profileId),used=usedEthernetPorts(project,deviceId,exceptCableId);
 const poe=poeNumbers(p),peer=project.devices.find(d=>d.id===peerId);
 return order(p,peer?profile(peer.profileId):undefined).map(number=>{
  const usedBy=used.get(number)??null;
  return {number,label:'Port '+number+(poe.includes(number)?' · PoE out':' · data')+(usedBy?' · occupied':''),poe:poe.includes(number),usedBy,available:!usedBy};
 });
}

export function suggestEthernetPorts(project:Project,a:Device,b:Device):SuggestedPorts{
 const pa=profile(a.profileId),pb=profile(b.profileId),notes:string[]=[];
 const infrastructure=['switch','router','ap'];
 if(!infrastructure.includes(pa.kind)&&!infrastructure.includes(pb.kind))
  return {ok:false,reason:'Ethernet needs a switch, router or access point between endpoint devices.',notes};
 if(pa.ethernetPorts<1||pb.ethernetPorts<1)return {ok:false,reason:'One endpoint has no virtual Ethernet interface.',notes};
 const ac=ethernetPortChoices(project,a.id,undefined,b.id),bc=ethernetPortChoices(project,b.id,undefined,a.id);
 const ap=ac.find(x=>x.available),bp=bc.find(x=>x.available);
 if(!ap||!bp)return {ok:false,reason:'No unused virtual Ethernet ports remain on '+(!ap?a.name:b.name)+'. Disconnect a cable or add a suitable switch.',notes};
 if(isSwitch(pa)&&connectionIsCamera(pb)&&!ap.poe)notes.push(a.name+' port '+ap.number+' does not supply PoE; the camera may need a different port or its own modeled power input.');
 if(isSwitch(pb)&&connectionIsCamera(pa)&&!bp.poe)notes.push(b.name+' port '+bp.number+' does not supply PoE; the camera may need a different port or its own modeled power input.');
 const camera=connectionIsCamera(pa)?a:connectionIsCamera(pb)?b:undefined;
 const switchDevice=isSwitch(pa)?a:isSwitch(pb)?b:undefined;
 if(camera&&switchDevice){
  const switchSpec=profile(switchDevice.profileId),power=profile(camera.profileId).powerW;
  if(switchSpec.maxPortW>0&&power>switchSpec.maxPortW)notes.push('Camera demand exceeds the virtual switch per-port PoE rating.');
  if(switchSpec.poeBudgetW>0&&power>switchSpec.poeBudgetW)notes.push('Camera demand exceeds the modeled switch total PoE budget.');
 }
 notes.push('Port selection is simulated. It does not prove cable compliance, vendor compatibility or measured power output.');
 return {ok:true,aPort:ap.number,bPort:bp.number,reason:'Virtual ports available',notes};
}

/** A potential cable change is checked before committing an irreversible-looking UI edit. */
export function validatePortChange(project:Project,cable:Cable,side:'a'|'b',number:number):string|null{
 const deviceId=cable[side],device=project.devices.find(d=>d.id===deviceId);
 if(!device)return 'The device no longer exists.';
 if(number===0)return null; // legacy automatic assignment
 const spec=profile(device.profileId);
 if(!Number.isInteger(number)||number<1||number>spec.ethernetPorts)return 'Port is outside the device virtual port range.';
 const used=usedEthernetPorts(project,deviceId,cable.id);
 if(used.has(number))return 'Port '+number+' is already occupied by another cable.';
 return null;
}
