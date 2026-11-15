import type {Project,SimResult,DeviceKind} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import type {ScenarioEvaluation} from '../scenarios/evaluation.js';

/**
 * Stage 15: one cross-laboratory state-of-installation summary.
 * This is derived from the existing deterministic simulation results, not
 * a separate, optimistic UI state or a certification of real hardware.
 */
export type LabKey='cctv'|'network'|'alarm'|'access'|'power'|'scenario';
export type LabHealth={
 id:LabKey; title:string; status:'ready'|'attention'|'not-installed';
 installed:number; operational:number; description:string; details:string[];
};
export type InstallationHealth={labs:LabHealth[]; activeLabs:number; readyLabs:number; issues:number; criticalObjectives:number};
const trouble=(values:string[],limit=4)=>[...new Set(values.filter(Boolean))].slice(0,limit);
const kind=(id:string):DeviceKind=>profile(id).kind;
const desc=(installed:number,operational:number,word:string)=>`${operational}/${installed} ${word} operational in the current simulated state`;
function entry(id:LabKey,title:string,installed:number,operational:number,details:string[],description:string,complete:boolean):LabHealth{
 return {id,title,installed,operational,description,details:trouble(details),status:!installed?'not-installed':complete?'ready':'attention'};
}
export function installationHealth(p:Project,r:SimResult,scenario:ScenarioEvaluation):InstallationHealth{
 const cameras=p.devices.filter(d=>kind(d.profileId)==='camera');
 const recorders=p.devices.filter(d=>['nvr','dvr'].includes(kind(d.profileId)));
 const live=cameras.filter(d=>r.devices[d.id]?.powered&&r.devices[d.id]?.networkOk).length;
 const recording=cameras.filter(d=>r.devices[d.id]?.recordingReady).length;
 const cctvIssues=cameras.flatMap(d=>r.devices[d.id]?.faults.map(f=>`${d.name}: ${f}`)||[]);
 const cctv=entry('cctv','CCTV & recording',cameras.length,recording,
  [...cctvIssues,...(!recorders.length&&cameras.length?['No compatible recorder installed']:[])],
  `${live}/${cameras.length} online · ${recording} recording · ${recorders.length} recorder(s)`,
  cameras.length>0&&live===cameras.length&&recording===cameras.length);

 const ipDevices=p.devices.filter(d=>['switch','router','ap','server','nvr'].includes(kind(d.profileId))||kind(d.profileId)==='camera'&&profile(d.profileId).signal!=='analog');
 const connected=ipDevices.filter(d=>r.devices[d.id]?.powered&&(!['camera','nvr','router','ap','server'].includes(kind(d.profileId))||r.devices[d.id]?.networkOk)).length;
 const networkIssues=[...(r.network?.diagnostics||[]),...ipDevices.flatMap(d=>r.network?.addresses[d.id]?.faults.map(f=>`${d.name}: ${f}`)||[])];
 const network=entry('network','IP networking',ipDevices.length,connected,networkIssues,
  desc(ipDevices.length,connected,'network device(s)'),
  ipDevices.length>0&&connected===ipDevices.length&&networkIssues.length===0);

 const alarmDevices=p.devices.filter(d=>kind(d.profileId).startsWith('alarm-'));
 const workingAlarm=alarmDevices.filter(d=>r.alarm?.devices[d.id]?.powered&&r.alarm?.devices[d.id]?.faults.length===0||r.alarm?.panels[d.id]?.powered&&r.alarm?.panels[d.id]?.faults.length===0).length;
 const alarm=entry('alarm','Intrusion alarm',alarmDevices.length,workingAlarm,r.alarm?.issues||[],
  `${workingAlarm}/${alarmDevices.length} healthy devices · ${Object.values(r.alarm?.panels||{}).filter(x=>x.mode!=='disarmed').length} armed panel(s)`,
  alarmDevices.length>0&&workingAlarm===alarmDevices.length&&!(r.alarm?.issues.length));

 const accessDevices=p.devices.filter(d=>kind(d.profileId).startsWith('access-'));
 const workingAccess=accessDevices.filter(d=>r.access?.devices[d.id]?.powered&&r.access?.devices[d.id]?.faults.length===0||r.access?.controllers[d.id]?.powered&&r.access?.controllers[d.id]?.faults.length===0).length;
 const access=entry('access','Access control',accessDevices.length,workingAccess,r.access?.issues||[],
  `${workingAccess}/${accessDevices.length} healthy access devices · ${Object.values(r.access?.doors||{}).filter(d=>d.alarm).length} door alert(s)`,
  accessDevices.length>0&&workingAccess===accessDevices.length&&!(r.access?.issues.length));

 const powerDevices=p.devices.filter(d=>kind(d.profileId).startsWith('power-'));
 const healthyPower=powerDevices.filter(d=>r.power?.devices[d.id]?.powered&&r.power?.devices[d.id]?.faults.length===0).length;
 const wired=p.powerSettings?.mode==='wired';
 const power=entry('power','Electrical & backup',powerDevices.length+(wired&&!powerDevices.length?1:0),healthyPower,r.power?.issues||[],
  wired?`${(r.power?.totalLoadW||0).toFixed(1)} W load · ${(r.power?.estimatedBackupMinutes||0).toFixed(0)} min estimated backup`:'Legacy supply mode; no physical circuit designed',
  !!wired&&powerDevices.length>0&&healthyPower===powerDevices.length&&!(r.power?.issues.length));

 const scenarioIssues=[...scenario.objectives.filter(o=>!o.complete).map(o=>`${o.title}: ${o.explanation}`),
  ...scenario.challenges.filter(c=>!c.resolved).map(c=>`Unresolved: ${c.label}`),
  ...(scenario.unpermittedDevices?[`${scenario.unpermittedDevices} device(s) outside scenario inventory`]:[])];
 const practice=entry('scenario','Practical assignment',scenario.total,scenario.completed,scenarioIssues,
  `${scenario.completed}/${scenario.total} objectives · ${scenario.score}% provisional progress`,
  scenario.allComplete&&scenario.criticalMet&&scenario.challenges.every(c=>c.resolved));

 const labs=[cctv,network,alarm,access,power,practice];
 return {labs,activeLabs:labs.filter(x=>x.status!=='not-installed').length,
  readyLabs:labs.filter(x=>x.status==='ready').length,
  issues:labs.reduce((n,x)=>n+x.details.length,0),
  criticalObjectives:scenario.objectives.filter(o=>o.critical&&!o.complete).length};
}
