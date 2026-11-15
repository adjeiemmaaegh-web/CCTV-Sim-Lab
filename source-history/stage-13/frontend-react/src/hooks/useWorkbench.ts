import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {Device,Project,Wall,Room,Point,SiteElement,FloorplanSettings,AccessMethod,AccessIdentity,AssessmentRecord} from '../../../src/domain/types.js';
import {bounded,distance,scaleOf,normalizeRoom,shiftRoom,resizeRoom,roomEdges,transformRoomWalls,shiftWall,wallEndpoint,replaceWallWithOpening,propertyTemplate,DEFAULT_FLOORPLAN,sanitizeFloorplan} from '../../../src/property/editor.js';
import type {PropertyTemplate} from '../../../src/property/editor.js';
import {createDevice,profile} from '../../../src/domain/catalog.js';
import {SCENARIOS,newProject,exampleProject,scenarioFor} from '../../../src/scenarios/index.js';
import {evaluateScenario,allowedInScenario} from '../../../src/scenarios/evaluation.js';
import {assess} from '../../../src/engine/assessment.js';
import {reportAsHtml,reportAsJson} from '../../../src/engine/reports.js';
import {simulate,triggerMotion,injectFault,advanceRecording} from '../../../src/engine/simulator.js';
import {signalOf} from '../../../src/engine/cctv.js';
import {commandAlarm,triggerAlarmStimulus,advanceAlarmTime,injectAlarmFault,panelConfig} from '../../../src/engine/alarm.js';
import {presentAccessToken,requestExit,operateDoor,clearAccessAlarm,advanceAccessTime,injectAccessFault,controllerConfig} from '../../../src/engine/access.js';
import {advancePower,injectPowerFault,plannedPowerCable,isPowerDevice,DEFAULT_POWER_SETTINGS} from '../../../src/engine/power.js';
import type {PowerFault,} from '../../../src/engine/power.js';
import type {AlarmStimulus} from '../../../src/engine/alarm.js';
import {ProjectHistory} from '../../../src/state/history.js';
import {validateProject} from '../../../src/persistence/validation.js';
import {ProjectFileSession,parseProjectText} from '../../../src/persistence/file-projects.js';
import {readSafeFloorplanImage} from '../../../src/persistence/safe-images.js';
import type {Checkpoint} from '../../../src/persistence/file-projects.js';

