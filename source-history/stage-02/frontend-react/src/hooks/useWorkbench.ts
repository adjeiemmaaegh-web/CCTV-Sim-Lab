import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Device,Project,Wall,Room,Point} from '../../../src/domain/types.js';
import {createDevice,profile} from '../../../src/domain/catalog.js';
import {SCENARIOS,newProject,exampleProject} from '../../../src/scenarios/index.js';
import {assess} from '../../../src/engine/assessment.js';
import {simulate,triggerMotion,injectFault} from '../../../src/engine/simulator.js';
import {AutoSaveCoordinator} from '../../../src/state/autosave.js';
import {ProjectHistory} from '../../../src/state/history.js';
import {createTabMessenger} from '../../../src/state/crosstab.js';
import {getProjectRecord,listProjects,saveProject,validateProject,listProjectBackups,getProjectBackup,removeProject} from '../../../src/persistence/projects.js';
import type {BackupRecord} from '../../../src/persistence/projects.js';

type SaveState='unsaved'|'saving'|'saved'|'blocked';
export type Selectable={kind:'device'|'cable'|'wall'|'room';id:string}|null;
export type Mode='select'|'place'|'cable'|'wall'|'room'|'test';
export function useWorkbench(){
 const [project,setProject]=useState<Project>(()=>newProject());
 const history=useRef(new ProjectHistory(project));
 const [saveState,setSaveState]=useState<SaveState>('unsaved');
 const [revision,setRevision]=useState(0);
 const [saveError,setSaveError]=useState('');
 const [notice,setNotice]=useState('');
 const [selected,setSelected]=useState<Selectable>(null);
 const [mode,setMode]=useState<Mode>('select');
 const [placing,setPlacing]=useState<string|null>(null);
 const [cableStart,setCableStart]=useState<string|null>(null);
 const [tab,setTab]=useState<'diagnostics'|'events'|'assessment'>('diagnostics');
 const [savedList,setSavedList]=useState<Project[]>([]);
 const [listOpen,setListOpen]=useState(false);
 const [backups,setBackups]=useState<BackupRecord[]>([]);
 const [backupProjectId,setBackupProjectId]=useState('');
 const [loaded,setLoaded]=useState(false);
 const [generation,setGeneration]=useState(0);
 const externalBlock=useRef(false);
 const currentRef=useRef(project);currentRef.current=project;
 const writer=useRef(crypto.randomUUID());
 const saver=useRef(new AutoSaveCoordinator((p,rev,id)=>saveProject(p,rev,id),writer.current));
 const messenger=useMemo(()=>createTabMessenger(writer.current, m=>{
   if(m.id===currentRef.current.id && m.revision>saver.current.getStatus(m.id).revision){
     externalBlock.current=true;setSaveError('Another tab saved a newer project revision. Export your work or reload the saved version.');setSaveState('blocked');
   }
 }),[]);
 useEffect(()=>{
   const unsubscribe=saver.current.subscribe(s=>{
     if(s.id!==currentRef.current.id)return;
     setSaveState(s.state);
     setRevision(s.revision);
     if(s.state==='blocked')setSaveError(s.message);
     if(s.state==='saved'){
       setSaveError('');if(s.message.startsWith('Saved revision'))messenger.announce({type:'project-saved',id:s.id,revision:s.revision});
     }
   });
   return ()=>{unsubscribe();messenger.close();};
 },[messenger]);
 // Async initialization runs once; guard StrictMode double effect starts.
 const started=useRef(false);
 useEffect(()=>{
   if(started.current)return;started.current=true;
   (async()=>{
     try{
       const projects=await listProjects();setSavedList(projects);
       if(projects.length){const found=await getProjectRecord(projects[0].id);if(!found)throw new Error('Project vanished');
         setProject(history.current.reset(found.project));saver.current.trackLoaded(found.project.id,found.revision);
       }else{const initial=currentRef.current;saver.current.trackLoaded(initial.id,0);saver.current.queue(initial);await saver.current.flush(initial.id);}
     }catch(e){setSaveState('blocked');setSaveError(`Local persistence unavailable: ${String(e)}. Export project JSON before leaving.`);}finally{setLoaded(true);}
   })();
 },[]);
 // Do not let canvas edits replace an existing project while IndexedDB hydration is in flight.
 const blocked=!loaded||saveState==='blocked'||externalBlock.current;
 const result=useMemo(()=>simulate(project),[project]);
 const assessment=useMemo(()=>assess(project,result),[project,result]);
 const canUndo=history.current.canUndo;const canRedo=history.current.canRedo;
 const commit=useCallback((next:Project,message?:string)=>{
   if(!loaded||saver.current.isBlocked(currentRef.current.id)||externalBlock.current){setNotice(!loaded?'Restoring saved project before editing…':'Editing paused: resolve the save conflict or export your draft.');return false;}
   const valid=history.current.dispatch({type:'replace',project:next});currentRef.current=valid;setProject(valid);
   try{saver.current.queue(valid);}catch(e){setSaveState('blocked');setSaveError(`Save queue blocked: ${String(e)}. Export your draft.`);}setGeneration(x=>x+1);
   if(message)setNotice(message);return true;
 },[loaded]);
 const undo=()=>{if(blocked)return;const p=history.current.undo();if(p){setProject(p);currentRef.current=p;saver.current.queue(p);setGeneration(x=>x+1);}};
 const redo=()=>{if(blocked)return;const p=history.current.redo();if(p){setProject(p);currentRef.current=p;saver.current.queue(p);setGeneration(x=>x+1);}};
 const flush=async()=>{if(!loaded)throw new Error('Project is still loading');await saver.current.flush(currentRef.current.id);setNotice('Project saved locally. Export JSON for an independent backup.');};
 const requireFlush=async()=>{if(blocked)throw new Error(!loaded?'Project is still loading':'Current project is save-blocked: export first');await saver.current.flush(currentRef.current.id);};
 const openSaved=async(id:string)=>{await requireFlush();const found=await getProjectRecord(id);if(!found)throw new Error('Project no longer exists');
   externalBlock.current=false;setSaveError('');setProject(history.current.reset(found.project));currentRef.current=found.project;
   saver.current.trackLoaded(id,found.revision);setSelected(null);setCableStart(null);setPlacing(null);setMode('select');setListOpen(false);setGeneration(x=>x+1);
 };
 const openList=async()=>{setSavedList(await listProjects());setBackups([]);setBackupProjectId('');setListOpen(true);};
 const showBackups=async(id:string)=>{setBackupProjectId(id);setBackups(await listProjectBackups(id));};
 const restoreBackup=async(key:string)=>{await requireFlush();const backup=await getProjectBackup(key);if(!backup)throw new Error('Backup missing');
   const now=new Date().toISOString();const p={...backup.project,id:crypto.randomUUID(),title:`${backup.project.title} (restored r${backup.revision})`,createdAt:now,updatedAt:now};
   setProject(history.current.reset(p));currentRef.current=p;saver.current.trackLoaded(p.id,0);saver.current.queue(p);setListOpen(false);setBackups([]);setSelected(null);setGeneration(x=>x+1);};
 const newBlank=async()=>{await requireFlush();const p=newProject(currentRef.current.scenarioId);setProject(history.current.reset(p));currentRef.current=p;
   saver.current.trackLoaded(p.id,0);saver.current.queue(p);setSelected(null);setListOpen(false);setGeneration(x=>x+1);};
 const deleteSaved=async(id:string)=>{if(id===currentRef.current.id)await requireFlush();const rec=await getProjectRecord(id);if(!rec)throw new Error('Project already deleted');
   await removeProject(id,rec.revision);
   messenger.announce({type:'project-deleted',id,revision:rec.revision+1});
   if(id===currentRef.current.id){const p=newProject(rec.project.scenarioId);setProject(history.current.reset(p));currentRef.current=p;saver.current.trackLoaded(p.id,0);saver.current.queue(p);setSelected(null);}
   setSavedList(await listProjects());setBackups([]);setGeneration(x=>x+1);};
 const switchScenario=async(id:string)=>{await requireFlush();const p=newProject(id);setProject(history.current.reset(p));currentRef.current=p;
   saver.current.trackLoaded(p.id,0);saver.current.queue(p);setSelected(null);setCableStart(null);setPlacing(null);setMode('select');setGeneration(x=>x+1);
 };
 const update=useCallback((id:string,fields:Partial<Device>)=>{
   const p=currentRef.current;commit({...p,devices:p.devices.map(d=>d.id===id?{...d,...fields,id:d.id}:d)});
 },[commit]);
 const removeSelection=()=>{
  const s=selected;if(!s)return;const p=currentRef.current;
  let next=p;
  if(s.kind==='device')next={...p,devices:p.devices.filter(d=>d.id!==s.id),cables:p.cables.filter(c=>c.a!==s.id&&c.b!==s.id)};
  if(s.kind==='cable')next={...p,cables:p.cables.filter(c=>c.id!==s.id)};
  if(s.kind==='wall')next={...p,walls:p.walls.filter(w=>w.id!==s.id)};
  if(s.kind==='room')next={...p,rooms:p.rooms.filter(r=>r.id!==s.id)};
  if(commit(next,'Selected element removed'))setSelected(null);
 };
 const install=(profileId:string,p:Point)=>{const old=currentRef.current;const dev=createDevice(profileId,p.x,p.y,old.devices);
   if(commit({...old,devices:[...old.devices,dev]},'Equipment placed; connect it and configure the device')){setSelected({kind:'device',id:dev.id});setPlacing(null);setMode('select');}
 };
 const selectOrCable=(id:string)=>{
   if(mode!=='cable'){setSelected({kind:'device',id});return;}
   if(!cableStart){setCableStart(id);setNotice('Select the other device endpoint');return;}
   const old=currentRef.current;setCableStart(null);
   if(id===cableStart||old.cables.some(c=>(c.a===id&&c.b===cableStart)||(c.b===id&&c.a===cableStart))){setNotice('Invalid or duplicate connection');return;}
   const a=old.devices.find(d=>d.id===cableStart)!,b=old.devices.find(d=>d.id===id)!;
   const cable={id:crypto.randomUUID(),a:a.id,b:b.id,connected:true,lengthMeters:Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/10))};
   commit({...old,cables:[...old.cables,cable]},'Cable connected; network and PoE recalculated');setSelected({kind:'cable',id:cable.id});
 };
 const doMotion=(p:Point)=>{const r=triggerMotion(currentRef.current,p);commit(r.project,`${r.detected} camera(s) detected movement; ${r.recorded} clip(s) recorded`);setTab('events');};
 const addWall=(a:Point,b:Point)=>{const wall:Wall={id:crypto.randomUUID(),kind:'wall',x1:a.x,y1:a.y,x2:b.x,y2:b.y};const p=currentRef.current;
   commit({...p,walls:[...p.walls,wall]},'Wall added; camera coverage recalculated');setSelected({kind:'wall',id:wall.id});};
 const addRoom=(a:Point,b:Point)=>{const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);
   if(w<15||h<15){setNotice('Draw a room at least 15 × 15 units');return;}
   const old=currentRef.current;const room:Room={id:crypto.randomUUID(),name:`Room ${old.rooms.length+1}`,x,y,w,h};
   commit({...old,rooms:[...old.rooms,room]},'Room added');setSelected({kind:'room',id:room.id});};
 const runFault=(kind:string)=>{const r=injectFault(currentRef.current,kind);if(r.project===currentRef.current){setNotice(r.message);return;}
   commit(r.project,r.message);setTab('diagnostics');};
 const runAssessment=()=>{if(blocked)return;const p=currentRef.current,a=assess(p);const record={id:crypto.randomUUID(),at:new Date().toISOString(),scenarioId:p.scenarioId,assessment:a};
   commit({...p,assessments:[...(p.assessments||[]),record].slice(-50)},`Assessment ${a.score}/100 — ${a.passed?'PASS':'not yet passed'}`);setTab('assessment');};
 const workedExample=async()=>{await requireFlush();commit(exampleProject(currentRef.current),'Assisted example loaded; assessment pass is disabled for demonstration');};
 const jsonExport=()=>{const blob=new Blob([JSON.stringify(currentRef.current,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`securitylab-${currentRef.current.id.slice(0,8)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const imageImport=async(file:File)=>{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000)throw new Error('Use PNG/JPEG/WebP no larger than 2 MB');
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error||new Error('Image read failed'));reader.readAsDataURL(file);});
  if(!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw new Error('Unsupported image');commit({...currentRef.current,floorplanImage:data},'Reference floor-plan imported');};
 const jsonImport=async(file:File)=>{if(file.size>3_500_000)throw new Error('Import limit: 3.5MB');const raw=validateProject(JSON.parse(await file.text()));await requireFlush();
   const now=new Date().toISOString(),p={...raw,id:crypto.randomUUID(),title:`${raw.title} (imported)`,createdAt:now,updatedAt:now};setProject(history.current.reset(p));currentRef.current=p;
   saver.current.trackLoaded(p.id,0);saver.current.queue(p);setSelected(null);setGeneration(x=>x+1);};
 const retrySave=async()=>{if(!loaded)throw new Error('Project is still loading');if(externalBlock.current)throw new Error('Newer revision exists in another tab; export or reload');saver.current.retry(currentRef.current);await saver.current.flush(currentRef.current.id);};
 const fork=()=>{if(!loaded)throw new Error('Project is still loading');const now=new Date().toISOString(),p={...currentRef.current,id:crypto.randomUUID(),createdAt:now,updatedAt:now,title:`${currentRef.current.title} (recovered)`};
   externalBlock.current=false;setSaveError('');setProject(history.current.reset(p));currentRef.current=p;saver.current.trackLoaded(p.id,0);saver.current.queue(p);setGeneration(x=>x+1);};
 const reload=async()=>{if(!loaded)throw new Error('Project is still loading');const found=await getProjectRecord(currentRef.current.id);if(!found)throw new Error('No saved version available');
   externalBlock.current=false;setSaveError('');setProject(history.current.reset(found.project));currentRef.current=found.project;saver.current.trackLoaded(found.project.id,found.revision);setGeneration(x=>x+1);};
 const updateRoom=(id:string,fields:Partial<Room>)=>{const p=currentRef.current;commit({...p,rooms:p.rooms.map(r=>r.id===id?{...r,...fields,id}:r)});};
 const updateWall=(id:string,fields:Partial<Wall>)=>{const p=currentRef.current;commit({...p,walls:p.walls.map(w=>w.id===id?{...w,...fields,id}:w)});};
 return {project,result,assessment,SCENARIOS,loaded,saveState,revision,saveError,blocked,notice,setNotice,selected,setSelected,mode,setMode,placing,setPlacing,
  cableStart,setCableStart,tab,setTab,savedList,listOpen,setListOpen,backups,backupProjectId,showBackups,restoreBackup,canUndo,canRedo,generation,
  undo,redo,flush,openList,openSaved,newBlank,deleteSaved,switchScenario,update,removeSelection,install,selectOrCable,doMotion,addWall,addRoom,
  runFault,runAssessment,workedExample,jsonExport,jsonImport,imageImport,retrySave,fork,reload,commit,updateRoom,updateWall};
}
export type Workbench=ReturnType<typeof useWorkbench>;
