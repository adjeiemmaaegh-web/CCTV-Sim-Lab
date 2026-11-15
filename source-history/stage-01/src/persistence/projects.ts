import type {Project} from '../domain/types.js';
import {PROFILES} from '../domain/catalog.js';
import {SCENARIOS} from '../scenarios/index.js';
const DB='securitylab-local-v1',STORE='projects';
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in globalThis)){reject(new Error('IndexedDB is unavailable in this browser'));return;}
  const req=indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});};
  req.onerror=()=>reject(req.error||new Error('Storage cannot be opened'));
  req.onsuccess=()=>resolve(req.result);
 });
}
function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,done:(x:T)=>void)=>void):Promise<T>{
 return openDb().then(db=>new Promise<T>((resolve,reject)=>{
  let doneValue:T;let settled=false;
  const tx=db.transaction(STORE,mode),store=tx.objectStore(STORE);
  tx.oncomplete=()=>{db.close();resolve(doneValue);};
  tx.onerror=()=>{settled=true;db.close();reject(tx.error||new Error('Project storage failed'));};
  tx.onabort=()=>{if(!settled){db.close();reject(tx.error||new Error('Project save aborted'));}};
  try{run(store,v=>{doneValue=v;});}catch(e){tx.abort();reject(e);}
 }));
}
export function saveProject(p:Project):Promise<void>{return transaction<void>('readwrite',(s,done)=>{s.put(structuredClone(p));done(undefined);});}
export function getProject(id:string):Promise<Project|undefined>{return transaction('readonly',(s,done)=>{const r=s.get(id);r.onsuccess=()=>done(r.result as Project|undefined);});}
export function listProjects():Promise<Project[]>{return transaction('readonly',(s,done)=>{const r=s.getAll();r.onsuccess=()=>done((r.result as Project[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));});}
export function removeProject(id:string):Promise<void>{return transaction<void>('readwrite',(s,done)=>{s.delete(id);done(undefined);});}
const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1000000;
const txt=(s:unknown)=>typeof s==='string'&&s.length<500;
const validPoint=(p:Record<string,unknown>)=>finite(p.x)&&finite(p.y);
/** Import boundary: reject invalid references, unsafe image URLs, unknown profiles, corrupt numeric values. */
export function validateProject(input:unknown):Project{
 if(!input||typeof input!=='object')throw new Error('Expected a SecurityLab project JSON object');
 const p=input as Record<string,unknown>;
 if(p.schemaVersion!==1||!txt(p.id)||!txt(p.title)||!txt(p.scenarioId)||!SCENARIOS.some(s=>s.id===p.scenarioId))throw new Error('Unsupported project format, scenario or schema');
 if(!Array.isArray(p.devices)||!Array.isArray(p.cables)||!Array.isArray(p.rooms)||!Array.isArray(p.walls)||!Array.isArray(p.events)||!Array.isArray(p.targets))throw new Error('Project has missing geometry/equipment fields');
 if(p.devices.length>120||p.cables.length>240||p.walls.length>400||p.rooms.length>200||p.events.length>250||p.targets.length>50)throw new Error('Project exceeds safety limits');
 for(const d of p.devices){
  if(!d||!txt(d.id)||!txt(d.name)||!PROFILES.some(x=>x.id===d.profileId)||!validPoint(d)||!finite(d.heading)||!finite(d.fov)||!finite(d.range)||!txt(d.ip)||!txt(d.mask)||!txt(d.gateway)||typeof d.enabled!=='boolean'||typeof d.motionEnabled!=='boolean'||typeof d.recordingEnabled!=='boolean')throw new Error('Invalid device record');
  for(const key of ['poeBudgetW','storageGB','usedGB','bitrateMbps'])if(d[key]!==undefined&&!finite(d[key]))throw new Error(`Invalid numeric equipment value: ${key}`);
 }
 const ids=new Set((p.devices as {id:string}[]).map(d=>d.id));
 if(ids.size!==p.devices.length)throw new Error('Duplicate equipment IDs');
 for(const c of p.cables){if(!c||!txt(c.id)||!txt(c.a)||!txt(c.b)||!ids.has(c.a)||!ids.has(c.b)||!finite(c.lengthMeters)||typeof c.connected!=='boolean')throw new Error('Invalid cable endpoint or length');}
 if(new Set((p.cables as {id:string}[]).map(c=>c.id)).size!==p.cables.length)throw new Error('Duplicate cable IDs');
 for(const w of p.walls){if(!w||!txt(w.id)||!['wall','door','window'].includes(w.kind)||!['x1','x2','y1','y2'].every(k=>finite(w[k])))throw new Error('Invalid wall/door record');}
 for(const r of p.rooms){if(!r||!txt(r.id)||!txt(r.name)||!validPoint(r)||!finite(r.w)||!finite(r.h))throw new Error('Invalid room record');}
 for(const t of p.targets){if(!t||!txt(t.id)||!txt(t.name)||!validPoint(t))throw new Error('Invalid target objective');}
 if(p.floorplanImage!==undefined&&(typeof p.floorplanImage!=='string'||p.floorplanImage.length>2_800_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.floorplanImage)))throw new Error('Unsafe or oversized floor-plan image');
 if(p.assessments!==undefined){
  if(!Array.isArray(p.assessments)||p.assessments.length>50)throw new Error('Invalid assessment history');
  for(const a of p.assessments){if(!a||!txt(a.id)||!txt(a.at)||!txt(a.scenarioId)||!a.assessment||!Number.isInteger(a.assessment.score)||a.assessment.score<0||a.assessment.score>100||typeof a.assessment.passed!=='boolean'||!Array.isArray(a.assessment.rubric)||!Array.isArray(a.assessment.recommendations))throw new Error('Invalid assessment record');}
 }
 if(typeof p.night!=='boolean'||typeof p.mainsOn!=='boolean'||typeof p.assisted!=='boolean')throw new Error('Invalid simulation state');
 for(const e of p.events)if(!e||!txt(e.id)||!txt(e.at)||!txt(e.message)||!['info','motion','recorded','fault','warning'].includes(e.kind)||typeof e.recorded!=='boolean')throw new Error('Invalid event log');
 return structuredClone(input as Project);
}
