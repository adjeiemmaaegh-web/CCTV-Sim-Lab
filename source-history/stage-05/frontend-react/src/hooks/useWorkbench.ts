import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Device,Project,Wall,Room,Point,SiteElement,FloorplanSettings} from '../../../src/domain/types.js';
import {bounded,distance,scaleOf,normalizeRoom,shiftRoom,resizeRoom,roomEdges,transformRoomWalls,shiftWall,wallEndpoint,replaceWallWithOpening,propertyTemplate,DEFAULT_FLOORPLAN,sanitizeFloorplan} from '../../../src/property/editor.js';
import type {PropertyTemplate} from '../../../src/property/editor.js';
import {createDevice,profile} from '../../../src/domain/catalog.js';
import {SCENARIOS,newProject,exampleProject} from '../../../src/scenarios/index.js';
import {assess} from '../../../src/engine/assessment.js';
import {simulate,triggerMotion,injectFault,advanceRecording} from '../../../src/engine/simulator.js';
import {signalOf} from '../../../src/engine/cctv.js';
import {AutoSaveCoordinator} from '../../../src/state/autosave.js';
import {ProjectHistory} from '../../../src/state/history.js';
import {createTabMessenger} from '../../../src/state/crosstab.js';
import {getProjectRecord,listProjects,saveProject,validateProject,listProjectBackups,getProjectBackup,removeProject} from '../../../src/persistence/projects.js';
import type {BackupRecord} from '../../../src/persistence/projects.js';