type SaveState='unsaved'|'saving'|'saved'|'blocked';
export type Selectable={kind:'device'|'cable'|'wall'|'room'|'target'|'site'|'reference';id:string}|null;
export type Mode='select'|'place'|'cable'|'wall'|'room'|'door'|'window'|'gate'|'entrance'|'label'|'measure'|'pan'|'test';
export function useWorkbench(){
 const [project,setProject]=useState<Project>(()=>newProject());
 const history=useRef(new ProjectHistory(project));
 const fileSession=useRef(new ProjectFileSession());
 const savePromise=useRef<Promise<boolean>|null>(null);
 const savedSignature=useRef<string|null>(null);
 const currentRef=useRef(project);currentRef.current=project;
 const [saveState,setSaveState]=useState<SaveState>('unsaved');
 const [revision,setRevision]=useState(0);
 const [fileName,setFileName]=useState('Unsaved project');
 const [saveError,setSaveError]=useState('');
 const [notice,setNotice]=useState('Choose Save Project to create a local JSON file. This app stores no project data in the browser.');
 const [selected,setSelected]=useState<Selectable>(null);
 const [mode,setMode]=useState<Mode>('select');
 const [placing,setPlacing]=useState<string|null>(null);
 const [cableStart,setCableStart]=useState<string|null>(null);
 const [tab,setTab]=useState<'diagnostics'|'network'|'events'|'recordings'|'alarm'|'access'|'power'|'scenario'|'assessment'>('scenario');
 const [listOpen,setListOpen]=useState(false);
 const [backups,setBackups]=useState<Checkpoint[]>([]);
 const [autosave,setAutosave]=useState(false);
 const [generation,setGeneration]=useState(0);
 const loaded=true;
 const blocked=saveState==='blocked';
 const result=useMemo(()=>simulate(project),[project]);
 const assessment=useMemo(()=>assess(project,result),[project,result]);
 const scenarioProgress=useMemo(()=>evaluateScenario(project,result),[project,result]);
 const scenario=scenarioFor(project.scenarioId)!;
 const isAllowedProfile=(profileId:string)=>allowedInScenario(project,profile(profileId).kind);
 const canUndo=history.current.canUndo;const canRedo=history.current.canRedo;
 const dirty=()=>saveState!=='saved';
 const confirmDiscard=(action:string)=>{
  if(savePromise.current){setNotice('A project-file write is in progress. Finish saving before changing projects.');return false;}
  return !dirty()||window.confirm(`Changes are not confirmed saved to a project file. ${action} will discard the current in-memory draft. Continue?`);
 };
 const markDirty=()=>{setSaveState('unsaved');setSaveError('');setGeneration(x=>x+1);};
 const commit=useCallback((next:Project,message?:string)=>{
   if(blocked){setNotice('Editing paused after a file-save error. Use Save As or Export Backup before proceeding.');return false;}
   const valid=history.current.dispatch({type:'replace',project:next});currentRef.current=valid;setProject(valid);
   markDirty();if(message)setNotice(message);return true;
 },[blocked]);
 const undo=()=>{if(blocked)return;const p=history.current.undo();if(p){setProject(p);currentRef.current=p;markDirty();}};
 const redo=()=>{if(blocked)return;const p=history.current.redo();if(p){setProject(p);currentRef.current=p;markDirty();}};
 const saveCurrent=async(saveAs=false,interactive=true):Promise<boolean>=>{
  if(savePromise.current)await savePromise.current;
  const currentSignature=JSON.stringify(currentRef.current);
  if(!saveAs&&savedSignature.current===currentSignature){setSaveState('saved');return true;}
  const snapshot=structuredClone(currentRef.current);
  const task=(async()=>{
   setSaveState('saving');setSaveError('');
   try{
    const outcome=await fileSession.current.save(snapshot,saveAs,interactive);
    setRevision(outcome.revision);setFileName(fileSession.current.name);
    const unchanged=JSON.stringify(currentRef.current)===JSON.stringify(snapshot);
    if(outcome.verified)savedSignature.current=JSON.stringify(snapshot);
    setSaveState(outcome.verified&&unchanged?'saved':'unsaved');
    if(!outcome.verified)setNotice(outcome.reason||'Project JSON download requested. Keep the downloaded copy; it cannot be verified automatically.');
    else setNotice(unchanged?`Saved and read back from ${outcome.name} (revision ${outcome.revision}).`:'File write succeeded, but later edits are still unsaved.');
    return outcome.verified&&unchanged;
   }catch(error){
    const message=String(error instanceof Error?error.message:error);
    if(error instanceof DOMException&&error.name==='AbortError'){
     setSaveState('unsaved');setNotice('File picker cancelled. Your in-memory project has not been saved.');return false;
    }
    if(!interactive){setAutosave(false);setSaveState('unsaved');setNotice(`Autosave paused: ${message}. Save manually or export a backup.`);return false;}
    setSaveState('blocked');setSaveError(`Local file save failed: ${message}. Export a separate backup or use Save As.`);return false;
   }
  })();
  savePromise.current=task;
  try{return await task;}finally{if(savePromise.current===task)savePromise.current=null;}
 };
 const saveRef=useRef(saveCurrent);saveRef.current=saveCurrent;
 useEffect(()=>{
  if(!autosave||!fileSession.current.hasWritableHandle||blocked)return;
  const timer=setTimeout(()=>{void saveRef.current(false,false);},1800);
  return ()=>clearTimeout(timer);
 },[generation,autosave,blocked]);
 const flush=async()=>{
  if(saveState==='saved')return;
  const ok=await saveCurrent(false,true);
  if(!ok)throw new Error('No confirmed file save. Keep a separate downloaded backup before updating.');
 };
 const adopt=(next:Project,isSaved:boolean)=>{
  const clean=history.current.reset(validateProject(next));currentRef.current=clean;setProject(clean);
  setRevision(fileSession.current.revision);setFileName(fileSession.current.name);
  savedSignature.current=isSaved?JSON.stringify(clean):null;
  setSaveState(isSaved?'saved':'unsaved');setSaveError('');setAutosave(false);
  setSelected(null);setCableStart(null);setPlacing(null);setMode('select');setListOpen(false);setGeneration(x=>x+1);
 };
 const openNative=async()=>{
  if(!confirmDiscard('Opening another file'))return;
  const parsed=await fileSession.current.openNative();adopt(parsed.project,true);
  setNotice(`Opened ${parsed.name}. Changes remain in memory until saved back to the file.`);
 };
 const openFile=async(file:File)=>{
  if(!confirmDiscard('Opening another file'))return;
  const parsed=await fileSession.current.openFile(file);adopt(parsed.project,true);
  setNotice(`Imported ${parsed.name}. Select Save As to enable direct saving (supported browsers), or download an updated JSON copy.`);
 };
 const openList=()=>{setBackups(fileSession.current.backups);setListOpen(true);};
 const restoreBackup=(index:number)=>{
  if(!confirmDiscard('Restoring a checkpoint'))return;
  const snapshot=fileSession.current.backups[index];if(!snapshot)throw new Error('Checkpoint missing');
  const at=new Date().toISOString();const fresh={...snapshot.project,id:crypto.randomUUID(),title:`${snapshot.project.title} (restored r${snapshot.revision})`,createdAt:at,updatedAt:at};
  fileSession.current.detach();adopt(fresh,false);setNotice('Checkpoint recovered as an independent unsaved project. Save As a new file.');
 };
 const newBlank=()=>{
  if(!confirmDiscard('Creating a new project'))return;
  const p=newProject(currentRef.current.scenarioId);fileSession.current.detach();adopt(p,false);
 };
 const switchScenario=async(id:string)=>{
  if(!confirmDiscard('Switching scenarios'))return;
  const p=newProject(id);fileSession.current.detach();adopt(p,false);
 };
 const update=useCallback((id:string,fields:Partial<Device>)=>{
   const p=currentRef.current;commit({...p,devices:p.devices.map(d=>d.id===id?{...d,...fields,id:d.id}:d)});
 },[commit]);
 const removeSelection=()=>{
  const s=selected;if(!s)return;const p=currentRef.current;
  let next=p;
  if(s.kind==='device'){const alarmStates={...p.alarmStates};delete alarmStates[s.id];next={...p,alarmStates,devices:p.devices.filter(d=>d.id!==s.id),cables:p.cables.filter(c=>c.a!==s.id&&c.b!==s.id),accessIdentities:(p.accessIdentities||[]).map(i=>({...i,grants:i.grants.filter(g=>g.controllerId!==s.id)}))};}
  if(s.kind==='cable')next={...p,cables:p.cables.filter(c=>c.id!==s.id)};
  if(s.kind==='wall'){const states={...p.accessDoorStates};delete states[s.id];next={...p,walls:p.walls.filter(w=>w.id!==s.id),accessDoorStates:states,devices:p.devices.map(d=>d.accessController?.doorWallId===s.id?{...d,accessController:{...d.accessController,doorWallId:''}}:d)};}
  if(s.kind==='room'){const removed=new Set(p.walls.filter(w=>w.roomId===s.id).map(w=>w.id)),states=Object.fromEntries(Object.entries(p.accessDoorStates||{}).filter(([id])=>!removed.has(id)));next={...p,rooms:p.rooms.filter(r=>r.id!==s.id),walls:p.walls.filter(w=>w.roomId!==s.id),accessDoorStates:states,devices:p.devices.map(d=>d.accessController&&removed.has(d.accessController.doorWallId)?{...d,accessController:{...d.accessController,doorWallId:''}}:d)};}
  if(s.kind==='site')next={...p,siteElements:(p.siteElements||[]).filter(v=>v.id!==s.id)};
  if(s.kind==='target'){setNotice('Scenario targets cannot be deleted; reposition them instead.');return;}
  if(s.kind==='reference'){next={...p,floorplanImage:undefined,floorplanSettings:undefined};}
  if(commit(next,'Selected element removed'))setSelected(null);
 };
 const install=(profileId:string,p:Point)=>{const old=currentRef.current;if(!allowedInScenario(old,profile(profileId).kind)){setNotice('This equipment is not part of the selected scenario supply list');return;}const dev=createDevice(profileId,p.x,p.y,old.devices);
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
   const kind=(d:Device)=>profile(d.profileId).kind;
   const isAlarm=(d:Device)=>kind(d).startsWith('alarm-');
   const isAccess=(d:Device)=>kind(d).startsWith('access-');
   const electrical=isPowerDevice(a)||isPowerDevice(b);
   const powerLink=electrical?plannedPowerCable(a,b):null;
   if(electrical&&!powerLink){setNotice('Invalid electrical terminals or mismatched rated voltages. Power cable must connect an output to a compatible input.');return;}
   const accessPair=(kind(a)==='access-controller'&&isAccess(b)&&!['access-controller','access-server'].includes(kind(b)))||(kind(b)==='access-controller'&&isAccess(a)&&!['access-controller','access-server'].includes(kind(a)));
   if((isAccess(a)||isAccess(b))&&!accessPair){setNotice('Access wiring must connect one controller to a reader, lock, or exit button.');return;}
   const alarmPair=(kind(a)==='alarm-panel'&&isAlarm(b)&&kind(b)!=='alarm-panel')||
     (kind(b)==='alarm-panel'&&isAlarm(a)&&kind(a)!=='alarm-panel');
   if((isAlarm(a)||isAlarm(b))&&!alarmPair){setNotice('Alarm wiring needs one panel and one detector, keypad, siren or strobe.');return;}
   const coax=(analog(a)&&dvr(b))||(analog(b)&&dvr(a));
   if((analog(a)||analog(b))&&!coax){setNotice('Analog cameras require a coaxial video link directly to a DVR.');return;}
   const medium=powerLink?.medium||(accessPair?'access' as const:alarmPair?'alarm' as const:coax?'coax' as const:'ethernet' as const);
   const cable={id:crypto.randomUUID(),a:powerLink?.a||a.id,b:powerLink?.b||b.id,connected:true,medium,lengthMeters:Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/scaleOf(old)))};
   if(commit({...old,cables:[...old.cables,cable]},`${medium==='coax'?'Coaxial video':medium==='alarm'?'Alarm terminal':medium==='access'?'Access control circuit':'Ethernet'} connection installed; simulation recalculated`))setSelected({kind:'cable',id:cable.id});
 };
 const doMotion=(p:Point,intensity=75)=>{const r=triggerMotion(currentRef.current,p,undefined,intensity);const alarm=triggerAlarmStimulus(r.project,'motion',p,intensity);commit(alarm.project,`${r.detected} camera(s) detected movement; ${alarm.detected} alarm PIR(s) reacted; ${alarm.alerts} alert(s)`);setTab(alarm.detected?'alarm':'events');};
 const advanceTime=(minutes:number)=>{if(blocked)return;try{commit(advanceRecording(currentRef.current,minutes),`Virtual recording clock advanced ${minutes} minutes`);setTab('recordings');}catch(e){setNotice(`Cannot advance recording: ${String(e)}`);}};
 // Alarm laboratory: virtual keypad commands and sensor stimuli are engine operations, not UI animations.
 const alarmCommand=(panelId:string,command:'stay'|'away'|'disarm'|'silence',pin:string)=>{
  if(blocked)return;
  try{const next=commandAlarm(currentRef.current,panelId,command,pin);commit(next,`Alarm panel ${command} command applied`);setTab('alarm');}
  catch(e){setNotice(`Alarm command refused: ${String(e)}`);}
 };
 const alarmStimulus=(kind:AlarmStimulus,at:Point,intensity=90)=>{
  if(blocked)return;
  const outcome=triggerAlarmStimulus(currentRef.current,kind,at,intensity);
  commit(outcome.project,`${outcome.detected} alarm detector(s) responded; ${outcome.alerts} new alarm(s)`);setTab('alarm');
 };
 const alarmTime=(seconds:number)=>{
  if(blocked)return;
  try{commit(advanceAlarmTime(currentRef.current,seconds),`Alarm virtual clock advanced ${seconds}s`);setTab('alarm');}
  catch(e){setNotice(`Alarm clock rejected: ${String(e)}`);}
 };
 const alarmFault=(kind:'open'|'short'|'tamper'|'battery'|'mains'|'zone'|'wire')=>{
  if(blocked)return;
  const old=currentRef.current,next=injectAlarmFault(old,kind);
  if(next!==old){commit(next,`Alarm ${kind} fault injected`);setTab('alarm');}else setNotice('Install the appropriate alarm equipment to inject this fault');
 };
 const loadAlarmRig=()=>{
  if(blocked)return;if(!allowedInScenario(currentRef.current,'alarm-panel')){setNotice('This scenario does not permit intrusion alarm equipment');return;}
  const old=currentRef.current;
  if(old.devices.some(d=>profile(d.profileId).kind==='alarm-panel')){setNotice('Alarm panel already installed; edit or cable the existing panel');return;}
  let built=[...old.devices];
  const add=(id:string,x:number,y:number,zone?:number)=>{
   const d=createDevice(id,x,y,built);if(zone!==undefined&&d.alarmDevice)d.alarmDevice={...d.alarmDevice,zone};built.push(d);return d;
  };
  const panel=add('alarm-panel-8',435,425),pir=add('alarm-pir',360,195,2),door=add('alarm-door',475,93,1),beam=add('alarm-beam',150,175,3),keypad=add('alarm-keypad',500,408),siren=add('alarm-siren',690,95),strobe=add('alarm-strobe',745,95);
  const conf=panelConfig(panel);panel.alarmPanel={...conf,zones:conf.zones.map(z=>({...z,type:z.number===1?'entry':z.number===2?'interior':'instant'}))};
  pir.heading=90;beam.heading=0;
  const cables=[...old.cables,...[pir,door,beam,keypad,siren,strobe].map(d=>({id:crypto.randomUUID(),a:panel.id,b:d.id,connected:true,medium:'alarm' as const,lengthMeters:Math.max(1,Math.ceil(distance(panel,d)/scaleOf(old)))}))];
  commit({...old,devices:built,cables},'Wired seven-device alarm starter installed; arm in the Alarm Console after inspecting the zones');
  setSelected({kind:'device',id:panel.id});setTab('alarm');
 };
 // Stage 7 access commands are pure project transformations. No UI-only pass decisions.
 const accessPresent=(controllerId:string,readerId:string,method:AccessMethod,token:string)=>{
  if(blocked)return;try{const p=presentAccessToken(currentRef.current,controllerId,readerId,method,token);commit(p,'Synthetic access credential processed');setTab('access');}
  catch(e){setNotice(`Access denied: ${String(e)}`);}
 };
 const accessExit=(controllerId:string,buttonId:string)=>{
  if(blocked)return;try{commit(requestExit(currentRef.current,controllerId,buttonId),'Virtual exit input processed');setTab('access');}catch(e){setNotice(`Exit input: ${String(e)}`);}
 };
 const accessDoor=(controllerId:string,open:boolean)=>{
  if(blocked)return;try{commit(operateDoor(currentRef.current,controllerId,open),'Door contact changed');setTab('access');}catch(e){setNotice(`Door operation: ${String(e)}`);}
 };
 const accessAcknowledge=(controllerId:string)=>{
  if(blocked)return;try{commit(clearAccessAlarm(currentRef.current,controllerId),'Access alarm acknowledged');setTab('access');}catch(e){setNotice(`Cannot acknowledge: ${String(e)}`);}
 };
 const accessTime=(seconds:number)=>{
  if(blocked)return;try{commit(advanceAccessTime(currentRef.current,seconds),'Virtual access clock advanced');setTab('access');}catch(e){setNotice(`Access clock: ${String(e)}`);}
 };
 const accessFault=(kind:'wire'|'reader'|'lock'|'battery'|'power')=>{
  if(blocked)return;const p=injectAccessFault(currentRef.current,kind);if(p!==currentRef.current){commit(p,`Access ${kind} fault injected`);setTab('access');}else setNotice('Install matching access hardware to inject this fault');
 };
 const addIdentity=(name:string,cardToken:string,pinToken:string,biometricToken:string,controllerId:string)=>{
  if(blocked)return;
  const p=currentRef.current;if((p.accessIdentities||[]).length>=100){setNotice('Maximum 100 synthetic training identities');return;}
  const identity:AccessIdentity={id:crypto.randomUUID(),name:name.trim().slice(0,80)||'Trainee',enabled:true,cardToken:cardToken.slice(0,64),pinToken:pinToken.slice(0,64),biometricToken:biometricToken.slice(0,64),grants:controllerId?[{controllerId,days:[0,1,2,3,4,5,6],startMinute:0,endMinute:1440}]:[]};
  commit({...p,accessIdentities:[...(p.accessIdentities||[]),identity]},'Synthetic credential created');setTab('access');
 };
 const updateIdentity=(id:string,fields:Partial<AccessIdentity>)=>{
  if(blocked)return;const p=currentRef.current;commit({...p,accessIdentities:(p.accessIdentities||[]).map(i=>i.id===id?{...i,...fields,id:i.id}:i)},'Access permission updated');
 };
 const removeIdentity=(id:string)=>{
  if(blocked)return;const p=currentRef.current;commit({...p,accessIdentities:(p.accessIdentities||[]).filter(i=>i.id!==id)},'Synthetic credential deleted');
 };
 const loadAccessRig=()=>{
  if(blocked)return;if(!allowedInScenario(currentRef.current,'access-controller')){setNotice('This scenario does not permit access control equipment');return;}const p=currentRef.current;
  if(p.devices.some(d=>profile(d.profileId).kind==='access-controller')){setNotice('Access controller already installed. Configure its door and wiring.');return;}
  let walls=[...p.walls];let wall=walls.find(w=>w.kind==='door');
  if(!wall){wall={id:crypto.randomUUID(),kind:'door',x1:468,y1:405,x2:510,y2:405};walls.push(wall);}
  const units=[['access-controller-1',490,445],['access-reader-card',560,425],['access-reader-pin',600,425],['access-maglock',490,409],['access-exit-button',430,429]] as const;
  let devices=[...p.devices];const created=units.map(([id,x,y])=>{const d=createDevice(id,x,y,devices);devices.push(d);return d;});
  const controller=created[0];controller.accessController={...controllerConfig(controller),doorWallId:wall.id};
  const cables=[...p.cables,...created.slice(1).map(d=>({id:crypto.randomUUID(),a:controller.id,b:d.id,medium:'access' as const,connected:true,lengthMeters:Math.max(1,Math.ceil(distance(controller,d)/scaleOf(p)))}))];
  const trainee:AccessIdentity={id:crypto.randomUUID(),name:'Training Technician',enabled:true,cardToken:'CARD-1001',pinToken:'2468',biometricToken:'BIO-DEMO-1001',grants:[{controllerId:controller.id,days:[0,1,2,3,4,5,6],startMinute:480,endMinute:1080}]};
  if(commit({...p,walls,devices,cables,accessIdentities:[...(p.accessIdentities||[]),trainee],accessClock:{day:0,minute:540,second:0}},'Single-door access practice rig installed with demonstration credential')){
   setSelected({kind:'device',id:controller.id});setTab('access');
  }
 };
 // Stage 8 power lab: persistent electrical configuration, not UI-only status indicators.
 const setPowerSettings=(fields:Partial<NonNullable<Project['powerSettings']>>)=>{
  if(blocked)return;
  const old=currentRef.current,settings={...DEFAULT_POWER_SETTINGS,...old.powerSettings,...fields};
  if(!Number.isFinite(settings.solarPercent)||settings.solarPercent<0||settings.solarPercent>100){setNotice('Solar irradiance must be 0–100%');return;}
  commit({...old,powerSettings:settings},'Electrical supply design recalculated');setTab('power');
 };
 const powerTime=(minutes:number)=>{
  if(blocked)return;
  try{commit(advancePower(currentRef.current,minutes),`Power simulation advanced ${minutes} min`);setTab('power');}
  catch(e){setNotice(`Power time: ${String(e)}`);}
 };
 const powerFault=(fault:PowerFault)=>{
  if(blocked)return;
  const old=currentRef.current,next=injectPowerFault(old,fault);
  if(next!==old){commit(next,`Electrical ${fault} fault injected`);setTab('power');}
  else setNotice('No applicable electrical device or cable is installed for this fault');
 };
 const loadPowerRig=()=>{
  if(blocked)return;if(!allowedInScenario(currentRef.current,'power-solar')){setNotice('This scenario does not permit a solar PV installation');return;}const p=currentRef.current;
  if(p.devices.some(isPowerDevice)){setNotice('Power devices already exist. Use the equipment catalogue to customize wiring.');return;}
  if(p.devices.length>110||p.cables.length>210){setNotice('Remove equipment or cables before installing the starter: project safety limits would be exceeded');return;}
  const defs=[['power-grid',120,545],['power-ups',245,545],['power-ac-panel',370,545],['power-psu',500,545],
   ['power-solar',120,602],['power-controller',245,602],['power-battery',370,602],['power-inverter',500,602]] as const;
  const added:Device[]=[],byProfile=new Map<string,Device>();
  for(const [id,x,y] of defs){const d=createDevice(id,x,y,[...p.devices,...added]);added.push(d);byProfile.set(id,d);}
  const devices=[...p.devices,...added],cables=[...p.cables];
  const wire=(from:Device,to:Device)=>{
   if(cables.some(c=>(c.a===from.id&&c.b===to.id)||(c.b===from.id&&c.a===to.id)))return;
   const plan=plannedPowerCable(from,to);if(!plan)return;
   cables.push({id:crypto.randomUUID(),a:plan.a,b:plan.b,medium:plan.medium,connected:true,lengthMeters:Math.max(1,Math.ceil(distance(from,to)/scaleOf(p)))});
  };
  const grid=byProfile.get('power-grid')!,ups=byProfile.get('power-ups')!,panel=byProfile.get('power-ac-panel')!,psu=byProfile.get('power-psu')!;
  const solar=byProfile.get('power-solar')!,charger=byProfile.get('power-controller')!,battery=byProfile.get('power-battery')!,inverter=byProfile.get('power-inverter')!;
  wire(grid,ups);wire(ups,panel);wire(panel,psu);wire(solar,charger);wire(charger,battery);wire(battery,inverter);wire(inverter,panel);
  for(const d of p.devices){
   const k=profile(d.profileId).kind;
   if(['switch','nvr','dvr','router','ap','server','alarm-panel','access-controller','access-server'].includes(k))wire(panel,d);
   if(k==='camera'&&(profile(d.profileId).signal==='analog'||profile(d.profileId).wirelessCapable))wire(psu,d);
  }
  if(commit({...p,devices,cables,powerSettings:{mode:'wired',solarPercent:70,virtualMinutes:0}},'Grid, UPS, solar, battery, inverter and distribution rig installed; electrical mode enabled')){
   setSelected({kind:'device',id:panel.id});setTab('power');
  }
 };
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
   if(commit({...old,rooms:property.rooms,walls:property.walls,siteElements:property.elements,accessDoorStates:{},devices:old.devices.map(d=>d.accessController?{...d,accessController:{...d.accessController,doorWallId:''}}:d)},'Property template applied; access door assignments cleared because the physical wall IDs changed'))setSelected(null);
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
 const runAssessment=()=>{if(blocked)return;const p=currentRef.current,a=assess(p);
  const record:AssessmentRecord={id:crypto.randomUUID(),at:new Date().toISOString(),scenarioId:p.scenarioId,projectId:p.id,projectTitle:p.title,source:'local-simulation',assessment:a};
  commit({...p,assessments:[...(p.assessments||[]),record].slice(-50)},`Recorded local simulated assessment ${a.score}/100 — ${a.passed?'pass':'not yet passed'}`);setTab('assessment');};
 const downloadAssessment=(recordId:string,format:'html'|'json')=>{
  const record=currentRef.current.assessments?.find(a=>a.id===recordId);
  if(!record){setNotice('Select a saved assessment record before exporting');return;}
  const content=format==='html'?reportAsHtml(record):reportAsJson(record);
  const blob=new Blob([content],{type:format==='html'?'text/html;charset=utf-8':'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=`securitylab-assessment-${record.id.slice(0,12)}.${format}`;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
 };
 const workedExample=async()=>{
  if(!confirmDiscard('Loading the worked example'))return;
  commit(exampleProject(currentRef.current),'Assisted example loaded; assessment pass is disabled for demonstration');
 };
 const jsonExport=()=>{fileSession.current.downloadBackup(currentRef.current);setNotice('Backup JSON download requested. Confirm the file is present before closing.');};
 const imageImport=async(file:File)=>{
  if(blocked)throw new Error('Save or recover this project before importing an image');
  const startingProject=currentRef.current;
  const image=await readSafeFloorplanImage(file);
  // Decode is asynchronous. Do not silently overlay an image onto a different project or edited draft.
  if(currentRef.current!==startingProject){setNotice('The project changed while the image was loading. Select the image again to import it safely.');return;}
  commit({...startingProject,floorplanImage:image.dataUrl,floorplanSettings:startingProject.floorplanSettings||DEFAULT_FLOORPLAN},
   `Validated ${image.width} × ${image.height} local reference image imported`);
 };
 const jsonImport=async(file:File)=>{
  if(file.size>16_000_000)throw new Error('Project import limit: 16MB');
  const parsed=parseProjectText(await file.text(),file.name);
  if(!confirmDiscard('Importing a new project'))return;
  const now=new Date().toISOString(),p={...parsed.project,id:crypto.randomUUID(),title:`${parsed.project.title} (imported)`,createdAt:now,updatedAt:now};
  fileSession.current.detach();adopt(p,false);setNotice('Imported a separate project copy. Choose Save Project to keep it.');
 };
 const retrySave=async()=>{await saveCurrent(false,true);};
 const fork=()=>{
  const now=new Date().toISOString(),p={...currentRef.current,id:crypto.randomUUID(),createdAt:now,updatedAt:now,title:`${currentRef.current.title} (recovered)`};
  fileSession.current.detach();adopt(p,false);setNotice('Recovered draft is in memory. Save it to a new file before closing.');
 };
 const reload=async()=>{
  if(!window.confirm('Discard this draft and load the current contents of the selected local file?'))return;
  const parsed=await fileSession.current.reload();adopt(parsed.project,true);
 };
 const updateRoom=(id:string,fields:Partial<Room>)=>{const p=currentRef.current,old=p.rooms.find(r=>r.id===id);if(!old)return;const changed=normalizeRoom({...old,...fields,id});commit({...p,rooms:p.rooms.map(r=>r.id===id?changed:r),walls:transformRoomWalls(p.walls,old,changed)});};
 const updateWall=(id:string,fields:Partial<Wall>)=>{const p=currentRef.current,old=p.walls.find(w=>w.id===id),removeAccess=old?.kind==='door'&&fields.kind!==undefined&&fields.kind!=='door';const states={...p.accessDoorStates};if(removeAccess)delete states[id];commit({...p,walls:p.walls.map(w=>w.id===id?{...w,...fields,id,roomId:undefined}:w),accessDoorStates:states,devices:removeAccess?p.devices.map(d=>d.accessController?.doorWallId===id?{...d,accessController:{...d.accessController,doorWallId:''}}:d):p.devices});};
 return {project,result,assessment,scenario,scenarioProgress,isAllowedProfile,SCENARIOS,loaded,saveState,revision,fileName,saveError,blocked,notice,setNotice,selected,setSelected,mode,setMode,placing,setPlacing,
  cableStart,setCableStart,tab,setTab,listOpen,setListOpen,backups,openList,restoreBackup,canUndo,canRedo,generation,
  undo,redo,flush,saveCurrent,openNative,openFile,newBlank,switchScenario,update,removeSelection,install,selectOrCable,doMotion,addWall,addRoom,
  runFault,runAssessment,downloadAssessment,advanceTime,alarmCommand,alarmStimulus,alarmTime,alarmFault,loadAlarmRig,accessPresent,accessExit,accessDoor,accessAcknowledge,accessTime,accessFault,addIdentity,updateIdentity,removeIdentity,loadAccessRig,setPowerSettings,powerTime,powerFault,loadPowerRig,workedExample,jsonExport,jsonImport,imageImport,retrySave,fork,reload,commit,updateRoom,updateWall,
  addOpening,addSiteElement,moveRoom,resizeSelectedRoom,moveWall,editWallEndpoint,moveTarget,moveSiteElement,updateSiteElement,updateTarget,
  setPropertyScale,setFloorplanSettings,applyPropertyTemplate,moveDevice,nudgeSelected,renameProject,autosave,setAutosave,hasWritableHandle:fileSession.current.hasWritableHandle};
}
export type Workbench=ReturnType<typeof useWorkbench>;
