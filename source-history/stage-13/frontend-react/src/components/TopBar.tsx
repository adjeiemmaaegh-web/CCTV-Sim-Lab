import React,{useRef} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {clockLabel} from '../../../src/engine/cctv.js';
import {canOpenNativeFile} from '../../../src/persistence/file-projects.js';

export function TopBar({w}:{w:Workbench}){
 const openFile=useRef<HTMLInputElement>(null),importFile=useRef<HTMLInputElement>(null);
 const handle=(action:()=>void|Promise<unknown>)=>{
  try{Promise.resolve(action()).catch(e=>w.setNotice(`Operation failed: ${String(e)}`));}
  catch(e){w.setNotice(`Operation failed: ${String(e)}`);}
 };
 return <><header className="topbar">
  <div className="brand"><span className="brand-symbol">⬡</span><span><strong>SECURITY<span>LAB</span></strong><small>VIRTUAL ENGINEERING WORKSTATION</small></span></div>
  <span className="mode-pill">OFFLINE • FILE-BASED</span>
  <span className="project-title" title={w.fileName}>{w.project.title} <button className="rename-small" title="Rename project" disabled={w.blocked} onClick={()=>{const name=window.prompt('New project title',w.project.title);if(name!==null)w.renameProject(name);}}>✎</button></span>
  <div className="top-actions">
   <button onClick={()=>handle(w.newBlank)}>New</button>
   <button onClick={()=>canOpenNativeFile()?handle(w.openNative):openFile.current?.click()}>Open JSON</button>
   <button onClick={()=>handle(()=>w.saveCurrent(false))} disabled={w.saveState==='saving'}>Save Project</button>
   <button onClick={()=>handle(()=>w.saveCurrent(true))} disabled={w.saveState==='saving'}>Save As</button>
   <button onClick={w.jsonExport}>Export Backup</button>
   <button onClick={w.openList}>Checkpoints</button>
   <button onClick={()=>importFile.current?.click()}>Import Copy</button>
   <button className="primary" onClick={w.runAssessment} disabled={w.blocked}>Assess Installation</button>
  </div>
  <input type="file" hidden ref={openFile} accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)handle(()=>w.openFile(file));e.currentTarget.value='';}}/>
  <input type="file" hidden ref={importFile} accept=".json,application/json" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)handle(()=>w.jsonImport(file));e.currentTarget.value='';}}/>
 </header>
 <div className="subbar"><span>LABORATORY / CCTV · NETWORK · ALARM · ACCESS · POWER · PRACTICE</span>
  <label>Scenario <select aria-label="Scenario" value={w.project.scenarioId} onChange={e=>{const id=e.currentTarget.value;handle(()=>w.switchScenario(id));}}>{w.SCENARIOS.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label>
  <button onClick={()=>w.setTab('scenario')} title="Open practical assignment briefing">Briefing · {w.scenarioProgress.completed}/{w.scenarioProgress.total}</button>
  <label title="Available only after a project file has been explicitly chosen and writable access granted"><input type="checkbox" checked={w.autosave} disabled={!w.hasWritableHandle||w.blocked} onChange={e=>w.setAutosave(e.currentTarget.checked)}/> Autosave to file</label>
  <span className="subbar-right"><span className="good">● {w.result.onlineCameras} online</span><span className="good">● {w.result.recordingCameras} recording</span><span>GHS {w.result.budgetUsedGhs.toLocaleString()}</span><span>⚡ {(w.result.power?.totalLoadW||0).toFixed(0)} W</span><span>⚑ {Object.values(w.result.alarm?.panels||{}).filter(p=>p.mode!=='disarmed').length} alarm armed</span><span>◷ {clockLabel(w.project)}</span><label><input type="checkbox" checked={w.project.night} disabled={w.blocked} onChange={e=>w.commit({...w.project,night:e.currentTarget.checked})}/> Night</label><label><input type="checkbox" checked={w.project.mainsOn} disabled={w.blocked} onChange={e=>w.commit({...w.project,mainsOn:e.currentTarget.checked})}/> AC power</label></span>
 </div></>;
}
