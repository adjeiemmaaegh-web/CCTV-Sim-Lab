import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';

export type WorkflowStep='place'|'connect'|'configure'|'test'|'save';
const STEPS:{id:WorkflowStep;label:string;tip:string}[]=[
 {id:'place',label:'Place',tip:'Choose equipment and click the floor plan'},
 {id:'connect',label:'Connect',tip:'Choose a cable, then two virtual devices'},
 {id:'configure',label:'Configure',tip:'Select equipment to edit its settings'},
 {id:'test',label:'Test',tip:'Inspect diagnostics and inject a training fault'},
 {id:'save',label:'Save',tip:'Save and read back a local project file'}
];

/**
 * Task discovery, not a safety checklist. A checked step means a user action is
 * visible in this project; it does NOT certify a complete installation.
 */
export function WorkflowStrip({w,onChoose}:{w:Workbench;onChoose:(step:WorkflowStep)=>void}){
 const hasLink=w.project.cables.some(c=>c.connected);
 const ready=w.project.devices.some(d=>Boolean(w.result.devices[d.id]?.networkOk)&&w.project.cables.some(c=>c.a===d.id||c.b===d.id));
 const hasTest=(w.project.events||[]).some(e=>e.kind==='fault'||e.kind==='motion'||e.kind==='warning'||e.kind==='recorded'||/diagnostic probe/i.test(e.message))||(w.project.assessments||[]).length>0;
 const done:Record<WorkflowStep,boolean>={place:w.project.devices.length>0,connect:hasLink,configure:ready,test:hasTest,save:w.saveState==='saved'&&!w.hasUnsavedWork()};
 const complete=STEPS.filter(s=>done[s.id]).length;
 const next=STEPS.find(s=>!done[s.id])?.id;
 return <nav className="workflow-strip" aria-label="Installation workflow">
  <span className="workflow-caption">INSTALLATION <strong>{complete}/5</strong></span>
  <div className="workflow-actions">
   {STEPS.map((s,i)=><button key={s.id} type="button" disabled={w.blocked&&s.id!=='save'} onClick={()=>onChoose(s.id)} className={'workflow-step '+(done[s.id]?'complete':next===s.id?'next':'')} aria-label={s.label+' installation step'} title={s.tip} aria-current={next===s.id?'step':undefined}>
    <span className="workflow-mark" aria-hidden="true">{done[s.id]?'✓':i+1}</span>
    <span>{s.label}</span>
   </button>)}
  </div>
  <span className="workflow-disclaimer" title="Completion reflects modeled project actions, not real equipment installation acceptance">Actions, not certification</span>
 </nav>;
}