type SaveState='unsaved'|'saving'|'saved'|'blocked';
export type Selectable={kind:'device'|'cable'|'wall'|'room'|'target'|'site'|'reference';id:string}|null;
export type Mode='select'|'place'|'cable'|'wall'|'room'|'door'|'window'|'gate'|'entrance'|'label'|'measure'|'pan'|'test';
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
 const [tab,setTab]=useState<'diagnostics'|'network'|'events'|'recordings'|'assessment'>('diagnostics');
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
  if(s.kind==='room')next={...p,rooms:p.rooms.filter(r=>r.id!==s.id),walls:p.walls.filter(w=>w.roomId!==s.id)};
  if(s.kind==='site')next={...p,siteElements:(p.siteElements||[]).filter(v=>v.id!==s.id)};
  if(s.kind==='target'){setNotice('Scenario targets cannot be deleted; reposition them instead.');return;}
  if(s.kind==='reference'){next={...p,floorplanImage:undefined,floorplanSettings:undefined};}
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
   const analog=(d:Device)=>profile(d.profileId).kind==='camera'&&signalOf(d)==='analog';
   const dvr=(d:Device)=>profile(d.profileId).kind==='dvr';
   const coax=(analog(a)&&dvr(b))||(analog(b)&&dvr(a));
   if((analog(a)||analog(b))&&!coax){setNotice('Analog cameras require a coaxial video link directly to a DVR.');return;}
   const medium=coax?'coax' as const:'ethernet' as const;
   const cable={id:crypto.randomUUID(),a:a.id,b:b.id,connected:true,medium,lengthMeters:Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/scaleOf(old)))};
   if(commit({...old,cables:[...old.cables,cable]},`${medium==='coax'?'Coaxial video':'Ethernet'} connection installed; simulation recalculated`))setSelected({kind:'cable',id:cable.id});
 };
 const doMotion=(p:Point,intensity=75)=>{const r=triggerMotion(currentRef.current,p,undefined,intensity);commit(r.project,`${r.detected} camera(s) detected movement; ${r.recorded} virtual clip record(s) stored`);setTab('events');};
 const advanceTime=(minutes:number)=>{if(blocked)return;try{commit(advanceRecording(currentRef.current,minutes),`Virtual recording clock advanced ${minutes} minutes`);setTab('recordings');}catch(e){setNotice(`Cannot advance recording: ${String(e)}`);}};
 const addWall=(a:Point,b:Point)=>{
   if(currentRef.current.walls.length>=400){setNotice('Wall safety limit reached');return;}
   if(distance(a,b)<10){setNotice('Wall must be at least 10 plan units long');return;}
   const wall:Wall={id:crypto.randomUUID(),kind:'wall',x1:bounded(a).x,y1:bounded(a).y,x2:bounded(b).x,y2:bounded(b).y};const p=currentRef.current;
   if(commit({...p,walls:[...p.walls,wall]},'Physical wall added — camera coverage recalculated'))setSelected({kind:'wall',id:wall.id});};
 const addRoom=(a:Point,b:Point)=>{
   if(currentRef.current.rooms.length>=200||currentRef.current.walls.length>396){setNotice('Room or wall safety limit reached');return;}
   const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),width=Math.abs(a.x-b.x),height=Math.abs(a.y-b.y);
   if(width<20||height<20){setNotice('Draw a room at least 20 × 20 units');return;}
   const old=currentRef.current;const room=normalizeRoom({id:crypto.randomUUID(),name:`Room ${old.rooms.length+1}`,x,y,w:width,h:height});
   const walls=roomEdges(room,()=>crypto.randomUUID());
   if(commit({...old,rooms:[...old.rooms,room],walls:[...old.walls,...walls]},'Room and four solid walls added; use Door/Window to create openings'))setSelected({kind:'room',id:room.id});};
 const addOpening=(at:Point,kind:'door'|'window')=>{
   const old=currentRef.current;if(old.walls.length>398){setNotice('Wall safety limit reached');return;}const result=replaceWallWithOpening(old.walls,at,kind,kind==='door'?36:50,()=>crypto.randomUUID());
   if(!result){setNotice('Click near a solid wall with sufficient length and space at both ends.');return;}
   if(commit({...old,walls:result.walls},`${kind==='door'?'Door':'Window'} inserted as a transparent opening; coverage recalculated`))setSelected({kind:'wall',id:result.openingId});
 };
 const addSiteElement=(at:Point,kind:SiteElement['kind'])=>{
   const old=currentRef.current;
   if((old.siteElements?.length||0)>=150){setNotice('Maximum annotation count reached');return;}
   const site:SiteElement={id:crypto.randomUUID(),kind,label:kind==='entrance'?'Entrance':kind==='gate'?'Gate':'Annotation',...bounded(at)};
   if(commit({...old,siteElements:[...(old.siteElements||[]),site]},'Site marker added'))setSelected({kind:'site',id:site.id});
 };
 const moveRoom=(id:string,dx:number,dy:number)=>{
   const old=currentRef.current,room=old.rooms.find(r=>r.id===id);if(!room)return;
   const next=shiftRoom(room,dx,dy);
   commit({...old,rooms:old.rooms.map(r=>r.id===id?next:r),walls:transformRoomWalls(old.walls,room,next)},'Room and linked walls moved');
 };
 const resizeSelectedRoom=(id:string,corner:Point)=>{
   const old=currentRef.current,room=old.rooms.find(r=>r.id===id);if(!room)return;
   const next=resizeRoom(room,corner);
   commit({...old,rooms:old.rooms.map(r=>r.id===id?next:r),walls:transformRoomWalls(old.walls,room,next)},'Room resized; physical walls and openings updated');
 };
 const moveWall=(id:string,dx:number,dy:number)=>{
   const old=currentRef.current,wall=old.walls.find(r=>r.id===id);if(!wall)return;
   commit({...old,walls:old.walls.map(r=>r.id===id?shiftWall(wall,{x:dx,y:dy}):r)},'Wall moved — coverage recalculated');
 };
 const editWallEndpoint=(id:string,end:'start'|'end',point:Point)=>{
   const old=currentRef.current,wall=old.walls.find(r=>r.id===id);if(!wall)return;
   const changed=wallEndpoint(wall,end,point);if(!changed){setNotice('Wall cannot be shorter than 10 units');return;}
   commit({...old,walls:old.walls.map(r=>r.id===id?changed:r)},'Wall endpoint updated');
 };
 const moveTarget=(id:string,at:Point)=>{const old=currentRef.current;commit({...old,targets:old.targets.map(t=>t.id===id?{...t,...bounded(at)}:t)},'Scenario target relocated; coverage recalculated');};
 const moveSiteElement=(id:string,at:Point)=>{const old=currentRef.current;commit({...old,siteElements:(old.siteElements||[]).map(m=>m.id===id?{...m,...bounded(at)}:m)},'Site marker relocated');};
 const updateSiteElement=(id:string,fields:Partial<SiteElement>)=>{const old=currentRef.current;commit({...old,siteElements:(old.siteElements||[]).map(m=>m.id===id?{...m,...fields,id:m.id,kind:m.kind,...bounded({x:fields.x??m.x,y:fields.y??m.y})}:m)});};
 const updateTarget=(id:string,fields:Partial<Point>)=>{const old=currentRef.current;commit({...old,targets:old.targets.map(t=>t.id===id?{...t,...bounded({x:fields.x??t.x,y:fields.y??t.y})}:t)});};
 const setPropertyScale=(unitsPerMeter:number)=>{if(!Number.isFinite(unitsPerMeter)||unitsPerMeter<1||unitsPerMeter>100){setNotice('Scale must be between 1 and 100 units/metre');return;}const old=currentRef.current;const cables=old.cables.map(c=>{const a=old.devices.find(d=>d.id===c.a),b=old.devices.find(d=>d.id===c.b);return a&&b?{...c,lengthMeters:Math.max(1,Math.ceil(distance(a,b)/unitsPerMeter))}:c;});commit({...old,unitsPerMeter,cables},'Site scale and physical cable run estimates updated');};
 const setFloorplanSettings=(settings:Partial<FloorplanSettings>)=>{const old=currentRef.current;if(!old.floorplanImage)return;commit({...old,floorplanSettings:sanitizeFloorplan({...DEFAULT_FLOORPLAN,...old.floorplanSettings,...settings})},'Reference image settings updated');};
 const applyPropertyTemplate=(kind:PropertyTemplate)=>{const old=currentRef.current,property=propertyTemplate(kind,()=>crypto.randomUUID());
   if(commit({...old,rooms:property.rooms,walls:property.walls,siteElements:property.elements},'Property template applied; installed devices and scenario objectives preserved'))setSelected(null);
 };
 const moveDevice=(id:string,at:Point)=>{const old=currentRef.current,device=old.devices.find(d=>d.id===id);if(!device)return;
   const pos=bounded(at),updated=old.devices.map(d=>d.id===id?{...d,...pos}:d);
   const look=(deviceId:string)=>updated.find(d=>d.id===deviceId);
   const cables=old.cables.map(c=>{if(c.a!==id&&c.b!==id)return c;const a=look(c.a),b=look(c.b);return a&&b?{...c,lengthMeters:Math.max(1,Math.ceil(distance(a,b)/scaleOf(old)))}:c;});
   commit({...old,devices:updated,cables},'Device relocated; cable lengths and simulation recalculated');
 };
 const nudgeSelected=(dx:number,dy:number)=>{
   if(blocked||!selected)return;
   const p=currentRef.current,id=selected.id;
   if(selected.kind==='device'){const d=p.devices.find(d=>d.id===id);if(d)moveDevice(id,{x:d.x+dx,y:d.y+dy});}
   else if(selected.kind==='room')moveRoom(id,dx,dy);
   else if(selected.kind==='wall')moveWall(id,dx,dy);
   else if(selected.kind==='target'){const t=p.targets.find(t=>t.id===id);if(t)moveTarget(id,{x:t.x+dx,y:t.y+dy});}
   else if(selected.kind==='site'){const m=p.siteElements?.find(m=>m.id===id);if(m)moveSiteElement(id,{x:m.x+dx,y:m.y+dy});}
   else if(selected.kind==='reference'){const settings=p.floorplanSettings;if(settings&&!settings.locked)setFloorplanSettings({x:settings.x+dx,y:settings.y+dy});}
 };
 const renameProject=(title:string)=>{const next=title.trim().slice(0,120);if(!next){setNotice('Project title cannot be empty');return;}
   commit({...currentRef.current,title:next},'Project renamed');
 };
 const runFault=(kind:string)=>{const r=injectFault(currentRef.current,kind);if(r.project===currentRef.current){setNotice(r.message);return;}
   commit(r.project,r.message);setTab('diagnostics');};
 const runAssessment=()=>{if(blocked)return;const p=currentRef.current,a=assess(p);const record={id:crypto.randomUUID(),at:new Date().toISOString(),scenarioId:p.scenarioId,assessment:a};
   commit({...p,assessments:[...(p.assessments||[]),record].slice(-50)},`Assessment ${a.score}/100 — ${a.passed?'PASS':'not yet passed'}`);setTab('assessment');};
 const workedExample=async()=>{await requireFlush();commit(exampleProject(currentRef.current),'Assisted example loaded; assessment pass is disabled for demonstration');};
 const jsonExport=()=>{const blob=new Blob([JSON.stringify(currentRef.current,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`securitylab-${currentRef.current.id.slice(0,8)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const imageImport=async(file:File)=>{if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000)throw new Error('Use PNG/JPEG/WebP no larger than 2 MB');
  const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error||new Error('Image read failed'));reader.readAsDataURL(file);});
  if(!/^data:image\/(png|jpeg|webp);base64,/.test(data))throw new Error('Unsupported image');commit({...currentRef.current,floorplanImage:data,floorplanSettings:currentRef.current.floorplanSettings||DEFAULT_FLOORPLAN},'Reference floor-plan imported');};
 const jsonImport=async(file:File)=>{if(file.size>3_500_000)throw new Error('Import limit: 3.5MB');const raw=validateProject(JSON.parse(await file.text()));await requireFlush();
   const now=new Date().toISOString(),p={...raw,id:crypto.randomUUID(),title:`${raw.title} (imported)`,createdAt:now,updatedAt:now};setProject(history.current.reset(p));currentRef.current=p;
   saver.current.trackLoaded(p.id,0);saver.current.queue(p);setSelected(null);setGeneration(x=>x+1);};
 const retrySave=async()=>{if(!loaded)throw new Error('Project is still loading');if(externalBlock.current)throw new Error('Newer revision exists in another tab; export or reload');saver.current.retry(currentRef.current);await saver.current.flush(currentRef.current.id);};
 const fork=()=>{if(!loaded)throw new Error('Project is still loading');const now=new Date().toISOString(),p={...currentRef.current,id:crypto.randomUUID(),createdAt:now,updatedAt:now,title:`${currentRef.current.title} (recovered)`};
   externalBlock.current=false;setSaveError('');setProject(history.current.reset(p));currentRef.current=p;saver.current.trackLoaded(p.id,0);saver.current.queue(p);setGeneration(x=>x+1);};
 const reload=async()=>{if(!loaded)throw new Error('Project is still loading');const found=await getProjectRecord(currentRef.current.id);if(!found)throw new Error('No saved version available');
   externalBlock.current=false;setSaveError('');setProject(history.current.reset(found.project));currentRef.current=found.project;saver.current.trackLoaded(found.project.id,found.revision);setGeneration(x=>x+1);};
 const updateRoom=(id:string,fields:Partial<Room>)=>{const p=currentRef.current,old=p.rooms.find(r=>r.id===id);if(!old)return;const changed=normalizeRoom({...old,...fields,id});commit({...p,rooms:p.rooms.map(r=>r.id===id?changed:r),walls:transformRoomWalls(p.walls,old,changed)});};
 const updateWall=(id:string,fields:Partial<Wall>)=>{const p=currentRef.current;commit({...p,walls:p.walls.map(w=>w.id===id?{...w,...fields,id,roomId:undefined}:w)});};
 return {project,result,assessment,SCENARIOS,loaded,saveState,revision,saveError,blocked,notice,setNotice,selected,setSelected,mode,setMode,placing,setPlacing,
  cableStart,setCableStart,tab,setTab,savedList,listOpen,setListOpen,backups,backupProjectId,showBackups,restoreBackup,canUndo,canRedo,generation,
  undo,redo,flush,openList,openSaved,newBlank,deleteSaved,switchScenario,update,removeSelection,install,selectOrCable,doMotion,addWall,addRoom,
  runFault,runAssessment,advanceTime,workedExample,jsonExport,jsonImport,imageImport,retrySave,fork,reload,commit,updateRoom,updateWall,
  addOpening,addSiteElement,moveRoom,resizeSelectedRoom,moveWall,editWallEndpoint,moveTarget,moveSiteElement,updateSiteElement,updateTarget,
  setPropertyScale,setFloorplanSettings,applyPropertyTemplate,moveDevice,nudgeSelected,renameProject};
}
export type Workbench=ReturnType<typeof useWorkbench>;
