import React,{useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';

/** Stage 10 scenario briefing and operational evidence; updates as simulation results change. */
export function ScenarioConsole({w}:{w:Workbench}){
 const [showHints,setShowHints]=useState(false);
 const s=w.scenario,e=w.scenarioProgress;
 const recent=(w.project.assessments||[]).filter(a=>a.scenarioId===s.id).slice(-3).reverse();
 return <section className="scenario-panel" aria-label="Practical scenario requirements">
  <div className="scenario-intro"><div><small>SCENARIO {s.id.toUpperCase()} · {s.difficulty.toUpperCase()} · {s.focus.toUpperCase()}</small><h3>{s.title}</h3><p>{s.description}</p></div>
   <div className="scenario-score"><strong>{e.completed}/{e.total}</strong><small>OBJECTIVES</small><span>{e.score}/100 provisional score</span></div></div>
  <div className="scenario-progress"><div style={{width:`${Math.round(e.completed*100/Math.max(e.total,1))}%`}}/></div>
  <div className="scenario-cols"><div><h4>Practical assignment</h4><ol>{s.instructions.map((line,i)=><li key={i}>{line}</li>)}</ol><p className="muted">Scenario budget: GHS {s.budgetGhs.toLocaleString()} (illustrative generic equipment prices; manufacturer quotations entered separately)</p>
   <p className="muted">Recommended starters: {s.starterProfiles.map(x=>x.replace(/-/g,' ')).join(' · ')}</p>
   {e.unpermittedDevices>0&&<p className="warning-line">{e.unpermittedDevices} installed devices are outside the permitted scenario equipment list. Remove them before assessment.</p>}
   {e.challenges.length>0&&<div className="scenario-challenges"><h4>Incident challenges · {e.challenges.filter(x=>x.resolved).length}/{e.challenges.length} resolved</h4><p className="muted">The original installed equipment must be repaired. Removing a fault source does not count as a repair.</p>
    {e.challenges.map(c=><p key={c.id} className={c.resolved?'good':'warning-line'}>{c.resolved?'✓ Resolved':'◆ Unresolved incident'} — {showHints||c.resolved?c.label:'Undiagnosed fault'}{showHints&&!c.resolved?<small> · {c.hint}</small>:null}</p>)}
    <button onClick={()=>setShowHints(v=>!v)}>{showHints?'Conceal diagnostic hints':'Reveal diagnostic hints'}</button>
   </div>}
  </div><div><h4>Measured technical outcomes</h4><div className="scenario-objectives">{e.objectives.map(o=><div className="scenario-objective" key={o.id}>
    <span aria-label={o.complete?'Completed':'Not completed'} className={o.complete?'good':'warning-line'}>{o.complete?'✓':'○'}</span><span><strong>{o.title}</strong><small>{o.measured}/{o.required} verified · {o.weight} rubric points{o.critical?' · critical':''}</small></span>
   </div>)}</div>
   <div className="scenario-footer"><strong>{w.assessment.passed?'✓ Practically passed':e.criticalMet?'All critical objectives met':'Technical completion pending'}</strong>
    <button disabled={w.blocked} onClick={w.runAssessment}>Record assessment</button><small>Equipment placement alone never passes. Assisted examples cannot be accepted.</small></div>
   {recent.length>0&&<div className="scenario-history"><strong>Recent results</strong>{recent.map(r=><p key={r.id}>{new Date(r.at).toLocaleString()} · {r.assessment.score}/100 · {r.assessment.passed?'PASS':'IN PROGRESS'}</p>)}</div>}
  </div></div>
 </section>;
}
