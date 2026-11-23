import React,{useEffect,useRef,useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {clockLabel} from '../../../src/engine/cctv.js';
import {canOpenNativeFile} from '../../../src/persistence/file-projects.js';
import {t} from '../../../src/i18n/index.js';
import {useLocale} from './Speak.js';
import {Icon} from './icons.js';

/** Top bar: logo, scenario, mode, live status chips and the Project menu (all file actions). */
export function TopBar({w,onRevealPanels,onProjectCenter}:{w:Workbench;onRevealPanels:()=>void;onProjectCenter:()=>void}){
 useLocale();
 const openFile=useRef<HTMLInputElement>(null),importFile=useRef<HTMLInputElement>(null),imageFile=useRef<HTMLInputElement>(null);
 const [menu,setMenu]=useState(false);const menuRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!menu)return;const close=(e:MouseEvent)=>{if(!menuRef.current?.contains(e.target as Node))setMenu(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMenu(false);};
  document.addEventListener('mousedown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key);};},[menu]);
 const handle=(action:()=>void|Promise<unknown>)=>{
  setMenu(false);
  try{Promise.resolve(action()).catch(e=>w.setNotice(`Operation failed: ${String(e)}`));}
  catch(e){w.setNotice(`Operation failed: ${String(e)}`);}
 };
 const armed=Object.values(w.result.alarm?.panels||{}).filter(p=>p.mode!=='disarmed').length;
 const mode=w.mode==='test'?'test':'design';
 const diagnosticCount=w.result.issues.length;
 const simulationLabel=w.project.devices.length===0?'No equipment yet':diagnosticCount?`${diagnosticCount} simulated issues`:'Model evaluated';
 const simulationTone=w.project.devices.length===0?'':diagnosticCount?'warn':'good';
 const item=(label:string,icon:string,on:()=>void,disabled=false,hint?:string)=><button role="menuitem" disabled={disabled} onClick={on} title={hint}><Icon name={icon} size={16}/>{label}</button>;
 return <header className="topbar">
  <div className="brand"><Icon name="shield" size={30}/><span><strong>SecurityLab</strong><small className={`brand-mobile-state ${w.saveState}`}>{w.saveState==='blocked'?'Save blocked':w.saveState==='saved'?'Project saved':w.saveState==='saving'?'Saving file…':'Unsaved draft'} · Virtual lab</small></span></div>
  <span className="brand-sub">Security Engineering Simulation Workstation</span>
  <label className="pill scenario-pill"><Icon name="folder" size={18}/><select aria-label="Scenario" value={w.project.scenarioId} onChange={e=>{const id=e.currentTarget.value;handle(()=>w.switchScenario(id));}}>{w.SCENARIOS.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label>
  <label className="pill mode-pill-select"><Icon name="play" size={16}/><select aria-label="Mode" value={mode} onChange={e=>{w.setMode(e.currentTarget.value==='test'?'test':'select');}}><option value="design">Design / Plan</option><option value="test">Test motion</option></select></label>
  <div className="status-chips" role="status" aria-label="Live status">
   <span className={"chip "+simulationTone}><i className="dot" aria-hidden="true"/>{simulationLabel}</span>
   <span className="chip"><Icon name="camera" size={16}/>{w.result.recordingCameras} recording</span>
   <span className="chip"><Icon name="alarm" size={16}/>{armed} alarm{armed===1?'':'s'}</span>
   <span className="chip"><Icon name="power" size={16}/>{(w.result.power?.totalLoadW||0).toFixed(0)} W</span>
   <span className="chip"><Icon name="events" size={16}/>{clockLabel(w.project)}</span>
  </div>
  <span className="topbar-spacer"/>
  <button className="primary assess-btn" onClick={()=>{onRevealPanels();w.runAssessment();}} disabled={w.blocked}><Icon name="assessment" size={16}/>{t('top.assess')}</button>
  <button className="project-center-button" onClick={onProjectCenter}>Project Center</button>
  <div className="project-menu" ref={menuRef}>
   <button aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(m=>!m)}><Icon name="file" size={16}/>Project<Icon name="chevron" size={14}/></button>
   {menu&&<div className="menu" role="menu" aria-label="Project">
    {item('Project Center','folder',()=>handle(onProjectCenter))}
    {item(t('top.new'),'file',()=>handle(w.newBlank))}
    {item(t('top.open'),'folder',()=>handle(()=>canOpenNativeFile()?w.openNative():openFile.current?.click()))}
    {item(t('top.save'),'file',()=>handle(()=>w.saveCurrent(false)),w.saveState==='saving')}
    {item(t('top.saveAs'),'file',()=>handle(()=>w.saveCurrent(true)),w.saveState==='saving')}
    {item(t('top.export'),'file',()=>handle(w.jsonExport))}
    {item(t('top.checkpoints'),'file',()=>handle(w.openList))}
    {item(t('top.import'),'file',()=>handle(()=>importFile.current?.click()))}
    <hr/>
    {item('Undo','undo',()=>handle(w.undo),!w.canUndo||w.blocked)}
    {item('Redo','redo',()=>handle(w.redo),!w.canRedo||w.blocked)}
    {item('Load Worked Example','scenarios',()=>handle(w.workedExample),w.blocked)}
    {item('Floor-plan image','image',()=>imageFile.current?.click(),w.blocked)}
   </div>}
  </div>
  <input type="file" hidden ref={openFile} accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)handle(()=>w.openFile(file));e.currentTarget.value='';}}/>
  <input type="file" hidden ref={importFile} accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)handle(()=>w.jsonImport(file));e.currentTarget.value='';}}/>
  <input type="file" hidden ref={imageFile} accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)handle(()=>w.imageImport(file));e.currentTarget.value='';}}/>
 </header>;
}
