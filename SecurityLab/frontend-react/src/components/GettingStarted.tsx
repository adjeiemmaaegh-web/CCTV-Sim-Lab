import React,{useRef} from 'react';
import {canOpenNativeFile} from '../../../src/persistence/file-projects.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import {Icon} from './icons.js';

/** Non-modal onboarding: the floor plan remains interactive and project files stay on device. */
export function GettingStarted({w,onBegin,onDismiss}:{w:Workbench;onBegin:()=>void;onDismiss:()=>void}){
 const picker=useRef<HTMLInputElement>(null);
 const run=(action:()=>void|Promise<unknown>)=>{
  try{void Promise.resolve(action()).then(onDismiss,e=>w.setNotice('Could not complete the action: '+String(e)));}
  catch(e){w.setNotice('Could not complete the action: '+String(e));}
 };
 return <aside className="getting-started" aria-label="Getting started">
  <div className="getting-started-head"><span className="intro-eyebrow"><Icon name="shield" size={14}/> QUICK START</span><button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss getting started" title="Dismiss"><Icon name="close" size={18}/></button></div>
  <h2>Build a security system, one step at a time.</h2>
  <p>Place equipment on your site plan, connect it, configure its behavior, then investigate virtual faults.</p>
  <div className="getting-started-actions">
   <button type="button" className="intro-primary" disabled={w.blocked} onClick={()=>{onBegin();onDismiss();}}><Icon name="equipment" size={17}/> Start designing</button>
   <button type="button" disabled={w.blocked} onClick={()=>run(w.workedExample)}><Icon name="scenarios" size={17}/> Worked example</button>
   <button type="button" disabled={w.blocked} onClick={()=>{if(canOpenNativeFile())run(w.openNative);else picker.current?.click();}}><Icon name="folder" size={17}/> Open project</button>
  </div>
  <p className="intro-footnote">Educational simulation only. Your project stays in a local file, not an online account.</p>
  <input ref={picker} type="file" hidden accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)run(()=>w.openFile(file));e.currentTarget.value='';}}/>
 </aside>;
}
