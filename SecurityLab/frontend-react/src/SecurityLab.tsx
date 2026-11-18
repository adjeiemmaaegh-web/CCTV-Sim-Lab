import {ProjectCenter,RequestDialog,ConnectionPreview} from './components/ProjectCenter.js';
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
import type {WorkflowStep} from './components/WorkflowStrip.js';

export function SecurityLab(){
 const w=useWorkbench();
 const [panel,setPanel]=useState<Panel>(null);
 const [projectCenter,setProjectCenter]=useState(false);
 const [focusCanvas,setFocusCanvas]=useState(false);
 const [catalogVisible,setCatalogVisible]=useState(true);
 const [inspectorVisible,setInspectorVisible]=useState(true);
 const [consoleVisible,setConsoleVisible]=useState(true);
 const [catalogWidth,setCatalogWidth]=useState(280);
 const [inspectorWidth,setInspectorWidth]=useState(300);
 useEffect(()=>{if(w.focusRequest){setFocusCanvas(false);setInspectorVisible(true);}},[w.focusRequest]);
 useEffect(()=>{if(!w.notice)return;const id=setTimeout(()=>w.setNotice(''),12000);return()=>clearTimeout(id);},[w.notice]);
 const currentWorkbench=useRef(w);currentWorkbench.current=w;
 useEffect(()=>setupOffline(async()=>{
  const active=currentWorkbench.current;
  if(!active.loaded||active.blocked)return false;
  try{await active.flush();return true;}catch(e){active.setNotice(`Update deferred: ${String(e)}`);return false;}
 },()=>{
  const active=currentWorkbench.current;
  // A peer tab can only consent when its draft is already confirmed saved.
  // Do not invoke a picker or autosave on behalf of another tab.
  return active.loaded&&!active.blocked&&active.saveState!=='saving'&&!active.hasUnsavedWork();
 }),[]);
 useEffect(()=>{const check=(e:BeforeUnloadEvent)=>{
  const current=currentWorkbench.current;
  if(current.hasUnsavedWork()){e.preventDefault();e.returnValue='';}
 };window.addEventListener('beforeunload',check);return()=>window.removeEventListener('beforeunload',check);},[]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{
  const w=currentWorkbench.current;
  if(document.querySelector('[role=dialog]'))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){
   e.preventDefault();void w.saveCurrent(e.shiftKey);return;
  }
  if(w.listOpen||w.dialog||w.pendingCable)return; // the checkpoint dialog owns its own keyboard events.
  if(e.key==='Escape'){w.setSelected(null);w.setPlacing(null);w.setCableStart(null);w.setMode('select');}
  const t=e.target as HTMLElement;
  if(t?.closest('input,textarea,select,button,[contenteditable="true"]'))return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)w.redo();else w.undo();}
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='y'){e.preventDefault();w.redo();}
  if(e.key==='Delete'&&!w.blocked&&!w.canvasLocks.has(w.selected?.id??''))w.removeSelection();

  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)&&w.selected&&!w.blocked&&!w.canvasLocks.has(w.selected.id)){
   e.preventDefault();const step=e.shiftKey?10:1;w.nudgeSelected(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);
  }
 };document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[]);
 const handle=(task:()=>void|Promise<unknown>)=>{try{Promise.resolve(task()).catch(e=>w.setNotice(`Operation failed: ${String(e)}`));}catch(e){w.setNotice(`Operation failed: ${String(e)}`);}};

 const revealPanels=()=>{setFocusCanvas(false);setCatalogVisible(true);setInspectorVisible(true);setConsoleVisible(true);};
 const chooseWorkflow=(step:WorkflowStep)=>{
  if(step==='save'){setProjectCenter(true);return;}
  setFocusCanvas(false);
  if(step==='place'){setCatalogVisible(true);
   w.setTab('scenario');w.setActivity('design');w.setPlacing(null);w.setMode('select');
   w.setNotice('Step 1 · Choose equipment from the library and place it on the plan.');return;
  }
  if(step==='connect'){setInspectorVisible(true);w.setTab('network');w.setActivity('connect');
   if(w.project.devices.length<2){w.setNotice('Step 2 · Place at least two compatible devices before wiring.');return;}
   w.setPlacing(null);w.setCableStart(null);w.setMode('cable');
   w.setNotice('Step 2 · Click two compatible devices. Review the resulting cable in Connection setup.');return;
  }
  if(step==='configure'){setInspectorVisible(true);w.setTab('systems');w.setActivity('design');
   const d=w.project.devices.find(d=>w.project.cables.some(c=>c.a===d.id||c.b===d.id))||w.project.devices[0];
   w.setPlacing(null);w.setMode('select');
   if(d){w.setSelected({kind:'device',id:d.id});w.setNotice('Step 3 · Review the device Properties and Network settings.');}
   else w.setNotice('Step 3 · Place a device first, then select it to configure its modeled behavior.');
   return;
  }
  if(step==='test'){setConsoleVisible(true);w.setTab('diagnostics');w.setNotice('Step 4 · Inspect live simulated issues; choose an injected training fault only when useful.');}
 };

 return <main className="workstation shell"><a className="skip-link" href="#securitylab-workspace">Skip to engineering workspace</a><TopBar w={w} onRevealPanels={revealPanels} onProjectCenter={()=>setProjectCenter(true)}/>
 <div className={`shell-body ${focusCanvas?'canvas-focus-mode':''} ${consoleVisible?'':'console-collapsed'}`}><NavRail w={w} openPanel={setPanel} onView={w.setView} onRevealPanels={revealPanels}/>
 <div className={`main-grid ${catalogVisible?'':'catalog-collapsed'} ${inspectorVisible?'':'inspector-collapsed'}`} style={{'--catalog-width':`${catalogWidth}px`,'--inspector-width':`${inspectorWidth}px`} as React.CSSProperties}>
  <Catalog w={w}/>
  <Canvas w={w} focusMode={focusCanvas} onToggleFocus={()=>setFocusCanvas(v=>!v)} onWorkflow={chooseWorkflow}
   layout={{catalogVisible,inspectorVisible,consoleVisible,catalogWidth,inspectorWidth,
    toggleCatalog:()=>setCatalogVisible(v=>!v),toggleInspector:()=>setInspectorVisible(v=>!v),toggleConsole:()=>setConsoleVisible(v=>!v),
    setCatalogWidth,setInspectorWidth,reset:()=>{revealPanels();setCatalogWidth(280);setInspectorWidth(300);}}}/>
  <Inspector w={w}/></div>
 <Console w={w}/></div>
 <footer className="status-footer"><span className="footer-note"><Icon name="info" size={16}/>SecurityLab &ndash; Educational simulation only. Manufacturer profiles are simulated or based on documented references. Not real device firmware, and no manufacturer certification is implied.</span>
 <span className={`save ${w.saveState}`} title={w.fileName} role="status" aria-label="Project save status">Project: {w.saveState==='saved'?`Saved \u00b7 revision ${w.revision}`:w.saveState==='saving'?'Writing file\u2026':w.saveState==='blocked'?'File save blocked':'Unsaved changes'}</span></footer>
 {w.notice&&<div className="toast" role="status">{w.notice}<button aria-label="Dismiss notification" onClick={()=>w.setNotice('')}>×</button></div>}
 {w.saveError&&<div role="alert" className="error-banner"><strong>Local file protection: </strong>{w.saveError}<div><button onClick={w.jsonExport}>Export backup now</button><button onClick={()=>handle(w.retrySave)}>Retry</button><button onClick={()=>handle(()=>w.saveCurrent(true))}>Save As new file</button><button onClick={w.fork}>Fork draft</button><button onClick={()=>handle(w.reload)} disabled={!w.hasWritableHandle}>Reload file</button></div></div>}
 {projectCenter&&<ProjectCenter w={w} onClose={()=>setProjectCenter(false)}/>}
 {w.dialog&&<RequestDialog w={w}/>}
 {w.pendingCable&&<ConnectionPreview w={w}/>}
 {w.listOpen&&<CheckpointDialog w={w}/>}
 {panel==='settings'&&<SettingsDialog w={w} onClose={()=>setPanel(null)}/>}
 {panel==='help'&&<HelpDialog onClose={()=>setPanel(null)}/>}
 </main>;
}
