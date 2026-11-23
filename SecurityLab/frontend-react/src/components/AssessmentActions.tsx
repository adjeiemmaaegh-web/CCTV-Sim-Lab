import React from 'react';
import type {AssessmentFinding} from '../../../src/domain/types.js';
import {guidedDiagnostics} from '../../../src/tools/diagnostics-guide.js';
import type {Workbench,Selectable} from '../hooks/useWorkbench.js';
import {profile} from '../../../src/domain/catalog.js';
export function AssessmentActions({w,finding,historical}:{w:Workbench;finding:AssessmentFinding;historical:boolean}){
 const area=finding.category;
 const diagnosis=guidedDiagnostics(w.project,w.result).filter(f=>f.entity&&(area==='network'?f.area==='ip'||f.area==='cable':area==='troubleshooting'||area==='reliability'?true:f.area===area));
 const components:NonNullable<Selectable>[]=[];
 const challenge=w.project.scenarioState?.challenges?.find(c=>finding.id==='challenge:'+c.id);
 if(challenge?.cableId&&w.project.cables.some(c=>c.id===challenge.cableId))components.push({kind:'cable',id:challenge.cableId});
 if(challenge?.deviceId&&w.project.devices.some(c=>c.id===challenge.deviceId))components.push({kind:'device',id:challenge.deviceId});
 for(const f of diagnosis)if(f.entity&&!components.some(c=>c.id===f.entity!.id))components.push(f.entity);
 if(area==='coverage')for(const t of w.result.coverage.filter(t=>!t.covered))components.push({kind:'target',id:t.id});
 if(!components.length)for(const d of w.project.devices.filter(d=>{const k=profile(d.profileId).kind;return area==='equipment'||area==='network'?true:area==='recording'?k==='nvr'||k==='dvr'||k==='camera':area==='coverage'?k==='camera':k.startsWith(area+'-');}))components.push({kind:'device',id:d.id});
 const name=(e:NonNullable<Selectable>)=>e.kind==='device'?w.project.devices.find(d=>d.id===e.id)?.name:e.kind==='target'?w.project.targets.find(d=>d.id===e.id)?.name:'Connection '+e.id.slice(0,8);
 return <div className="assessment-actions">{historical&&<small>Links inspect current components; the recorded score is unchanged.</small>}{components.slice(0,8).map(e=><button key={e.kind+e.id} onClick={()=>w.locate(e)}>Inspect {name(e)}</button>)}<button onClick={()=>{w.setTab(area==='coverage'||area==='equipment'?'scenario':'diagnostics');w.setNotice('Corrective task: '+finding.recommendation);}}>Open corrective task</button></div>;
}
