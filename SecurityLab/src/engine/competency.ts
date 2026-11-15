import type {Assessment,AssessmentFinding,AssessmentGate,CompetencyArea,CompetencyCategory,Project,ScenarioMetric,SimResult} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {evaluateScenario} from '../scenarios/evaluation.js';
import {scenarioFor} from '../scenarios/definitions.js';

/** Stage 11 competency reporting. Read-only derivation from authoritative project + simulation.
 * It does not control real equipment and cannot certify a person's field competence. */
const CATEGORY:Record<ScenarioMetric,CompetencyCategory>={
 'camera-count':'equipment','camera-powered':'power','camera-online':'network','camera-recording':'recording',
 'target-coverage':'coverage','night-coverage':'coverage','recorded-event':'recording',
 'technical-health':'reliability','within-budget':'equipment','resolved-challenges':'troubleshooting',
 'alarm-panel':'alarm','alarm-sensors':'alarm','alarm-keypad':'alarm','alarm-armed':'alarm',
 'alarm-triggered':'alarm','alarm-output':'alarm','alarm-beam':'alarm',
 'router-ready':'network','dhcp-lease':'network','intervlan-route':'network',
 'access-controller':'access','access-readers':'access','access-lock':'access','access-door':'access',
 'access-granted':'access','access-denied':'access','access-exit':'access',
 'power-wired':'power','solar-generation':'power','battery-ready':'power','backup-outage':'power',
 'fire-detectors':'alarm','fire-callpoint':'alarm','fire-sounder':'alarm','fire-24h':'alarm','fire-alarm':'alarm'
};
const TITLE:Record<CompetencyCategory,string>={equipment:'Equipment and budget',coverage:'Camera coverage',network:'IP networking',recording:'Recording and evidence',alarm:'Intrusion alarms',access:'Access control',power:'Electrical and backup power',reliability:'Installation reliability',troubleshooting:'Troubleshooting'};
const ACTION:Record<ScenarioMetric,string>={
 'camera-count':'Install the required compatible camera quantity, then verify their configuration.',
 'camera-powered':'Check supply voltage, PoE ports, power budgets and cable connections.',
 'camera-online':'Check physical cabling, link power, addressing, VLAN and routing, then run a route probe.',
 'camera-recording':'Verify compatible NVR/DVR channels, active video transport, schedules, disk health and recorder bandwidth.',
 'target-coverage':'Adjust camera placement and orientation until every required target is visible without wall occlusion.',
 'night-coverage':'Enable night conditions and verify coverage with effective IR or adequate simulated illumination.',
 'recorded-event':'Trigger an event and verify that an operational camera and compatible recorder produced its clip metadata.',
 'technical-health':'Inspect outstanding faults, restore failed links and ensure all required video devices are operational.',
 'within-budget':'Remove unnecessary equipment or revise the installation, and enter actual GHS quotations for branded devices.',
 'resolved-challenges':'Diagnose and repair each original seeded incident; deleting a faulty device does not resolve it.',
 'alarm-panel':'Power and configure a supervised alarm panel, and clear active tamper faults.',
 'alarm-sensors':'Wire sufficient compatible detectors to valid zones and repair their circuits.',
 'alarm-keypad':'Wire and power a working keypad through the alarm panel.',
 'alarm-armed':'Configure zones, issue an authorized arming command and complete the exit delay.',
 'alarm-triggered':'With the panel armed, stimulate a detector and verify an alarmed zone in the engine.',
 'alarm-output':'Connect a siren or strobe, then verify sufficient output power when an alarm triggers.',
 'alarm-beam':'Install a powered perimeter beam and repair its alarm cable and zone configuration.',
 'router-ready':'Power a router with correctly configured virtual interfaces.',
 'dhcp-lease':'Configure a valid DHCP pool on the intended VLAN and obtain an actual simulated lease.',
 'intervlan-route':'Set VLAN ports, router interfaces and gateways so a real simulated path crosses routed subnets.',
 'access-controller':'Power and configure a door controller with acceptable output power demand.',
 'access-readers':'Connect compatible access readers and check their controller circuits.',
 'access-lock':'Wire a working lock output with sufficient power.',
 'access-door':'Assign the controller to a real door opening with a reader and a single controlled lock.',
 'access-granted':'Create a synthetic permitted credential and demonstrate an authorized reader request.',
 'access-denied':'Demonstrate that a disabled, invalid or unscheduled credential is denied.',
 'access-exit':'Connect a request-to-exit input and verify an authorized exit request.',
 'power-wired':'Enable the explicit electrical wiring model and connect load paths.',
 'solar-generation':'Wire PV to the charge controller under a simulated sunlight condition.',
 'battery-ready':'Install and connect a battery with available stored energy.',
 'backup-outage':'Interrupt grid power and verify that the live camera, NVR and power path remain operational on battery.',
 'fire-detectors':'Install and wire enough smoke or heat detectors to the panel, then check power and supervision.',
 'fire-callpoint':'Install and wire a manual call point at the exit route.',
 'fire-sounder':'Install and wire an alarm sounder to a powered panel output.',
 'fire-24h':'Set every smoke, heat and call-point zone to a 24-hour zone so it works while the system is unarmed.',
 'fire-alarm':'Trigger smoke or heat at a detector and confirm the 24-hour zone raised the alarm and the sounder operates.'
};
const severityOrder={critical:0,major:1,minor:2,information:3};
const clamp=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(100,v)):0;

