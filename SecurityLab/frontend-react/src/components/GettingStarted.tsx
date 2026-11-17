import React,{useRef} from 'react';
import {canOpenNativeFile} from '../../../src/persistence/file-projects.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import {Icon} from './icons.js';

/** Task-based, non-modal introduction. Project and scenario actions delegate to the original workbench. */
export function GettingStarted({w,onBegin,onDismiss}:{w:Workbench;onBegin:()=>void;onDismiss:()=>void}){
 const picker=useRef<HTMLInputElement>(null);
 const run=(action:()=>void|Promise<unknown>)=>{
  try{void Promise.resolve(action()).then(onDismiss,e=>w.setNotice('Could not complete the action: '+String(e)));}
  catch(e){w.setNotice('Could not complete the action: '+String(e));}
 };
 return <aside className="getting-started" aria-label="Getting started">
  <div className="getting-started-head"><span className="intro-eyebrow"><Icon name="shield" size={14}/> FIELD TRAINING · QUICK START</span><button type="button" className="icon-btn" onClick={onDismiss} aria-label="Dismiss getting started" title="Dismiss"><Icon name="close" size={18}/></button></div>
  <h2>Design a working security installation.</h2>
  <p>Build on the plan, connect compatible equipment, check the virtual system, and fix faults. Your work stays on this device until you save a project file.</p>
  <div className="intro-journey" aria-label="Four steps to complete a virtual installation">
   <div><b>1</b><span><strong>Pick a challenge</strong>Choose a scenario, or start with a blank plan.</span></div>
   <div><b>2</b><span><strong>Build and connect</strong>Place devices, draw cables, adjust properties.</span></div>
   <div><b>3</b><span><strong>Test and repair</strong>Read diagnostics and resolve the modeled faults.</span></div>
   <div><b>4</b><span><strong>Assess and save</strong>Record a scored report, then save a local file.</span></div>
  </div>
  <label className="intro-scenario">Training challenge
   <select aria-label="Choose training challenge" value={w.project.scenarioId} disabled={w.blocked} onChange={e=>{const id=e.currentTarget.value;run(()=>w.switchScenario(id));}}>
    {w.SCENARIOS.map(s=><option key={s.id} value={s.id}>{s.title} · {s.difficulty}</option>)}
   </select>
  </label>
  <p className="intro-prompt">Ready to build? You can reopen this guide from the canvas toolbar.</p>
  <div className="getting-started-actions">
   <button type="button" className="intro-primary" disabled={w.blocked} onClick={()=>{onBegin();onDismiss();}}><Icon name="equipment" size={17}/> Start designing</button>
   <button type="button" disabled={w.blocked} onClick={()=>{w.setTab('scenario');onDismiss();}}><Icon name="scenarios" size={17}/> View challenge brief</button>
   <button type="button" disabled={w.blocked} onClick={()=>run(w.newBlank)}><Icon name="file" size={17}/> New blank project</button>
   <button type="button" disabled={w.blocked} onClick={()=>run(w.workedExample)}><Icon name="assessment" size={17}/> Worked example</button>
   <button type="button" onClick={()=>{if(canOpenNativeFile())run(w.openNative);else picker.current?.click();}}><Icon name="folder" size={17}/> Open saved project</button>
  </div>
  <p className="intro-footnote">Scores measure simulated evidence, not real-world certification. Use Project → Save As or Export Backup to retain a portable JSON file.</p>
  <input ref={picker} type="file" hidden accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)run(()=>w.openFile(file));e.currentTarget.value='';}}/>
 </aside>;
}
