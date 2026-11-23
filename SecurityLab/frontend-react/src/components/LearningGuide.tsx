import React,{useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {WorkflowStep} from './WorkflowStrip.js';
import {guidedDiagnostics} from '../../../src/tools/diagnostics-guide.js';
export function LearningGuide({w,onChoose}:{w:Workbench;onChoose:(step:WorkflowStep)=>void}){
 const [collapsed,setCollapsed]=useState(true);
 const fault=guidedDiagnostics(w.project,w.result).find(f=>f.entity);
 const missingEquipment=w.scenarioProgress.objectives.find(o=>!o.complete&&['camera-count','alarm-panel','alarm-sensors','alarm-keypad','alarm-output','alarm-beam','access-controller','access-readers','access-lock','fire-detectors','fire-callpoint','fire-sounder'].includes(o.metric));
 const incomplete=w.scenarioProgress.objectives.find(o=>!o.complete);
 const step:WorkflowStep=missingEquipment?'place':!w.project.devices.length?'place':!w.project.cables.length?'connect':fault?'configure':!w.project.events.length?'test':'save';
 const message=step==='place'?(missingEquipment?`${missingEquipment.title}: ${missingEquipment.measured}/${missingEquipment.required}. ${missingEquipment.explanation}`:'Choose equipment for the scenario, then place it on the plan.'):step==='connect'?'Place at least two compatible endpoints, then review a cable connection.':step==='configure'?`${fault!.title}: ${fault!.nextStep}`:step==='test'?'Test motion or run diagnostics to collect simulated evidence.':incomplete?`Remaining objective: ${incomplete.title}. ${incomplete.explanation} Save a checkpoint before continuing.`:'Review your evidence and save a verified project file.';
 const reveal=()=>{
  onChoose(step);
  if(step==='configure'&&fault?.entity)w.locate(fault.entity);
  requestAnimationFrame(()=>{const selector=step==='place'?'.catalog':step==='save'?'.modal':step==='test'?'.console':'.inspector';const el=document.querySelector<HTMLElement>(selector);el?.scrollIntoView({block:'nearest'});el?.classList.add('instructor-highlight');setTimeout(()=>el?.classList.remove('instructor-highlight'),3500);});
 };
 return <section className="learning-guide" aria-label="Contextual learning guide"><div><strong>Next action · {step}</strong><button aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?'Show guide':'Minimize guide'}</button></div><button disabled={w.blocked&&step!=='save'} onClick={reveal}>Show me where</button>{!collapsed&&<><p>{message}</p><small>Guidance selects controls; you perform each task. {w.project.assisted?'Worked example · guided practice':'Independent practice'}.</small></>}</section>;
}
