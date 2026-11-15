/**
 * Feature 20: validated, documented format for adding device profiles. Every profile must carry traceable
 * source metadata (HTTPS source, edition, variant, sourced facts and limitations) and is always an educational
 * simulation: prices are forced to 0 (the learner enters a quotation) and the pack must attest it is not
 * real firmware. Profiles used by a project are embedded in it so it reopens on any machine.
 */
import type {DeviceKind,Profile,Project} from '../domain/types.js';
import {PROFILES} from '../domain/catalog.js';

export const PACK_FORMAT='securitylab.profile-pack';
export const ATTESTATION='educational-simulation-not-real-firmware';
export const MAX_PACK_PROFILES=40;
const ALLOWED_KINDS:DeviceKind[]=['camera','nvr','dvr','switch','router','ap','server','alarm-sensor','alarm-keypad','alarm-output','access-reader','access-lock','access-exit'];
const SENSOR_TYPES=['pir','door','window','glass','vibration','beam','panic','smoke','heat','callpoint','fence'];
const txt=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const num=(v:unknown,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const int=(v:unknown,lo:number,hi:number)=>num(v,lo,hi)&&Number.isInteger(v);

export type PackProfile=Record<string,unknown>;
export type ProfilePack={format:typeof PACK_FORMAT;version:1;attestation:typeof ATTESTATION;profiles:PackProfile[]};

export function validateSourceUrl(u:unknown):string{
 if(typeof u!=='string'||u.length>300)throw new Error('sourceUrl must be a string of up to 300 characters');
 let url:URL;try{url=new URL(u);}catch{throw new Error('sourceUrl is not a valid URL');}
 if(url.protocol!=='https:')throw new Error('sourceUrl must use https://');
 if(url.username||url.password)throw new Error('sourceUrl must not contain credentials');
 if(url.hostname==='localhost'||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':')||!url.hostname.includes('.'))throw new Error('sourceUrl must be a public documentation host name');
 return url.toString();
}
/** Validate one pack profile and return the Profile (never registers). Throws a specific message. */
export function buildProfile(input:unknown):Profile{
 const p=input as Record<string,any>;
 if(!p||typeof p!=='object')throw new Error('Profile must be an object');
 const id=p.id;
 if(typeof id!=='string'||!/^pack-[a-z0-9-]{3,60}$/.test(id))throw new Error('Profile id must look like "pack-my-model" (lowercase letters, digits, dashes) and is immutable');
 if(PROFILES.some(x=>x.id===id&&!x.manufacturerSpec?.sourceTitle?.startsWith('[pack]')))throw new Error(`${id} clashes with a built-in profile`);
 if(!ALLOWED_KINDS.includes(p.kind))throw new Error(`${id}: kind must be one of ${ALLOWED_KINDS.join(', ')}`);
 if(!txt(p.name,80)||!txt(p.model,60)||!txt(p.manufacturer,60))throw new Error(`${id}: name, model and manufacturer are required`);
 if(String(p.manufacturer).trim().toLowerCase()==='securitylab')throw new Error(`${id}: manufacturer must be the real maker, not SecurityLab`);
 if(!num(p.powerW,0,2000))throw new Error(`${id}: powerW must be 0-2000`);
 const ethernetPorts=p.ethernetPorts??0,poePorts=p.poePorts??0,poeBudgetW=p.poeBudgetW??0,nvrChannels=p.nvrChannels??0;
 if(!int(ethernetPorts,0,48)||!int(poePorts,0,48)||poePorts>ethernetPorts)throw new Error(`${id}: ports must be whole numbers with poePorts <= ethernetPorts <= 48`);
 if(!num(poeBudgetW,0,1500)||!int(nvrChannels,0,128))throw new Error(`${id}: invalid PoE budget or channel count`);
 if(p.kind==='camera'&&(p.signal??'ip')!=='ip'&&p.signal!=='analog')throw new Error(`${id}: camera signal must be ip or analog`);
 const defaultFov=p.defaultFov??0,defaultRange=p.defaultRange??0;
 if(!num(defaultFov,0,360)||!num(defaultRange,0,2000))throw new Error(`${id}: invalid field of view or range`);
 if(p.kind==='alarm-sensor'&&!SENSOR_TYPES.includes(p.alarmSensorType))throw new Error(`${id}: alarm sensors need alarmSensorType (${SENSOR_TYPES.join(', ')})`);
 if(p.kind==='access-reader'&&!['card','pin','biometric'].includes(p.accessReaderMethod))throw new Error(`${id}: readers need accessReaderMethod card, pin or biometric`);
 if(!Array.isArray(p.protocols)||p.protocols.length>10||p.protocols.some((x:unknown)=>!txt(x,60)))throw new Error(`${id}: protocols must be up to 10 short strings`);
 const m=p.manufacturerSpec;
 if(!m||typeof m!=='object')throw new Error(`${id}: manufacturerSpec (source metadata) is required`);
 const sourceUrl=validateSourceUrl(m.sourceUrl);
 if(!txt(m.sourceTitle,160)||!txt(m.edition,60)||!txt(m.variant,100))throw new Error(`${id}: sourceTitle, edition and variant are required`);
 if(typeof m.documentedAt!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m.documentedAt)||Number.isNaN(Date.parse(m.documentedAt)))throw new Error(`${id}: documentedAt must be YYYY-MM-DD`);
 if(Date.parse(m.documentedAt)>Date.now()+86_400_000)throw new Error(`${id}: documentedAt is in the future`);
 for(const k of ['sourcedFacts','limitations'] as const)if(!Array.isArray(m[k])||m[k].length<1||m[k].length>20||m[k].some((x:unknown)=>!txt(x,300)))throw new Error(`${id}: ${k} needs 1-20 entries of up to 300 characters`);
 if(m.simulatedFeatures!==undefined&&(!Array.isArray(m.simulatedFeatures)||m.simulatedFeatures.length>20||m.simulatedFeatures.some((x:unknown)=>!txt(x,200))))throw new Error(`${id}: invalid simulatedFeatures`);
 if(m.status!==undefined&&!['simulation','reference-only'].includes(m.status))throw new Error(`${id}: status must be simulation or reference-only`);
 const prof:Profile={
  id,name:p.name.trim(),kind:p.kind,manufacturer:p.manufacturer.trim(),model:p.model.trim(),powerW:p.powerW,costGhs:0,
  ethernetPorts,poePorts,poeBudgetW,maxPortW:p.maxPortW??0,nvrChannels,defaultStorageGB:p.defaultStorageGB??0,defaultFov,defaultRange,
  protocols:[...p.protocols],simulated:true,
  ...(p.kind==='camera'?{signal:p.signal??'ip',formFactor:p.formFactor,megapixels:p.megapixels,maxBitrateMbps:p.maxBitrateMbps,irRange:p.irRange}:{}),
  ...(p.alarmSensorType?{alarmSensorType:p.alarmSensorType,alarmWirePorts:1}:{}),
  ...(p.accessReaderMethod?{accessReaderMethod:p.accessReaderMethod}:{}),
  ...(p.kind==='alarm-keypad'||p.kind==='alarm-output'?{alarmWirePorts:1}:{}),
  manufacturerSpec:{edition:m.edition,variant:m.variant,documentedAt:m.documentedAt,status:m.status??'simulation',sourceUrl,sourceTitle:`[pack] ${m.sourceTitle}`,
   sourcedFacts:[...m.sourcedFacts],simulatedFeatures:[...(m.simulatedFeatures??[])],limitations:[...m.limitations],priceBasis:'user-quote'},
 } as Profile;
 return prof;
}
const SOURCES=new Map<string,PackProfile>();
export const packSourceOf=(id:string)=>SOURCES.get(id);
export function registerProfile(src:unknown):Profile{
 const prof=buildProfile(src),i=PROFILES.findIndex(x=>x.id===prof.id);
 if(i>=0){if(!PROFILES[i].manufacturerSpec?.sourceTitle?.startsWith('[pack]'))throw new Error(`${prof.id} clashes with a built-in profile`);PROFILES[i]=prof;}
 else PROFILES.push(prof);
 SOURCES.set(prof.id,structuredClone(src as PackProfile));return prof;
}
export function loadProfilePack(text:string):Profile[]{
 if(text.length>1_000_000)throw new Error('Profile pack too large');
 let doc:any;try{doc=JSON.parse(text);}catch{throw new Error('Profile pack is not valid JSON');}
 if(!doc||doc.format!==PACK_FORMAT||doc.version!==1||!Array.isArray(doc.profiles)||doc.profiles.length<1||doc.profiles.length>MAX_PACK_PROFILES)throw new Error('Not a SecurityLab profile pack (format/version/profiles)');
 if(doc.attestation!==ATTESTATION)throw new Error(`The pack must state attestation "${ATTESTATION}": profiles are simulations, not real firmware`);
 const built=doc.profiles.map(buildProfile); // validate everything first
 if(new Set(built.map((b:Profile)=>b.id)).size!==built.length)throw new Error('Duplicate profile id in pack');
 return doc.profiles.map(registerProfile);
}
export function exportProfilePack(profiles:PackProfile[]):string{return JSON.stringify({format:PACK_FORMAT,version:1,attestation:ATTESTATION,profiles},null,2);}

