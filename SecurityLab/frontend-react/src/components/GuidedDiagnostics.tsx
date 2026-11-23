import {simulate} from '../../../src/engine/simulator.js';
import React,{useEffect,useState} from 'react';
import {guidedDiagnostics} from '../../../src/tools/diagnostics-guide.js';
import type {DiagnosticArea} from '../../../src/tools/diagnostics-guide.js';
import type {Workbench} from '../hooks/useWorkbench.js';

const areas:{id:DiagnosticArea|'all';label:string}[]=[
 {id:'all',label:'All checks'},{id:'cable',label:'Connections'},{id:'power',label:'Power/PoE'},
 {id:'ip',label:'Network/IP'},{id:'recording',label:'Recording'},{id:'coverage',label:'Coverage'},
 {id:'alarm',label:'Alarm'},{id:'access',label:'Access'},{id:'other',label:'Other'}
];

/**
 * A rule-based teaching guide. Selection navigates to a *real model entity*;
 * these steps never mutate the project or pretend to perform physical repairs.
 */
export function GuidedDiagnostics({w}:{w:Workbench}){
 const [recheck,setRecheck]=useState('');
 const [watched,setWatched]=useState<{id:string;title:string}|null>(null);
 useEffect(()=>{setWatched(null);setRecheck('');},[w.project.id]);
 const rerun=(item:{id:string;title:string})=>{setWatched(item);const found=guidedDiagnostics(w.project,simulate(w.project)).find(f=>f.id===item.id);setRecheck(`${item.title}: ${found?'Still needs attention — '+found.evidence:'Original finding cleared. Review remaining checks.'}`);};
 const [area,setArea]=useState<DiagnosticArea|'all'>('all');
 const findings=guidedDiagnostics(w.project,w.result);
 const filtered=area==='all'?findings:findings.filter(f=>f.area===area);
 const critical=findings.filter(f=>f.severity==='critical').length;
 return <section className="guided-diagnostics" aria-label="Guided troubleshooting">
  <header className="guided-head">
   <div><strong>Guided troubleshooting</strong><small>{findings.length} current virtual check(s) · {critical} high-priority</small></div>
   <label>Area <select aria-label="Diagnostic category" value={area} onChange={e=>setArea(e.currentTarget.value as DiagnosticArea|'all')}>
    {areas.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
   </select></label>
  </header>
  <p className="guided-caveat">Evidence below is recalculated from this saved simulation model. It is not a physical test, compliance check or professional installation sign-off.</p>
  {watched&&<div className="guided-actions"><strong>Selected check: {watched.title}</strong><button onClick={()=>rerun(watched)}>Rerun selected check</button></div>}
  {recheck&&<p role="status">{recheck}</p>}
  {filtered.length===0?<p className="good">No current modeled findings in this category. This does not prove that equipment is safe or configured correctly.</p>:
   <div className="guided-findings">{filtered.map(f=><article key={f.id} className={'guided-finding '+f.severity}>
    <div className="guided-finding-title"><span className="guided-severity">{f.severity==='critical'?'HIGH':f.severity==='warning'?'CHECK':'INFO'}</span><strong>{f.title}</strong></div>
    <p><b>Simulated evidence:</b> {f.evidence}</p>
    <p><b>Next investigation:</b> {f.nextStep}</p>
    <div className="guided-actions">
     {f.entity&&<button disabled={w.blocked} onClick={()=>{setWatched({id:f.id,title:f.title});w.locate(f.entity!);}}>{f.entity.kind==='cable'?'Inspect connection':'Inspect device'}</button>}
     <button onClick={()=>rerun(f)}>Rerun this check</button>
     {f.route!=='diagnostics'&&<button onClick={()=>w.setTab(f.route)}>Open {f.route} view</button>}
    </div>
   </article>)}</div>}
 </section>;
}