/** A bounded, stable revision cue for the scored evidence. Not a signature or tamper proof. */
export function evidenceFingerprint(p:Project):string{
 const {assessments:history,updatedAt,...scored}=p;
 void history;void updatedAt;
 // Images are reference visuals and do not participate in the engineering score.
 const {floorplanImage:visual,...data}=scored;void visual;
 const sorted=(value:unknown):unknown=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?
  Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sorted(v)])):value;
 const str=JSON.stringify(sorted(data));let hash=0x811c9dc5;
 for(let i=0;i<str.length;i++){hash^=str.charCodeAt(i);hash=Math.imul(hash,0x01000193);}
 return `fnv32:${(hash>>>0).toString(16).padStart(8,'0')}`;
}

export function buildCompetencyDetails(project:Project,result:SimResult,score:number,passed:boolean):Pick<Assessment,'version'|'method'|'scenarioVersion'|'areas'|'evidence'|'findings'|'gates'|'level'|'summary'|'fingerprint'> {
 const scenario=scenarioFor(project.scenarioId);
 if(!scenario)throw new Error('Cannot assess an unknown scenario');
 const scenarioState=evaluateScenario(project,result);
 const groups=new Map<CompetencyCategory,{earned:number;max:number;objectiveIds:string[]}>();
 const evidence:NonNullable<Assessment['evidence']>=[];
 const findings:AssessmentFinding[]=[];
 for(const objective of scenarioState.objectives){
  const category=CATEGORY[objective.metric];const prior=groups.get(category)||{earned:0,max:0,objectiveIds:[]};
  groups.set(category,{earned:prior.earned+objective.weight*objective.progress,max:prior.max+objective.weight,objectiveIds:[...prior.objectiveIds,objective.id]});
  evidence.push({id:`objective:${objective.id}`,category,source:'scenario-rule',title:objective.title,actual:objective.measured,required:objective.required,met:objective.complete,critical:objective.critical,details:objective.explanation});
  if(!objective.complete)findings.push({id:`objective:${objective.id}`,severity:objective.critical?'critical':'major',category,title:`Incomplete: ${objective.title}`,description:`Observed ${objective.measured} of ${objective.required}. ${objective.explanation}`,recommendation:ACTION[objective.metric],objectiveId:objective.id});
 }
 for(const challenge of scenarioState.challenges){
  evidence.push({id:`challenge:${challenge.id}`,category:'troubleshooting',source:'tracked-incident',title:challenge.label,actual:challenge.resolved?1:0,required:1,met:challenge.resolved,critical:true,details:challenge.resolved?'Original incident repaired':'Original fault remains unresolved'});
  if(!challenge.resolved)findings.push({id:`challenge:${challenge.id}`,severity:'critical',category:'troubleshooting',title:`Unrepaired incident: ${challenge.label}`,description:'The original tracked fault is not repaired in the current simulation.',recommendation:challenge.hint});
 }
 if(scenarioState.unpermittedDevices)findings.push({id:'equipment:not-permitted',severity:'critical',category:'equipment',title:'Non-permitted equipment installed',description:`${scenarioState.unpermittedDevices} device(s) fall outside this scenario's allowed categories.`,recommendation:'Choose devices from the scenario equipment constraints.'});
 if(scenarioState.unquotedModels)findings.push({id:'equipment:unquoted',severity:'major',category:'equipment',title:'Manufacturer quotations missing',description:`${scenarioState.unquotedModels} branded device(s) have no positive GHS quotation.`,recommendation:'Enter a real local quotation for every installed manufacturer reference model.'});
 // Keep engine diagnostics visible without imposing unrelated, undocumented penalty points.
 const uniqueIssues=[...new Set(result.issues.filter(x=>typeof x==='string'&&x.trim()).map(x=>x.slice(0,240)))].slice(0,20);
 for(let i=0;i<uniqueIssues.length;i++){
  findings.push({id:`diagnostic:${i}`,severity:'information',category:'reliability',title:'Active simulation diagnostic',description:uniqueIssues[i],recommendation:'Inspect the named device or connection, correct its configuration and reassess.'});
 }
 const areas:CompetencyArea[]=[...groups.entries()].map(([id,g])=>({id,title:TITLE[id],earned:Math.round(g.earned*100)/100,max:g.max,percent:g.max?Math.round(100*g.earned/g.max):0,objectiveIds:g.objectiveIds}));
 const gates:AssessmentGate[]=[
  {id:'score',met:score>=80,title:'Minimum overall score',description:`${score}/100; minimum 80 points`},
  {id:'critical',met:scenarioState.criticalMet,title:'Critical technical objectives',description:scenarioState.criticalMet?'Required technical objectives satisfied':'One or more critical objectives or equipment restrictions remain open'},
  {id:'complete',met:scenarioState.allComplete,title:'All scenario objectives',description:`${scenarioState.completed}/${scenarioState.total} objectives complete`},
  {id:'independent',met:!project.assisted,title:'Independent attempt',description:project.assisted?'Assisted demonstrations cannot establish competency':'No worked-example assistance flagged'},
  {id:'incident',met:scenarioState.challenges.every(c=>c.resolved),title:'Original faults repaired',description:`${scenarioState.challenges.filter(c=>c.resolved).length}/${scenarioState.challenges.length} incidents repaired`}
 ];
 if(project.assisted)findings.push({id:'assisted',severity:'major',category:'reliability',title:'Assisted demonstration',description:'A worked example was loaded into this attempt.',recommendation:'Create a fresh independent attempt, configure the installation and complete its checks yourself.'});
 findings.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||a.id.localeCompare(b.id));
 const level:NonNullable<Assessment['level']>=passed?'simulated-proficiency':score>=80?'criteria-not-met':score>=50?'developing':'not-yet-demonstrated';
 const summary=passed?`All ${scenarioState.total} scenario outcomes met; this local simulation attempt passed the configured criteria.`:
  `${scenarioState.completed}/${scenarioState.total} objectives complete; ${gates.filter(g=>!g.met).length} acceptance gate(s) remain open.`;
 return {version:2,method:'local-simulation',scenarioVersion:scenario.version,areas,evidence,findings,gates,level,summary,fingerprint:evidenceFingerprint(project)};
}

/** An offline report is training feedback, not an accredited qualification or a trusted credential. */
export function headline(a:Assessment):string{return `${a.score}/100 — ${a.passed?'SIMULATION PASS':'IMPROVEMENT REQUIRED'}`;}
export function competencyTrend(records:ReadonlyArray<{scenarioId:string;assessment:Assessment}>,scenarioId:string):number[]{
 return records.filter(r=>r.scenarioId===scenarioId).slice(-12).map(r=>clamp(r.assessment.score));
}

export function reportDeviceOverview(p:Project):Array<{kind:string;count:number}>{
 const counts=new Map<string,number>();
 for(const d of p.devices){const kind=profile(d.profileId).kind;counts.set(kind,(counts.get(kind)||0)+1);}
 return [...counts.entries()].map(([kind,count])=>({kind,count})).sort((a,b)=>a.kind.localeCompare(b.kind));
}
