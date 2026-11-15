import React,{useRef} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {clockLabel} from '../../../src/engine/cctv.js';
export function TopBar({w}:{w:Workbench}){
 const importFile=useRef<HTMLInputElement>(null);
 const handle=(action:()=>void|Promise<void>)=>{Promise.resolve().then(action).catch(e=>w.setNotice(`Operation failed: ${String(e)}`));};
 return <><header className="topbar">
  <div className="brand"><span className="brand-symbol">⬡</span><span><strong>SECURITY<span>LAB</span></strong><small>VIRTUAL ENGINEERING WORKSTATION</small></span></div>
  <span className="mode-pill">LOCAL SIMULATION</span><span className="project-title">{w.project.title} <button className="rename-small" title="Rename project" disabled={w.blocked} onClick={()=>{const name=window.prompt('New project title',w.project.title);if(name!==null)w.renameProject(name);}}>✎</button></span>
  <div className="top-actions"><button onClick={()=>handle(w.openList)}>Open</button><button onClick={()=>handle(w.flush)} disabled={w.blocked}>Save Project</button>
   <button onClick={w.jsonExport}>Export</button><button onClick={()=>importFile.current?.click()}>Import</button><button className="primary" onClick={w.runAssessment} disabled={w.blocked}>Assess Installation</button></div>
  <input type="file" hidden ref={importFile} accept=".json,application/json" onChange={async e=>{const f=e.currentTarget.files?.[0];if(!f)return;handle(()=>w.jsonImport(f));e.currentTarget.value='';}}/>
 </header><div className="subbar"><span>LABORATORY / CCTV · NETWORK · ALARM · ACCESS · POWER</span><label>Scenario <select aria-label="Scenario" value={w.project.scenarioId} onChange={e=>{const id=e.currentTarget.value;handle(()=>w.switchScenario(id));}}>{w.SCENARIOS.map(s=><option value={s.id} key={s.id}>{s.title}</option>)}</select></label>
   <span className="subbar-right"><span className="good">● {w.result.onlineCameras} online</span><span className="good">● {w.result.recordingCameras} recording</span><span>GHS {w.result.budgetUsedGhs.toLocaleString()}</span><span>⚡ {(w.result.power?.totalLoadW||0).toFixed(0)} W</span><span>⚑ {Object.values(w.result.alarm?.panels||{}).filter(p=>p.mode!=='disarmed').length} alarm armed</span><span>◷ {clockLabel(w.project)}</span><label><input type="checkbox" checked={w.project.night} disabled={w.blocked} onChange={e=>w.commit({...w.project,night:e.currentTarget.checked})}/> Night</label><label><input type="checkbox" checked={w.project.mainsOn} disabled={w.blocked} onChange={e=>w.commit({...w.project,mainsOn:e.currentTarget.checked})}/> AC power</label></span>
 </div></>;
}
