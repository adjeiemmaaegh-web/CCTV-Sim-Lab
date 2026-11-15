import type {Assessment,Project,Rubric,SimResult} from '../domain/types.js';
import {simulate} from './simulator.js';
import {evaluateScenario} from '../scenarios/evaluation.js';

/** Stage 10: scenario-specific operational evidence. Stage 11 adds formal competency review and reporting. */
export function assess(project:Project,result:SimResult=simulate(project)):Assessment{
 const evidence=evaluateScenario(project,result);
 const rubric:Rubric[]=evidence.objectives.map(o=>({
  id:o.id,title:o.title,max:o.weight,earned:Math.round(o.progress*o.weight),
  details:`${o.explanation}${o.critical?' · required for completion':''}`
 }));
 const raw=Math.max(0,Math.min(100,evidence.score)),score=project.assisted?Math.min(raw,75):raw;
 const passed=score>=80&&evidence.criticalMet&&evidence.allComplete&&!project.assisted;
 const recommendations=evidence.objectives.filter(x=>!x.complete).map(x=>`Complete ${x.title.toLowerCase()} (${x.measured}/${x.required}) and verify the resulting simulation state.`);
 if(evidence.unpermittedDevices)recommendations.push(`Remove ${evidence.unpermittedDevices} device(s) outside this scenario's permitted equipment list.`);
 if(evidence.unquotedModels)recommendations.push(`Add genuine GHS quotations for ${evidence.unquotedModels} branded model(s).`);
 if(evidence.challenges.some(x=>!x.resolved))recommendations.push('Repair the original seeded faults; replacing or deleting evidence hardware does not complete the troubleshooting challenge.');
 if(project.assisted)recommendations.push('Assisted demonstrations are capped at 75 points and cannot establish independent competency.');
 return {score,passed,rubric,recommendations};
}
