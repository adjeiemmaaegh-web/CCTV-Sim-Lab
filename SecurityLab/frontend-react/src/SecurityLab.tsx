import React,{useEffect,useRef,useState} from 'react';
import {setupOffline} from './offline.js';
import {useWorkbench} from './hooks/useWorkbench.js';
import {TopBar} from './components/TopBar.js';
import {Catalog} from './components/Catalog.js';
import {Canvas} from './components/Canvas.js';
import {Inspector} from './components/Inspector.js';
import {Console} from './components/Console.js';
import {CheckpointDialog} from './components/CheckpointDialog.js';
import {NavRail,type Panel} from './components/NavRail.js';
import {SettingsDialog,HelpDialog} from './components/Dialogs.js';
import {Icon} from './components/icons.js';

export function SecurityLab(){
 const w=useWorkbench();
 const [section,setSection]=useState('equipment');const [panel,setPanel]=useState<Panel>(null);
 const [focusCanvas,setFocusCanvas]=useState(false);
 useEffect(()=>{if(!w.notice)return;const id=setTimeout(()=>w.setNotice(''),12000);return()=>clearTimeout(id);},[w.notice]);
 const currentWorkbench=useRef(w);currentWorkbench.current=w;
 useEffect(()=>setupOffline(async()=>{
  const active=currentWorkbench.current;
  if(!active.loaded||active.blocked)return false;
  try{await active.flush();return true;}catch(e){active.setNotice(`Update deferred: ${String(e)}`);return false;}
 }),[]);
 useEffect(()=>{const check=(e:BeforeUnloadEvent)=>{
  const current=currentWorkbench.current;
  if(current.hasUnsavedWork()){e.preventDefault();e.returnValue='';}
 };window.addEventListener('beforeunload',check);return()=>window.removeEventListener('beforeunload',check);},[]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{
  const w=currentWorkbench.current;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
   e.preventDefault();void w.saveCurrent(e.shiftKey);return;
  }
  if(w.listOpen)return; // the checkpoint dialog owns its own keyboard events.
  const t=e.target as HTMLElement;
  if(t?.closest('input,textarea,select,button,[contenteditable="true"]'))return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)w.redo();else w.undo();}
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='y'){e.preventDefault();w.redo();}
  if(e.key==='Delete'&&!w.blocked)w.removeSelection();
  if(e.key==='Escape'){w.setSelected(null);w.setPlacing(null);w.setMode('select');}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&w.selected&&!w.blocked){
   e.preventDefault();const step=e.shiftKey?10:1;w.nudgeSelected(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);
  }
 };document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[]);
 const handle=(task:()=>void|Promise<unknown>)=>{try{Promise.resolve(task()).catch(e=>w.setNotice(`Operation failed: ${String(e)}`));}catch(e){w.setNotice(`Operation failed: ${String(e)}`);}};
 return <main className="workstation shell"><a className="skip-link" href="#securitylab-workspace">Skip to engineering workspace</a><TopBar w={w}/>
 <div className={`shell-body ${focusCanvas?'canvas-focus-mode':''}`}><NavRail w={w} section={section} setSection={setSection} openPanel={setPanel} onView={w.setView}/>
 <div className="main-grid"><Catalog w={w}/><Canvas w={w} focusMode={focusCanvas} onToggleFocus={()=>setFocusCanvas(v=>!v)}/><Inspector w={w}/></div>
 <Console w={w}/></div>
 <footer className="status-footer"><span className="footer-note"><Icon name="info" size={16}/>SecurityLab &ndash; Educational simulation only. Manufacturer profiles are simulated or based on documented references. Not real device firmware, and no manufacturer certification is implied.</span>
 <span className={`save ${w.saveState}`} title={w.fileName}>Project: {w.saveState==='saved'?`Saved \u00b7 revision ${w.revision}`:w.saveState==='saving'?'Writing file\u2026':w.saveState==='blocked'?'File save blocked':'Unsaved changes'}</span></footer>
 {w.notice&&<div className="toast" role="status">{w.notice}<button aria-label="Dismiss notification" onClick={()=>w.setNotice('')}>×</button></div>}
 {w.saveError&&<div role="alert" className="error-banner"><strong>Local file protection: </strong>{w.saveError}<div><button onClick={w.jsonExport}>Export backup now</button><button onClick={()=>handle(w.retrySave)}>Retry</button><button onClick={()=>handle(()=>w.saveCurrent(true))}>Save As new file</button><button onClick={w.fork}>Fork draft</button><button onClick={()=>handle(w.reload)} disabled={!w.hasWritableHandle}>Reload file</button></div></div>}
 {w.listOpen&&<CheckpointDialog w={w}/>}
 {panel==='settings'&&<SettingsDialog w={w} onClose={()=>setPanel(null)}/>}
 {panel==='help'&&<HelpDialog onClose={()=>setPanel(null)}/>}
 </main>;
}
