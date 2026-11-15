import React,{useState} from 'react';
import type {FieldIssue,FieldRole,FieldTrialTask,FieldOutcome} from '../../../src/domain/types.js';
import {FIELD_TASKS} from '../../../src/field/field-validation.js';
import type {Workbench} from '../hooks/useWorkbench.js';

const tasks=FIELD_TASKS;
/** Local field-trial evidence collector; entries are user-supplied observations only. */
export function FieldReviewConsole({w}:{w:Workbench}){
 const [role,setRole]=useState<FieldRole>('learner');
 const [platform,setPlatform]=useState('Windows 11');
 const [browser,setBrowser]=useState('Chrome');
 const [deviceClass,setDeviceClass]=useState<'low-spec'|'standard'|'other'>('low-spec');
 const [ramGb,setRamGb]=useState(8);
 const [offline,setOffline]=useState(false);
 const [scenarioId,setScenarioId]=useState(w.project.scenarioId);
 const [task,setTask]=useState<FieldTrialTask>('property-editor');
 const [outcome,setOutcome]=useState<FieldOutcome>('partial');
 const [duration,setDuration]=useState(15);
 const [notes,setNotes]=useState('');
 const [severity,setSeverity]=useState<FieldIssue['severity']>('major');
 const [issueTask,setIssueTask]=useState<FieldTrialTask>('property-editor');
 const [summary,setSummary]=useState('');
 const [steps,setSteps]=useState('');
 const [expected,setExpected]=useState('');
 const [observed,setObserved]=useState('');
 const review=w.project.fieldReview;
 const readiness=w.fieldReadiness;
 const addSession=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();
  if(!platform.trim()||!browser.trim()){w.setNotice('Enter platform and browser for the observation');return;}
  const saved=w.recordFieldTrial({role,platform:platform.trim().slice(0,100),browser:browser.trim().slice(0,100),deviceClass,ramGb,offline,scenarioId,task,outcome,durationMinutes:duration,notes:notes.trim().slice(0,1200)});
  if(saved)setNotes('');
 };
 const addFinding=(e:React.FormEvent<HTMLFormElement>)=>{e.preventDefault();
  if(!summary.trim()||!steps.trim()||!observed.trim()||!expected.trim()){w.setNotice('Describe the issue, reproduction, expected and observed outcomes');return;}
  const saved=w.recordFieldIssue({severity,area:issueTask,summary:summary.trim().slice(0,450),steps:steps.trim().slice(0,1200),expected:expected.trim().slice(0,1200),observed:observed.trim().slice(0,1200)});
  if(saved){setSummary('');setSteps('');setExpected('');setObserved('');}
 };
 return <section className="field-review-panel" aria-label="Field trial and release candidate review">
  <header><div><small>STAGE 14 · FIELD-REVIEW WORKBOOK</small><h3>Field validation evidence</h3><p>Collect real-world observations from learners and technicians. No user accounts, automatic claims of testing or external uploads.</p></div><strong>{readiness.status}</strong></header>
  <p className="field-disclaimer"><b>Not a release approval.</b> All entries below are entered by the reviewer. Passing the simulation is not equivalent to real-browser, accessibility, performance or security acceptance. Production remains unverified until independently checked and authorized.</p>
  <div className="field-stats"><div><strong>{(review?.trials||[]).length}</strong><span>Manual sessions</span></div><div><strong>{readiness.reviewedTasks}/{readiness.totalTasks}</strong><span>Workflows observed</span></div><div><strong>{readiness.scenarioCount}/10</strong><span>Scenarios observed</span></div><div><strong>{readiness.unresolvedCritical+readiness.unresolvedMajor}</strong><span>Critical/major open</span></div></div>
  <div className="field-grid"><section><h4>Record a field session</h4><form onSubmit={addSession} className="field-form">
   <div className="field-form-row"><label>Reviewer role<select value={role} onChange={e=>setRole(e.target.value as FieldRole)}><option value="learner">Learner</option><option value="technician">Technician</option><option value="instructor">Instructor</option></select></label><label>Device class<select value={deviceClass} onChange={e=>setDeviceClass(e.target.value as typeof deviceClass)}><option value="low-spec">Affordable / low spec</option><option value="standard">Standard PC</option><option value="other">Other</option></select></label></div>
   <div className="field-form-row"><label>Operating system<input maxLength={100} required value={platform} onChange={e=>setPlatform(e.target.value)}/></label><label>Browser<input maxLength={100} required value={browser} onChange={e=>setBrowser(e.target.value)}/></label><label>RAM (GB)<input type="number" min="0" max="512" step="0.5" value={ramGb} onChange={e=>setRamGb(Number(e.target.value))}/></label></div>
   <div className="field-form-row"><label>Scenario<select value={w.SCENARIOS.some(s=>s.id===scenarioId)?scenarioId:w.project.scenarioId} onChange={e=>setScenarioId(e.target.value)}>{w.SCENARIOS.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label><label>Observed task<select value={task} onChange={e=>setTask(e.target.value as FieldTrialTask)}>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
   <p className="muted">Procedure: {tasks.find(t=>t.id===task)?.guidance}</p>
   <div className="field-form-row"><label>Observed outcome<select value={outcome} onChange={e=>setOutcome(e.target.value as FieldOutcome)}><option value="completed">Completed</option><option value="partial">Partially completed</option><option value="blocked">Blocked</option></select></label><label>Minutes<input type="number" min="0" max="1440" value={duration} onChange={e=>setDuration(Number(e.target.value))}/></label><label className="field-check"><input type="checkbox" checked={offline} onChange={e=>setOffline(e.target.checked)}/> Tested without internet</label></div>
   <label>Observation (no names, passwords or personal data)<textarea rows={2} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What the tester actually observed"/></label><button className="primary" disabled={w.blocked||review?.trials.length===120} type="submit">Record observation</button>
  </form></section>
  <section><h4>File an issue / follow-up</h4><form className="field-form" onSubmit={addFinding}>
   <div className="field-form-row"><label>Severity<select value={severity} onChange={e=>setSeverity(e.target.value as FieldIssue['severity'])}><option value="critical">Critical</option><option value="major">Major</option><option value="minor">Minor</option></select></label><label>Area<select value={issueTask} onChange={e=>setIssueTask(e.target.value as FieldTrialTask)}>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label></div>
   <label>Issue summary<input required maxLength={450} value={summary} onChange={e=>setSummary(e.target.value)}/></label>
   <label>Steps to reproduce<textarea required maxLength={1200} rows={2} value={steps} onChange={e=>setSteps(e.target.value)}/></label>
   <label>Expected behaviour<textarea required maxLength={1200} rows={2} value={expected} onChange={e=>setExpected(e.target.value)}/></label>
   <label>Observed behaviour<textarea required maxLength={1200} rows={2} value={observed} onChange={e=>setObserved(e.target.value)}/></label>
   <button className="primary" type="submit" disabled={w.blocked||review?.issues.length===120}>Add finding</button>
  </form></section></div>
  <section className="field-gates"><h4>Preparation evidence — not acceptance gates</h4><div>{readiness.gates.map((g,i)=><div key={i}><span className={g.met?'good':'warning-line'}>{g.met?'✓':'○'}</span><span><strong>{g.title}</strong><small>{g.details}</small></span></div>)}</div></section>
  <section className="field-gates"><h4>Independent release gates — still unverified</h4><p className="warning-line">This source delivery has not been built or run as a React application. The following require evidence outside the field-review form.</p>
   <div>{['Authentic dependency installation and production build','Local file save/reopen and external-edit conflict checks','Secure-origin offline PWA and cross-browser acceptance','Usability, accessibility and real 8 GB computer performance','Independent security and simulation-engine review','Explicit owner authorization for production deployment'].map(x=><div key={x}><span className="warning-line">○</span><span><strong>{x}</strong><small>Not verified in Stage 14 source delivery</small></span></div>)}</div>
  </section>
  <section className="field-records"><h4>Recent observations</h4>{(review?.trials||[]).length?(review?.trials||[]).slice(-12).reverse().map(t=><article key={t.id}><strong>{t.task.replace(/-/g,' ')} · {t.outcome.toUpperCase()}</strong><small>{new Date(t.at).toLocaleString()} · {t.role} · {t.browser}/{t.platform} · {t.ramGb}GB · {t.offline?'offline':'online'} · {t.scenarioId}</small><p>{t.notes||'No notes supplied'}</p></article>):<p className="muted">No field observations recorded. Do not mark a task completed without observing it.</p>}</section>
  <section className="field-records"><h4>Issue register</h4>{(review?.issues||[]).length?(review?.issues||[]).slice().reverse().map(i=><article key={i.id}><strong>{i.severity.toUpperCase()} · {i.summary}</strong><label>Status<select disabled={w.blocked} value={i.status} onChange={e=>w.changeFieldIssueStatus(i.id,e.target.value as FieldIssue['status'])}><option value="open">Open</option><option value="resolved">Resolved</option><option value="deferred">Deferred</option></select></label><p><b>Reproduce:</b> {i.steps}</p><p><b>Expected:</b> {i.expected}</p><p><b>Observed:</b> {i.observed}</p></article>):<p className="muted">No issues recorded. This does not prove that no issues exist.</p>}</section>
  <div className="field-actions"><button type="button" onClick={()=>w.downloadFieldReview('json')}>Export anonymous field review JSON</button><button type="button" onClick={()=>w.downloadFieldReview('html')}>Export printable field review</button><span>Exported reports are editable, anonymous, and never automatically verified.</span></div>
 </section>;
}