/** Definitions of pack profiles used by the project's devices, for embedding in the project file. */
export function usedPackProfiles(p:Project):PackProfile[]{
 const ids=[...new Set(p.devices.map(d=>d.profileId).filter(id=>id.startsWith('pack-')))];
 return ids.map(id=>packSourceOf(id)).filter((x):x is PackProfile=>!!x);
}
export function withEmbeddedProfiles(p:Project):Project{
 const used=usedPackProfiles(p);
 if(!used.length)return p.profilePack?{...p,profilePack:undefined}:p;
 if(p.profilePack&&JSON.stringify(p.profilePack)===JSON.stringify(used))return p;
 return {...p,profilePack:used};
}
export const SAMPLE_PROFILE:PackProfile={id:'pack-example-ip-camera',kind:'camera',name:'Example IP Camera (documented)',manufacturer:'Example Maker',model:'EX-IPC-100',powerW:6,ethernetPorts:1,poePorts:0,signal:'ip',
 defaultFov:90,defaultRange:200,megapixels:4,maxBitrateMbps:8,irRange:30,protocols:['IPv4','PoE 802.3af'],
 manufacturerSpec:{edition:'2026-01',variant:'EX-IPC-100 (4 MP)',documentedAt:'2026-01-15',status:'simulation',sourceUrl:'https://www.example.com/docs/ex-ipc-100-datasheet.pdf',sourceTitle:'EX-IPC-100 datasheet',
  sourcedFacts:['4 MP sensor','PoE 802.3af, 6 W typical'],simulatedFeatures:['IP video to NVR','PoE draw'],limitations:['Educational simulation only; no real firmware, ONVIF or codec behaviour']}};
