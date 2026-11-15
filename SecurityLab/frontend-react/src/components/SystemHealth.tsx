import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {LabKey} from '../../../src/engine/integration.js';

const destination:Record<LabKey,Workbench['tab']>={cctv:'recordings',network:'network',alarm:'alarm',access:'access',power:'power',scenario:'scenario'};
const names:Record<LabKey,string>={cctv:'Open recording status',network:'Open network diagnostics',alarm:'Open alarm console',access:'Open access console',power:'Open power console',scenario:'Open scenario briefing'};

/** All counts and warnings are projected from the authoritative simulation. */
export function SystemHealth({w}:{w:Workbench}){
 const health=w.systems;
 return <section className="systems-overview" aria-label="Integrated installation status">
  <header><div><small>STAGE 15 · INTEGRATED LABORATORY</small><h3>System health</h3><p>Current simulated conditions across the five technical laboratories and the active assignment.</p></div>
   <div className="systems-totals"><strong>{health.readyLabs}/{health.activeLabs}</strong><small>active areas meeting local simulation checks</small></div>
  </header>
  <p className="systems-disclaimer">This is a teaching-model diagnostic snapshot, not a commissioning certificate, safety approval, field test or proof of manufacturer compatibility.</p>
  <div className="systems-grid">{health.labs.map(lab=><article key={lab.id} className={`system-card ${lab.status}`}>
   <div className="system-card-head"><strong>{lab.title}</strong><span>{lab.status==='ready'?'Model checks met':lab.status==='attention'?'Needs attention':'Not configured'}</span></div>
   <p>{lab.description}</p>
   {lab.details.length?<ul>{lab.details.map((item,index)=><li key={index}>{item}</li>)}</ul>:<p className="system-summary">{lab.status==='ready'?'No issues reported by this module.':'Install and configure equipment to see module diagnostics.'}</p>}
   <button type="button" onClick={()=>w.setTab(destination[lab.id])}>{names[lab.id]}</button>
  </article>)}</div>
  <p className="systems-footer">{health.criticalObjectives} critical scenario objective(s) incomplete · {w.result.issues.length} simulation issue(s) across the complete project.</p>
 </section>;
}
