import React,{useEffect,useMemo,useState} from 'react';
import type {AssessmentRecord} from '../../../src/domain/types.js';
import {competencyTrend,headline} from '../../../src/engine/competency.js';
import type {Workbench} from '../hooks/useWorkbench.js';

/** Recordable, printable offline engineering competency review; not a certification screen. */
export function AssessmentConsole({w}:{w:Workbench}){
 const [selectedId,setSelectedId]=useState('live');
 useEffect(()=>setSelectedId('live'),[w.project.id]);
 const history=(w.project.assessments||[]).filter(r=>r.scenarioId===w.project.scenarioId);
 const selected:AssessmentRecord|undefined=history.find(r=>r.id===selectedId);
 const shown=selected?.assessment||w.assessment;
 const changed=!!selected?.assessment.fingerprint&&selected.assessment.fingerprint!==w.assessment.fingerprint;
 const trend=useMemo(()=>competencyTrend(history,w.project.scenarioId),[w.project.assessments,w.project.scenarioId]);
 return <section className="competency-panel" aria-label="Practical competency assessment">
  <header className="competency-header"><div><small>STAGE 11 · EVIDENCE-BASED ASSESSMENT</small><h3>Practical competency report</h3><p>Training feedback calculated from scenario objectives, recorded faults and the live simulation engine.</p></div>
   <div className="competency-score"><b>{shown.score}<small>/100</small></b><span>{shown.passed?'SIMULATED PASS':'IMPROVEMENT REQUIRED'}</span></div></header>
  <div className="competency-toolbar"><label>View <select aria-label="Select assessment report" value={selected?'historical:'+selected.id:'live'} onChange={e=>setSelectedId(e.target.value.startsWith('historical:')?e.target.value.slice(11):'live')}>
   <option value="live">Current live preview</option>{history.slice().reverse().map(r=><option value={'historical:'+r.id} key={r.id}>{new Date(r.at).toLocaleString()} · {r.assessment.score}/100</option>)}</select></label>
   <button onClick={w.runAssessment} disabled={w.blocked}>Record current assessment</button><button disabled={!selected} onClick={()=>selected&&w.downloadAssessment(selected.id,'html')}>Export printable HTML</button>
   <button disabled={!selected} onClick={()=>selected&&w.downloadAssessment(selected.id,'json')}>Export JSON evidence</button></div>
  {selected?<p className={changed?'competency-stale':'competency-context'} role="status">{changed?'The project has changed since this assessment was recorded. The displayed report is a historical snapshot; record another assessment for current results.':'Recorded snapshot: '+selected.at+' · '+(selected.projectTitle||w.project.title)}</p>:
   <p className="competency-context">Live preview only. Select “Record current assessment” to save a dated report before exporting.</p>}
  <p className="competency-disclaimer"><strong>Training only:</strong> This is a deterministic, local simulation result. It is not a verified professional qualification, manufacturer certification or assessment on physical hardware.</p>
  <div className="competency-cols"><div>
   <section><h4>Technical competency areas</h4>{shown.areas?.length?shown.areas.map(area=><div className="competency-area" key={area.id}><div><strong>{area.title}</strong><span>{area.earned.toFixed(1)} / {area.max} pts · {area.percent}%</span></div>
    <div className="competency-meter" role="progressbar" aria-label={area.title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={area.percent}><span style={{width:`${area.percent}%`}}/></div></div>):<p className="muted">Area breakdown is not present in this legacy assessment. Record a new Stage 11 report.</p>}</section>
   <section><h4>Pass and completion gates</h4>{shown.gates?.map(g=><div className="competency-gate" key={g.id}><strong className={g.met?'good':'warning-line'}>{g.met?'✓':'○'} {g.title}</strong><span>{g.description}</span></div>)||<p className="muted">Detailed gates not available in older saved records.</p>}</section>
   <section><h4>Recorded performance trend</h4>{trend.length?<div className="competency-trend" aria-label="Latest assessment scores">{trend.map((value,i)=><div key={i} title={`Attempt ${i+1}: ${value}/100`}><span style={{height:`${Math.max(3,value)}%`}}/><small>{value}</small></div>)}</div>:<p className="muted">Record attempts to compare results over time.</p>}</section>
  </div><div>
   <section><h4>Summary</h4><p>{shown.summary||headline(shown)}</p><p className="muted">Scenario rubric version: {shown.scenarioVersion??'Legacy'} · {shown.evidence?.length??0} recorded evidence items</p></section>
   <section><h4>Mistakes and corrective actions</h4>{(shown.findings||[]).some(f=>f.severity!=='information')?shown.findings!.filter(f=>f.severity!=='information').slice(0,16).map(f=><article className="competency-finding" key={f.id}><small>{f.severity.toUpperCase()} · {f.category.toUpperCase()}</small><strong>{f.title}</strong><p>{f.description}</p><p><b>Fix:</b> {f.recommendation}</p></article>):<p className="good">No assessed technical mistakes in this snapshot.</p>}
    {(shown.findings||[]).filter(f=>f.severity==='information').length>0&&<details><summary>Active simulation diagnostics ({shown.findings!.filter(f=>f.severity==='information').length})</summary>{shown.findings!.filter(f=>f.severity==='information').map(f=><p key={f.id} className="warning-line">{f.description}</p>)}</details>}</section>
   <section><h4>Measured operational evidence</h4>{shown.evidence?.length?<div className="competency-evidence">{shown.evidence.map(e=><div key={e.id}><span className={e.met?'good':'warning-line'}>{e.met?'✓':'○'}</span><span><b>{e.title}</b><small>{e.actual}/{e.required} · {e.source.replace('-', ' ')} · {e.details}</small></span></div>)}</div>:<p className="muted">The legacy record has no detailed evidence snapshot.</p>}</section>
  </div></div>
 </section>;
}
