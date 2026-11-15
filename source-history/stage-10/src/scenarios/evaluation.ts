import type {Device,Project,Scenario,ScenarioObjective,SimResult} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {signalOf} from '../engine/cctv.js';
import {scenarioFor} from './definitions.js';

export type ObjectiveEvidence={id:string;title:string;metric:ScenarioObjective['metric'];weight:number;critical:boolean;measured:number;required:number;progress:number;complete:boolean;explanation:string};
export type ChallengeEvidence={id:string;label:string;resolved:boolean;hint:string};
export type ScenarioEvaluation={scenarioId:string;definitionVersion:number;focus:Scenario['focus'];completed:number;total:number;criticalMet:boolean;allComplete:boolean;objectives:ObjectiveEvidence[];challenges:ChallengeEvidence[];score:number;budgetUsedGhs:number;unquotedModels:number;unpermittedDevices:number};

const all=(p:Project,kind:ReturnType<typeof profile>['kind'])=>p.devices.filter(d=>profile(d.profileId).kind===kind);
const noQuote=(p:Project)=>p.devices.filter(d=>!!profile(d.profileId).manufacturerSpec&&!(Number.isFinite(d.unitCostGhs)&&d.unitCostGhs!>0)).length;
const usedBudget=(p:Project)=>p.devices.reduce((n,d)=>n+(profile(d.profileId).manufacturerSpec?(d.unitCostGhs??0):profile(d.profileId).costGhs),0);
function cctvCameras(p:Project){
 const ipOnly=p.scenarioId!=='shop3';
 return all(p,'camera').filter(d=>!ipOnly||signalOf(d)==='ip');
}
function repairedChallenges(p:Project,result:SimResult):ChallengeEvidence[]{
 return (p.scenarioState?.challenges||[]).map(c=>{
  const wire=c.cableId?p.cables.find(w=>w.id===c.cableId):undefined;
  const device=c.deviceId?p.devices.find(d=>d.id===c.deviceId):undefined;
  let resolved=false;
  if(c.kind==='cable-repair')resolved=!!wire?.connected&&!!result.cables[wire.id]?.up;
  if(c.kind==='alarm-wire-repair')resolved=!!wire?.connected&&!!result.alarm?.wires[wire.id]?.up;
  if(c.kind==='ip-conflict'&&device){
   const status=result.network?.addresses[device.id];
   const peers=Object.entries(result.network?.addresses||{}).filter(([id,a])=>id!==device.id&&a.ip===status?.ip&&a.vlanId===status?.vlanId&&a.source!=='unassigned');
   resolved=!!status&&status.source!=='unassigned'&&status.faults.length===0&&peers.length===0&&!!result.devices[device.id]?.networkOk;
  }
  return {id:c.id,label:c.label,resolved,hint:c.hint};
 });
}
const measured=(p:Project,r:SimResult,s:Scenario,m:ScenarioObjective['metric'],challenges:ChallengeEvidence[]):number=>{
 const cams=cctvCameras(p),alarm=Object.values(r.alarm?.panels||{}),access=Object.values(r.access?.controllers||{});
 switch(m){
  case 'camera-count':return cams.length;
  case 'camera-powered':return cams.filter(c=>r.devices[c.id]?.powered).length;
  case 'camera-online':return cams.filter(c=>r.devices[c.id]?.powered&&r.devices[c.id]?.networkOk).length;
  case 'camera-recording':return cams.filter(c=>r.devices[c.id]?.recordingReady).length;
  case 'target-coverage':return s.targets.length&&s.targets.every(t=>r.coverage.find(x=>x.id===t.id)?.covered)?1:0;
  case 'night-coverage':return p.night&&s.targets.length&&s.targets.every(t=>r.coverage.find(x=>x.id===t.id)?.covered)?1:0;
  case 'recorded-event':return (p.clips||[]).filter(c=>cams.some(d=>d.id===c.cameraId)&&p.devices.some(d=>d.id===c.recorderId)).length;
  case 'technical-health':{
   const expectedCameras=cams.length>=s.minCameras;
   const badCamera=cams.some(d=>r.devices[d.id]?.faults.length);
   const badWires=p.cables.some(c=>r.cables[c.id]&&(!r.cables[c.id].up));
   const recordFault=Object.values(r.recorders).some(x=>x.faults.length>0);
   return expectedCameras&&!badCamera&&!badWires&&!recordFault?1:0;
  }
  case 'within-budget':return noQuote(p)===0&&usedBudget(p)<=s.budgetGhs?1:0;
  case 'resolved-challenges':return challenges.length>0&&challenges.every(c=>c.resolved)?1:0;
  case 'alarm-panel':return alarm.some(a=>a.powered&&a.faults.every(f=>!f.includes('tamper')))?1:0;
  case 'alarm-sensors':return all(p,'alarm-sensor').filter(d=>r.alarm?.devices[d.id]?.powered&&r.alarm?.devices[d.id]?.wired&&r.alarm?.devices[d.id]?.faults.length===0).length;
  case 'alarm-keypad':return all(p,'alarm-keypad').some(d=>r.alarm?.devices[d.id]?.powered&&r.alarm?.devices[d.id]?.wired)?1:0;
  case 'alarm-armed':return alarm.some(a=>a.powered&&a.mode!=='disarmed'&&a.phase!=='exit')?1:0;
  case 'alarm-triggered':return alarm.some(a=>a.powered&&a.phase==='triggered'&&a.zones.some(z=>z.triggered))?1:0;
  case 'alarm-output':return (r.alarm?.activeSirenCount||0)>0?1:0;
  case 'alarm-beam':return all(p,'alarm-sensor').some(d=>profile(d.profileId).alarmSensorType==='beam'&&r.alarm?.devices[d.id]?.powered&&r.alarm?.devices[d.id]?.faults.length===0)?1:0;
  case 'router-ready':return all(p,'router').some(d=>r.devices[d.id]?.powered&&d.routingEnabled!==false)?1:0;
  case 'dhcp-lease':return Object.keys(r.network?.dhcpLeases||{}).length;
  case 'intervlan-route':return Object.values(r.network?.traces||{}).filter(t=>t.ok&&!!t.viaRouter).length;
  case 'access-controller':return access.some(c=>c.powered&&c.faults.every(f=>!f.includes('output supply')))?1:0;
  case 'access-readers':return all(p,'access-reader').filter(d=>r.access?.devices[d.id]?.powered).length;
  case 'access-lock':return all(p,'access-lock').some(d=>r.access?.devices[d.id]?.powered)?1:0;
  case 'access-door':return access.some(c=>c.powered&&!!c.door&&c.lockIds.length===1&&c.connectedReaderIds.length>0)?1:0;
  case 'access-granted':return (p.accessLog||[]).filter(e=>e.decision==='granted'&&['card','pin','biometric'].includes(e.action)&&p.devices.some(d=>d.id===e.controllerId)).length;
  case 'access-denied':return (p.accessLog||[]).filter(e=>e.decision==='denied'&&['card','pin','biometric'].includes(e.action)&&p.devices.some(d=>d.id===e.controllerId)).length;
  case 'access-exit':return (p.accessLog||[]).filter(e=>e.action==='exit'&&e.decision==='granted').length;
  case 'power-wired':return p.powerSettings?.mode==='wired'?1:0;
  case 'solar-generation':return (r.power?.solarGenerationW||0)>0?1:0;
  case 'battery-ready':return all(p,'power-battery').some(d=>!!r.power?.devices[d.id]?.powered&&!!d.powerConfig&&d.powerConfig.chargeWh>0)?1:0;
  case 'backup-outage':return !p.mainsOn&&p.powerSettings?.mode==='wired'&&(r.power?.batteryDrawW||0)>0&&
   (r.power?.estimatedBackupMinutes||0)>0&&cams.some(d=>r.devices[d.id]?.recordingReady)?1:0;
 }
};
/** Evaluate a scenario from current installed equipment and engine evidence, never UI animation state. */
export function evaluateScenario(p:Project,r:SimResult):ScenarioEvaluation{
 const s=scenarioFor(p.scenarioId);if(!s)throw new Error('Unknown scenario definition');
 const challenges=repairedChallenges(p,r),weights=s.objectives.reduce((n,x)=>n+x.weight,0);
 const objectives:ObjectiveEvidence[]=s.objectives.map(o=>{
  const value=measured(p,r,s,o.metric,challenges);
  const progress=Math.max(0,Math.min(1,value/Math.max(1,o.minimum)));
  return {id:o.id,title:o.title,metric:o.metric,weight:o.weight,critical:o.critical,measured:value,required:o.minimum,progress,complete:progress===1,
   explanation:`${Math.min(value,o.minimum)} of ${o.minimum}${o.metric==='target-coverage'?' critical-area requirements':''}`};
 });
 const unpermitted=p.devices.filter(d=>!s.allowedKinds.includes(profile(d.profileId).kind)).length;
 const criticalMet=objectives.every(x=>!x.critical||x.complete)&&unpermitted===0,completed=objectives.filter(x=>x.complete).length;
 const score=weights?Math.round(objectives.reduce((sum,o)=>sum+o.weight*o.progress,0)*100/weights):0;
 return {scenarioId:s.id,definitionVersion:s.version,focus:s.focus,completed,total:objectives.length,criticalMet,allComplete:completed===objectives.length&&unpermitted===0,
  objectives,challenges,score,budgetUsedGhs:usedBudget(p),unquotedModels:noQuote(p),unpermittedDevices:unpermitted};
}
/** Device restriction for a structured practical exercise. Existing legacy device instances are not silently removed. */
export function allowedInScenario(p:Project,kind:ReturnType<typeof profile>['kind']):boolean{
 const s=scenarioFor(p.scenarioId);return !!s&&s.allowedKinds.includes(kind);
}
export function scenarioNarrative(p:Project,r:SimResult):string[]{
 const evidence=evaluateScenario(p,r),s=scenarioFor(p.scenarioId)!;
 return [s.description,...s.instructions,...evidence.objectives.filter(x=>!x.complete).map(x=>`Incomplete: ${x.title}. ${x.explanation}`)];
}
