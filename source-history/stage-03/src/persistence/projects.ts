import type {Project} from '../domain/types.js';
import {PROFILES} from '../domain/catalog.js';
import {SCENARIOS} from '../scenarios/index.js';

/** Same DB name as Stage 1. Upgrade uses existing keyPath and does not rewrite existing rows. */
const DB='securitylab-local-v1',STORE='projects',BACKUPS='backups';
const VERSION=2,MAX_BACKUPS=12;
export class ConflictError extends Error {constructor(message='This project was changed in another tab. Export your current draft or reload the newest saved version.') {super(message);this.name='ConflictError';}}
export interface StoredProject {id:string;project:Project;revision:number;updatedAt:string;writerId:string;}
export interface BackupRecord {key:string;projectId:string;revision:number;at:string;project:Project;}
function isStored(value:unknown):value is StoredProject{return !!value&&typeof value==='object'&&'project' in value&&'revision' in value;}
function record(raw:unknown):StoredProject|undefined{
 if(raw===undefined)return;
 if(!raw||typeof raw!=='object')throw new Error('Corrupt saved SecurityLab record');
 if(isStored(raw)){
  const project=validateProject(raw.project);
  if(project.id!==raw.id||!Number.isSafeInteger(raw.revision)||raw.revision<1)throw new Error('Invalid saved project revision or identifier');
  return {id:raw.id,project,revision:raw.revision,updatedAt:raw.updatedAt,writerId:raw.writerId};
 }
 const p=validateProject(raw);
 return {id:p.id,project:p,revision:0,updatedAt:p.updatedAt,writerId:'stage1-legacy'};
}
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB is unavailable in this browser'));return;}
  const request=indexedDB.open(DB,VERSION);
  request.onupgradeneeded=()=>{
   const db=request.result;
   if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
   if(!db.objectStoreNames.contains(BACKUPS)){
    const b=db.createObjectStore(BACKUPS,{keyPath:'key'});
    b.createIndex('projectId','projectId',{unique:false});
   }
  };
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error('Storage unavailable'));
  request.onblocked=()=>reject(new Error('Database upgrade blocked by another open tab; close older SecurityLab tabs and retry'));
 });
}
async function useTx<T>(stores:string[],mode:IDBTransactionMode,work:(tx:IDBTransaction,finish:(v:T)=>void,fail:(e:Error)=>void)=>void):Promise<T>{
 const db=await openDb();
 return new Promise<T>((resolve,reject)=>{
  let value:T;let reason:Error|undefined;let ended=false;
  let tx:IDBTransaction;
  try{tx=db.transaction(stores,mode);}catch(e){db.close();reject(e);return;}
  const fail=(e:Error)=>{reason=e;try{tx.abort();}catch{ /* already ended */ }};
  const close=()=>{if(!ended){ended=true;db.close();}};
  tx.oncomplete=()=>{close();resolve(value);};
  tx.onerror=()=>{reason??=tx.error||new Error('IndexedDB transaction failed');};
  tx.onabort=()=>{close();reject(reason||tx.error||new Error('IndexedDB transaction aborted'));};
  try{work(tx,v=>{value=v;},fail);}catch(e){fail(e instanceof Error?e:new Error(String(e)));}
 });
}
export async function getProjectRecord(id:string):Promise<StoredProject|undefined>{
 return useTx([STORE],'readonly',(tx,finish,fail)=>{
  const r=tx.objectStore(STORE).get(id);
  r.onsuccess=()=>{try{finish(record(r.result));}catch(e){fail(e as Error);}};
 });
}
export async function getProject(id:string):Promise<Project|undefined>{return (await getProjectRecord(id))?.project;}
export async function listProjectRecords():Promise<StoredProject[]>{
 return useTx([STORE],'readonly',(tx,finish,fail)=>{
  const req=tx.objectStore(STORE).getAll();
  req.onsuccess=()=>{try{finish((req.result as unknown[]).map(v=>record(v)!).sort((a,b)=>b.project.updatedAt.localeCompare(a.project.updatedAt)));}catch(e){fail(e as Error);}};
 });
}
export async function listProjects():Promise<Project[]>{return (await listProjectRecords()).map(r=>r.project);}
/** Atomic compare-and-swap with a same-transaction copy of the previous revision. */
export async function saveProject(input:Project,expectedRevision:number,writerId='local'):Promise<number>{
 const project=validateProject(input);
 if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw new Error('Expected revision must be a nonnegative integer');
 return useTx([STORE,BACKUPS],'readwrite',(tx,finish,fail)=>{
  const s=tx.objectStore(STORE),b=tx.objectStore(BACKUPS),request=s.get(project.id);
  request.onsuccess=()=>{
   let current:StoredProject|undefined;
   try{current=record(request.result);}catch(e){fail(e as Error);return;}
   const actual=current?.revision??0;
   if(actual!==expectedRevision){fail(new ConflictError());return;}
   const revision=actual+1;
   if(current){
    const at=new Date().toISOString();
    const key=`${project.id}:${String(actual).padStart(12,'0')}:${crypto.randomUUID()}`;
    const backup:BackupRecord={key,projectId:project.id,revision:actual,at,project:current.project};
    b.put(backup);
   }
   s.put({id:project.id,project,revision,updatedAt:project.updatedAt,writerId} satisfies StoredProject);
   // Keep a bounded, recoverable snapshot history per project without asynchronous gaps.
   const ix=b.index('projectId');
   const keys=ix.getAllKeys(IDBKeyRange.only(project.id));
   keys.onsuccess=()=>{
    const all=(keys.result as IDBValidKey[]).sort((x,y)=>String(x).localeCompare(String(y)));
    for(const old of all.slice(0,Math.max(0,all.length-MAX_BACKUPS)))b.delete(old);
   };
   finish(revision);
  };
 });
}
export async function listProjectBackups(projectId:string):Promise<BackupRecord[]>{
 return useTx([BACKUPS],'readonly',(tx,finish,fail)=>{
  const req=tx.objectStore(BACKUPS).index('projectId').getAll(IDBKeyRange.only(projectId));
  req.onsuccess=()=>{try{finish((req.result as BackupRecord[]).map(b=>({...b,project:validateProject(b.project)})).sort((a,b)=>b.revision-a.revision));}catch(e){fail(e as Error);}};
 });
}
export async function removeProject(id:string,expectedRevision:number):Promise<void>{
 return useTx([STORE,BACKUPS],'readwrite',(tx,finish,fail)=>{
  const s=tx.objectStore(STORE),req=s.get(id);
  req.onsuccess=()=>{
   let current:StoredProject|undefined;
   try{current=record(req.result);}catch(e){fail(e as Error);return;}
   if(!current||current.revision!==expectedRevision){fail(new ConflictError('Project changed before deletion; reopen the saved list and try again.'));return;}
   // Explicit deletion removes current record AND its associated history.
   s.delete(id);
   const b=tx.objectStore(BACKUPS),keys=b.index('projectId').getAllKeys(IDBKeyRange.only(id));
   keys.onsuccess=()=>{for(const key of keys.result)b.delete(key);};
   finish(undefined);
  };
 });
}
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1000000;
const txt=(s:unknown)=>typeof s==='string'&&s.length<500;
const idTxt=(s:unknown)=>txt(s)&&String(s).trim().length>0;
const validPoint=(p:Record<string,unknown>)=>finite(p.x)&&finite(p.y);
/** Import boundary: reject invalid references, unsafe image URLs, unknown profiles, corrupt numeric values. */
/** Stage 1 schema upgrade is lossless: geometry, devices, event evidence and IDs stay unchanged. */
export function migrateProject(input:unknown):Project{
 if(!input||typeof input!=='object')throw new Error('Expected a SecurityLab project JSON object');
 const p=input as Record<string,unknown>;
 if(p.schemaVersion!==1&&p.schemaVersion!==2)throw new Error('Unsupported SecurityLab project schema version');
 const migrated=structuredClone(p) as unknown as Project;
 if(p.schemaVersion===1){migrated.schemaVersion=2;migrated.assessments??=[];}
 return migrated;
}
export function validateProject(input:unknown):Project{
 input=migrateProject(input);
 if(!input||typeof input!=='object')throw new Error('Expected a SecurityLab project JSON object');
 const p=input as Record<string,unknown>;
 if(p.schemaVersion!==2||!idTxt(p.id)||!idTxt(p.title)||!idTxt(p.scenarioId)||!SCENARIOS.some(s=>s.id===p.scenarioId))throw new Error('Unsupported project format, scenario or schema');
 if(!Array.isArray(p.devices)||!Array.isArray(p.cables)||!Array.isArray(p.rooms)||!Array.isArray(p.walls)||!Array.isArray(p.events)||!Array.isArray(p.targets))throw new Error('Project has missing geometry/equipment fields');
 if(p.devices.length>120||p.cables.length>240||p.walls.length>400||p.rooms.length>200||p.events.length>250||p.targets.length>50)throw new Error('Project exceeds safety limits');
 for(const d of p.devices){
  if(!d||!idTxt(d.id)||!idTxt(d.name)||!PROFILES.some(x=>x.id===d.profileId)||!validPoint(d)||!finite(d.heading)||!finite(d.fov)||!finite(d.range)||!txt(d.ip)||!txt(d.mask)||!txt(d.gateway)||typeof d.enabled!=='boolean'||typeof d.motionEnabled!=='boolean'||typeof d.recordingEnabled!=='boolean')throw new Error('Invalid device record');
  for(const key of ['poeBudgetW','storageGB','usedGB','bitrateMbps'])if(d[key]!==undefined&&!finite(d[key]))throw new Error(`Invalid numeric equipment value: ${key}`);
 }
 const ids=new Set((p.devices as {id:string}[]).map(d=>d.id));
 if(ids.size!==p.devices.length)throw new Error('Duplicate equipment IDs');
 for(const c of p.cables){if(!c||!idTxt(c.id)||!idTxt(c.a)||!idTxt(c.b)||!ids.has(c.a)||!ids.has(c.b)||!finite(c.lengthMeters)||typeof c.connected!=='boolean')throw new Error('Invalid cable endpoint or length');}
 if(new Set((p.cables as {id:string}[]).map(c=>c.id)).size!==p.cables.length)throw new Error('Duplicate cable IDs');
 for(const w of p.walls){if(!w||!idTxt(w.id)||!['wall','door','window'].includes(w.kind)||!['x1','x2','y1','y2'].every(k=>finite(w[k]))||(w.roomId!==undefined&&!idTxt(w.roomId)))throw new Error('Invalid wall/door record');}
 for(const r of p.rooms){if(!r||!idTxt(r.id)||!txt(r.name)||!validPoint(r)||!finite(r.w)||!finite(r.h))throw new Error('Invalid room record');}
 const roomIds=new Set((p.rooms as {id:string}[]).map(r=>r.id));
 for(const wall of p.walls)if(wall.roomId!==undefined&&!roomIds.has(wall.roomId))throw new Error('Wall belongs to unknown room');
 for(const t of p.targets){if(!t||!idTxt(t.id)||!txt(t.name)||!validPoint(t))throw new Error('Invalid target objective');}
 if(p.floorplanImage!==undefined&&(typeof p.floorplanImage!=='string'||p.floorplanImage.length>2_800_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.floorplanImage)))throw new Error('Unsafe or oversized floor-plan image');
 if(p.unitsPerMeter!==undefined&&(!finite(p.unitsPerMeter)||p.unitsPerMeter<1||p.unitsPerMeter>100))throw new Error('Invalid property scale');
 if(p.siteElements!==undefined){
  if(!Array.isArray(p.siteElements)||p.siteElements.length>150)throw new Error('Too many site annotations');
  for(const marker of p.siteElements)if(!marker||!idTxt(marker.id)||!txt(marker.label)||!['entrance','gate','label'].includes(marker.kind)||!validPoint(marker))throw new Error('Invalid site annotation');
  if(new Set(p.siteElements.map((m:{id:string})=>m.id)).size!==p.siteElements.length)throw new Error('Duplicate site annotation IDs');
 }
 if(p.floorplanSettings!==undefined){const f=p.floorplanSettings;if(!f||!['x','y','width','height','opacity'].every(k=>finite(f[k]))||f.width<20||f.width>3000||f.height<20||f.height>1950||f.x < -1000||f.x>1000||f.y < -650||f.y >650||f.opacity<0||f.opacity>1||typeof f.locked!=='boolean')throw new Error('Invalid image reference transform');}
 if(p.assessments!==undefined){
  if(!Array.isArray(p.assessments)||p.assessments.length>50)throw new Error('Invalid assessment history');
  for(const a of p.assessments){if(!a||!txt(a.id)||!txt(a.at)||!txt(a.scenarioId)||!a.assessment||!Number.isInteger(a.assessment.score)||a.assessment.score<0||a.assessment.score>100||typeof a.assessment.passed!=='boolean'||!Array.isArray(a.assessment.rubric)||!Array.isArray(a.assessment.recommendations))throw new Error('Invalid assessment record');}
 }
 if(typeof p.night!=='boolean'||typeof p.mainsOn!=='boolean'||typeof p.assisted!=='boolean')throw new Error('Invalid simulation state');
 for(const e of p.events)if(!e||!txt(e.id)||!txt(e.at)||!txt(e.message)||!['info','motion','recorded','fault','warning'].includes(e.kind)||typeof e.recorded!=='boolean')throw new Error('Invalid event log');
 if(!txt(p.createdAt)||!txt(p.updatedAt)||!Number.isFinite(Date.parse(String(p.createdAt)))||!Number.isFinite(Date.parse(String(p.updatedAt))))throw new Error('Invalid project timestamps');
 for(const [kind,records] of [['room',p.rooms],['wall',p.walls],['target',p.targets]] as const){
  const entries=records as {id:string}[];
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error(`Duplicate ${kind} IDs`);
 }
 return structuredClone(input as Project);
}
/** Read an individual snapshot; restoration occurs as a new project to avoid clobbering newer work. */
export async function getProjectBackup(key:string):Promise<BackupRecord|undefined>{
 return useTx([BACKUPS],'readonly',(tx,finish,fail)=>{
  const req=tx.objectStore(BACKUPS).get(key);
  req.onsuccess=()=>{
   try{const result=req.result as BackupRecord|undefined;finish(result?{...result,project:validateProject(result.project)}:undefined);}catch(e){fail(e as Error);}
  };
 });
}
