import type {FieldIssue,FieldReview,FieldTrial,FieldTrialTask,Project} from '../domain/types.js';

/** A field review is explicitly entered by a human, not a browser or hardware test. */
export const FIELD_TASKS:ReadonlyArray<{id:FieldTrialTask;title:string;guidance:string}>=[
 {id:'property-editor',title:'Property design and geometry',guidance:'Create a layout, edit walls/openings, save and reopen the geometry'},
 {id:'cctv-installation',title:'CCTV and recorder setup',guidance:'Install cameras, route cables, inspect coverage and recording channels'},
 {id:'network-troubleshooting',title:'IP network troubleshooting',guidance:'Cause and repair a connectivity/VLAN/PoE fault'},
 {id:'alarm-workflow',title:'Intrusion alarm workflow',guidance:'Arm zones, inject an intrusion and inspect siren response'},
 {id:'access-control',title:'Access control workflow',guidance:'Test granted and denied credentials plus door alerts'},
 {id:'power-backup',title:'Outage and backup power',guidance:'Simulate grid loss, battery depletion and recovery'},
 {id:'file-reopen',title:'Local file persistence',guidance:'Save project, close/reopen the file and verify unchanged equipment'},
 {id:'offline-workflow',title:'Offline operation',guidance:'Disconnect internet on a supported secure origin and complete a scenario'},
 {id:'assessment-report',title:'Assessment and export',guidance:'Record a scenario outcome and export the local assessment'}
];
export const emptyReview=():FieldReview=>({version:1,trials:[],issues:[]});
export const fieldReview=(p:Project):FieldReview=>p.fieldReview||emptyReview();
export function withFieldTrial(p:Project,trial:FieldTrial):Project{
 const review=fieldReview(p);
 if(review.trials.length>=120)throw new Error('Field review has reached its 120-session project limit. Export the review first.');
 return {...p,fieldReview:{version:1,trials:[...review.trials,trial],issues:review.issues}};
}
export function withFieldIssue(p:Project,issue:FieldIssue):Project{
 const review=fieldReview(p);
 if(review.issues.length>=120)throw new Error('Field review has reached its 120-issue project limit. Export the review first.');
 return {...p,fieldReview:{version:1,trials:review.trials,issues:[...review.issues,issue]}};
}
export function setIssueStatus(p:Project,id:string,status:FieldIssue['status']):Project{
 const review=fieldReview(p);
 if(!review.issues.some(f=>f.id===id))throw new Error('Unknown field issue');
 return {...p,fieldReview:{version:1,trials:review.trials,issues:review.issues.map(f=>f.id===id?{...f,status}:f)}};
}
export type FieldReadiness={reviewedTasks:number;totalTasks:number;scenarioCount:number;roleCount:number;offlineCompleted:boolean;lowSpecCompleted:boolean;unresolvedCritical:number;unresolvedMajor:number;completed:number;blocked:number;gates:{title:string;met:boolean;details:string}[];status:'EVIDENCE INCOMPLETE'|'REVIEW EVIDENCE RECORDED'};
/** Preparation dashboard only. Never implies the app is production-ready or accepted. */
export function fieldReadiness(p:Project):FieldReadiness{
 const {trials,issues}=fieldReview(p);
 const completed=trials.filter(t=>t.outcome==='completed');
 const reviewedTasks=new Set(completed.map(t=>t.task)).size;
 const scenarioCount=new Set(completed.map(t=>t.scenarioId)).size;
 const roleCount=new Set(completed.map(t=>t.role)).size;
 const offlineCompleted=completed.some(t=>t.offline&&t.task==='offline-workflow');
 const lowSpecCompleted=completed.some(t=>t.deviceClass==='low-spec');
 const unresolvedCritical=issues.filter(i=>i.status!=='resolved'&&i.severity==='critical').length;
 const unresolvedMajor=issues.filter(i=>i.status!=='resolved'&&i.severity==='major').length;
 const gates=[
  {title:'Every field task observed',met:reviewedTasks===FIELD_TASKS.length,details:`${reviewedTasks}/${FIELD_TASKS.length} workflows observed as completed`},
  {title:'Multiple learning perspectives',met:roleCount===3,details:`${roleCount}/3 anonymous roles represented`},
  {title:'Scenario coverage',met:scenarioCount>=10,details:`${scenarioCount}/10 scenarios observed as completed`},
  {title:'Offline workflow observed',met:offlineCompleted,details:offlineCompleted?'Manually reported completed offline session':'No completed offline session recorded'},
  {title:'Affordable computer observed',met:lowSpecCompleted,details:lowSpecCompleted?'Low-spec field session reported':'No low-spec session recorded'},
  {title:'Critical/major findings resolved',met:unresolvedCritical===0&&unresolvedMajor===0,details:`${unresolvedCritical} open critical · ${unresolvedMajor} open major findings`}
 ];
 const covered=gates.every(g=>g.met);
 return {reviewedTasks,totalTasks:FIELD_TASKS.length,scenarioCount,roleCount,offlineCompleted,lowSpecCompleted,unresolvedCritical,unresolvedMajor,completed:completed.length,blocked:trials.filter(t=>t.outcome==='blocked').length,gates,status:covered?'REVIEW EVIDENCE RECORDED':'EVIDENCE INCOMPLETE'};
}
const escapeHtml=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
/** Export only metadata and anonymous observations, not passwords, keys or full project contents. */
export function fieldReviewExport(p:Project){
 return {format:'securitylab.field-review',version:1,project:{id:p.id,title:p.title,scenarioId:p.scenarioId},
  review:structuredClone(fieldReview(p)),coverage:fieldReadiness(p),
  disclaimer:'Unverified, user-entered field observations. No automatic test, accreditation, hardware certification, security approval or production release authorization. Source build and cross-browser verification remain separate requirements.'};
}
export function fieldReviewJson(p:Project):string{return JSON.stringify(fieldReviewExport(p),null,2)+'\n';}
export function fieldReviewHtml(p:Project):string{
 const r=fieldReviewExport(p),e=escapeHtml;
 const t=r.review.trials.map(v=>`<tr><td>${e(v.at)}</td><td>${e(v.role)}</td><td>${e(v.scenarioId)}</td><td>${e(v.task)}</td><td>${e(v.outcome)}</td><td>${e(v.platform)} / ${e(v.browser)} · ${e(v.ramGb)}GB</td><td>${e(v.notes)}</td></tr>`).join('');
 const f=r.review.issues.map(v=>`<tr><td>${e(v.severity)}</td><td>${e(v.status)}</td><td>${e(v.summary)}</td><td>${e(v.steps)}</td><td>${e(v.expected)}</td><td>${e(v.observed)}</td></tr>`).join('');
 const g=r.coverage.gates.map(v=>`<li>${v.met?'Observed':'OPEN'} — ${e(v.title)}: ${e(v.details)}</li>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>SecurityLab field review</title><style>body{font:14px/1.5 system-ui;margin:32px;color:#152c40}table{border-collapse:collapse;width:100%;margin:18px 0}th,td{padding:8px;border:1px solid #b9c9d3;text-align:left;vertical-align:top;overflow-wrap:anywhere}h1{color:#087f7b}aside{padding:16px;background:#fff3da}li{margin:6px 0}@media print{body{margin:12mm}}</style></head><body><h1>SecurityLab — anonymous field review</h1><p>${e(p.title)} · ${e(p.scenarioId)} · ${e(r.coverage.status)}</p><aside><b>NOT A RELEASE APPROVAL.</b> ${e(r.disclaimer)}</aside><h2>Evidence coverage</h2><ul>${g}</ul><h2>Manual field sessions</h2><table><thead><tr><th>Recorded</th><th>Role</th><th>Scenario</th><th>Task</th><th>Outcome</th><th>Environment</th><th>Notes</th></tr></thead><tbody>${t}</tbody></table><h2>Reported findings</h2><table><thead><tr><th>Severity</th><th>Status</th><th>Summary</th><th>Reproduction</th><th>Expected</th><th>Observed</th></tr></thead><tbody>${f}</tbody></table></body></html>`;
}
