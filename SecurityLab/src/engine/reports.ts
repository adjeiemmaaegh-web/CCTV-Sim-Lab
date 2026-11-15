import type {AssessmentRecord} from '../domain/types.js';

/** Export only explicitly recorded local-simulation snapshots; never export credential tokens. */
export type TrainingReport={format:'securitylab-practical-assessment';version:2;record:AssessmentRecord;disclaimer:string};
const disclaimer='Educational simulation result only. This file is locally editable and is not a verified certificate, professional license, third-party attestation or proof of real-hardware competence.';
export function trainingReport(record:AssessmentRecord):TrainingReport{
 // Copy instead of returning mutable project state; no access identity tokens or floor plan images are included.
 return {format:'securitylab-practical-assessment',version:2,record:structuredClone(record),disclaimer};
}
const esc=(v:unknown)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function reportAsJson(record:AssessmentRecord):string{return JSON.stringify(trainingReport(record),null,2)+'\n';}
export function reportAsHtml(record:AssessmentRecord):string{
 const r=trainingReport(record),a=r.record.assessment;
 const line=(name:string,value:unknown)=>`<div class="pair"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`;
 const areas=(a.areas||[]).map(c=>`<tr><td>${esc(c.title)}</td><td>${esc(c.earned)} / ${esc(c.max)}</td><td>${esc(c.percent)}%</td></tr>`).join('');
 const gates=(a.gates||[]).map(g=>`<tr><td>${esc(g.title)}</td><td>${g.met?'Met':'Not met'}</td><td>${esc(g.description)}</td></tr>`).join('');
 const findings=(a.findings||[]).map(f=>`<section class="finding"><strong>${esc(f.severity.toUpperCase())} · ${esc(f.title)}</strong><p>${esc(f.description)}</p><p><b>Action:</b> ${esc(f.recommendation)}</p></section>`).join('');
 const evidence=(a.evidence||[]).map(e=>`<tr><td>${esc(e.title)}</td><td>${esc(e.actual)} / ${esc(e.required)}</td><td>${e.met?'Met':'Not met'}</td><td>${esc(e.details)}</td></tr>`).join('');
 const rubrics=a.rubric.map(x=>`<tr><td>${esc(x.title)}</td><td>${esc(x.earned)} / ${esc(x.max)}</td><td>${esc(x.details)}</td></tr>`).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'"><title>SecurityLab Assessment · ${esc(record.scenarioId)}</title><style>
  :root{color-scheme:light;font:14px/1.55 system-ui,Segoe UI,Arial,sans-serif;color:#183044;background:#fff}body{max-width:920px;margin:35px auto;padding:20px}header{border-bottom:3px solid #128b86;padding-bottom:14px}h1{font-size:28px;margin:0}h2{margin:29px 0 10px;border-bottom:1px solid #d5dfe5;padding-bottom:5px}small,.muted{color:#536878}.score{font-size:30px;font-weight:750;color:#066863}.pair{display:flex;gap:12px;justify-content:space-between;max-width:540px;padding:3px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;border-bottom:1px solid #dce4e9;padding:8px;vertical-align:top}.finding{padding:8px 12px;border-left:3px solid #d97706;background:#fff9ef;margin:8px 0}.finding p{margin:3px 0}.disclaimer{padding:14px;background:#f4f7f9;border:1px solid #c7d4dd;margin-top:28px}@media print{body{margin:0;padding:5mm}.finding{break-inside:avoid}}
 </style></head><body><header><small>SECURITYLAB · LOCAL SIMULATION ENGINEERING ASSESSMENT</small><h1>Practical installation report</h1><p class="score">${esc(a.score)}/100 · ${a.passed?'SIMULATED PASS':'NOT YET PASSED'}</p><p>${esc(a.summary||'Assessment recorded with the configured scenario rubric.')}</p></header><section><h2>Record</h2>
 ${line('Project',record.projectTitle||'Unnamed project')}${line('Scenario',record.scenarioId)}${line('Recorded at (UTC)',record.at)}${line('Assessment ID',record.id)}${line('Scenario definition version',a.scenarioVersion??'Legacy')}${line('Evidence revision cue',a.fingerprint||'Legacy record')}${line('Mode','Local simulated exercise')}</section>
 <h2>Pass gates</h2><table><thead><tr><th>Gate</th><th>Status</th><th>Explanation</th></tr></thead><tbody>${gates||'<tr><td colspan="3">Legacy report — detailed gates not captured</td></tr>'}</tbody></table>
 <h2>Competency breakdown</h2><table><thead><tr><th>Area</th><th>Points</th><th>Progress</th></tr></thead><tbody>${areas||'<tr><td colspan="3">Legacy report — area breakdown unavailable</td></tr>'}</tbody></table>
 <h2>Assessment rubric</h2><table><thead><tr><th>Criterion</th><th>Points</th><th>Explanation</th></tr></thead><tbody>${rubrics}</tbody></table>
 <h2>Mistakes and prioritized corrections</h2>${findings||'<p>No reported mistakes in the captured simulation state.</p>'}
 <h2>Measured evidence</h2><table><thead><tr><th>Requirement</th><th>Result</th><th>Pass</th><th>Observation</th></tr></thead><tbody>${evidence||'<tr><td colspan="4">Legacy report — evidence snapshot unavailable</td></tr>'}</tbody></table>
 <p class="disclaimer"><strong>Training-only disclaimer.</strong> ${esc(r.disclaimer)}</p></body></html>`;
}
