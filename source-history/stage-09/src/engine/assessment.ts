import type {Assessment,Project,Rubric,SimResult} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {SCENARIOS} from '../scenarios/index.js';
import {simulate} from './simulator.js';
import {signalOf} from './cctv.js';
const round=(n:number)=>Math.round(n);
const points=(ratio:number,max:number)=>Math.min(max,Math.max(0,round(ratio*max)));
export function assess(project:Project,result:SimResult=simulate(project)):Assessment {
 const scenario=SCENARIOS.find(x=>x.id===project.scenarioId);
 if(!scenario)throw new Error('Scenario cannot be assessed because its definition is unknown');
 const cameras=project.devices.filter(d=>profile(d.profileId).kind==='camera');
 const nvr=project.devices.some(d=>profile(d.profileId).kind==='nvr');
 const dvr=project.devices.some(d=>profile(d.profileId).kind==='dvr');
 const sw=project.devices.some(d=>profile(d.profileId).kind==='switch');
 const requiresIP=scenario.id==='home4'||scenario.id==='diagnose4';
 const eligible=cameras.filter(d=>!requiresIP||signalOf(d)==='ip');
 const topologyComplete=requiresIP?(nvr&&sw):(nvr||dvr);
 const count=Math.min(1,eligible.length/scenario.minCameras);
 const online=result.onlineCameras/Math.max(scenario.minCameras,cameras.length,1);
 const record=result.recordingCameras/Math.max(scenario.minCameras,cameras.length,1);
 const seen=result.coverage.filter(x=>x.covered).length/Math.max(1,result.coverage.length);
 const recorded=project.events.filter(e=>e.recorded).length;
 const faults=Object.values(result.devices).reduce((n,s)=>n+s.faults.length,0)+Object.values(result.cables).filter(c=>!c.up).length;
 const unpriced=project.devices.filter(d=>profile(d.profileId).manufacturerSpec&&!(Number.isFinite(d.unitCostGhs)&&d.unitCostGhs!>0));
 const used=project.devices.reduce((n,d)=>n+(profile(d.profileId).manufacturerSpec?(d.unitCostGhs??0):profile(d.profileId).costGhs),0);
 const rubric:Rubric[]=[
  {id:'equipment',title:'Equipment selection',earned:points(count*(topologyComplete?1:0.5),10),max:10,details:`${eligible.length}/${scenario.minCameras} eligible cameras; NVR: ${nvr?'yes':'no'}; DVR: ${dvr?'yes':'no'}; switch: ${sw?'yes':'no'}`},
  {id:'power',title:'Operational power',earned:points(project.devices.filter(d=>profile(d.profileId).kind==='camera'&&result.devices[d.id].powered).length/Math.max(1,scenario.minCameras,cameras.length),15),max:15,details:'IP cameras need available PoE; analog cameras need a powered DC adapter'},
  {id:'network',title:'Network communication',earned:points(online,15),max:15,details:`${result.onlineCameras} cameras have an active IP/NVR or coax/DVR video route`},
  {id:'coverage',title:'Critical-area coverage',earned:points(seen,25),max:25,details:`${result.coverage.filter(t=>t.covered).length}/${scenario.targets.length} required locations visible to online cameras`},
  {id:'recording',title:'Working recording',earned:points(record,15),max:15,details:`${result.recordingCameras} cameras have recorder channels, storage and bandwidth available`},
  {id:'evidence',title:'Practical event verification',earned:recorded>0?10:0,max:10,details:`${recorded} recording event(s) actually produced by a movement test`},
  {id:'faults',title:'Fault-free installation',earned:faults===0&&cameras.length>=scenario.minCameras?5:0,max:5,details:`${faults} detected technical fault(s); placement alone never earns fault-resolution points`},
  {id:'budget',title:'Budget constraint',earned:!unpriced.length&&used<=scenario.budgetGhs?5:0,max:5,details:unpriced.length?`${unpriced.length} manufacturer model(s) need a genuine local GHS quotation before budget can be assessed`:`GHS ${used.toLocaleString()} used of GHS ${scenario.budgetGhs.toLocaleString()}`}
 ];
 let score=rubric.reduce((sum,r)=>sum+r.earned,0);
 if(project.assisted)score=Math.min(score,75); // a preassembled demonstration cannot be passed off as an unaided competency assessment
 const recommendations:string[]=[];
 if(eligible.length<scenario.minCameras)recommendations.push(`Install at least ${scenario.minCameras} ${requiresIP?'IP':'compatible'} cameras for this scenario.`);
 if(online<1)recommendations.push('Fix camera power, Ethernet/PoE or coax wiring, IP configuration and recorder connectivity.');
 if(seen<1)recommendations.push('Rotate, reposition, or add cameras so every critical objective is covered; account for walls.');
 if(record<1)recommendations.push('Verify NVR/DVR channel count, recorder bandwidth, enabled recording, schedules and disk health.');
 if(!recorded)recommendations.push('Run at least one movement test and confirm that the NVR stores evidence.');
 if(unpriced.length)recommendations.push('Enter verified equipment quotes for branded models: manufacturer specifications do not provide reliable Ghana retail prices.');
 if(used>scenario.budgetGhs)recommendations.push('Reduce equipment cost or use a more affordable system design.');
 if(project.assisted)recommendations.push('This was an assisted demonstration; start the scenario independently for an eligible pass.');
 return {score,passed:score>=80&&eligible.length>=scenario.minCameras&&topologyComplete&&seen===1&&recorded>0&&online>=1&&record>=1&&faults===0&&unpriced.length===0&&used<=scenario.budgetGhs&&!project.assisted,rubric,recommendations};
}
