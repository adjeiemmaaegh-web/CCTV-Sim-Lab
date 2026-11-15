import React,{useMemo,useRef,useState} from 'react';
import {t} from '../../../../src/i18n/index.js';
import {SpeakButton,useLocale} from '../Speak.js';
import type {Workbench} from '../../hooks/useWorkbench.js';
import {LESSONS,lessonProgress} from '../../../../src/tools/lessons.js';
import {FAULT_KINDS,FAULT_LABEL,generateFaults,reveal,submitGuess,type FaultKind} from '../../../../src/tools/faultGen.js';
import {auditStats} from '../../../../src/tools/audit.js';
import {DEFAULT_QUOTE_SETTINGS,buildQuote,quoteCsv,quoteHtml,type QuoteSettings} from '../../../../src/tools/quote.js';
import {SAMPLE_PACK_SCENARIO,classSheetCsv,exportPack,loadPack,type SheetRow} from '../../../../src/tools/scenarioPack.js';
import {parseProjectText,downloadText} from '../../../../src/persistence/file-projects.js';
import {SCENARIOS} from '../../../../src/scenarios/index.js';
import {planReportHtml} from '../../../../src/tools/report.js';
import {SAMPLE_PROFILE,exportProfilePack,loadProfilePack} from '../../../../src/tools/profilePack.js';

/** Feature 8: guided lessons, progress derived from the real simulation. */
export function LessonsPanel({w}:{w:Workbench}){
 useLocale();
 const [id,setId]=useState(LESSONS[0].id);const lesson=LESSONS.find(l=>l.id===id)!;
 const prog=useMemo(()=>lessonProgress(w.project,lesson,w.result),[w.project,w.result,lesson]);
 return <section className="tool-panel" aria-label="Guided lessons">
  <div className="tool-row"><label>Lesson <select aria-label="Lesson" value={id} onChange={e=>setId(e.currentTarget.value)}>{LESSONS.map(l=><option key={l.id} value={l.id}>{l.title} ({l.level})</option>)}</select></label>
   {w.project.scenarioId!==lesson.scenarioId&&<button disabled={w.blocked} onClick={()=>w.switchScenario(lesson.scenarioId)}>Open scenario for this lesson</button>}
   <b aria-live="polite">{t('lesson.steps',{done:prog.completed,total:lesson.steps.length})}{prog.finished?` — ${t('lesson.complete')}`:''}</b></div>
  <p className="editor-muted">{lesson.summary} Steps tick only when the simulated installation really satisfies them.</p>
  <ol className="lesson-steps">{lesson.steps.map((s,i)=><li key={s.id} className={prog.done[i]?'good':i===prog.currentIndex?'current-step':'muted'} aria-current={i===prog.currentIndex?'step':undefined}>
   <b>{prog.done[i]?'✓':i===prog.currentIndex?'▶':'○'} {s.title}</b>
   {i===prog.currentIndex&&<div className="lesson-detail"><p>{s.instruction} <SpeakButton text={`${s.title}. ${s.instruction} ${t('lesson.why')}: ${s.why}`}/></p><p><i>{t('lesson.why')}:</i> {s.why}</p><details><summary>{t('lesson.hint')}</summary><p>{s.hint}</p></details></div>}</li>)}</ol>
 </section>;
}

/** Feature 9: seeded fault exercise. */
export function FaultGenPanel({w}:{w:Workbench}){
 const [seed,setSeed]=useState('1');const [count,setCount]=useState('1');const [picked,setPicked]=useState<FaultKind[]>([]);const [result,setResult]=useState('');
 const d=w.project.diagnosis;
 const make=()=>{try{const s=Number(seed),c=Number(count);const g=generateFaults(w.project,s,c);w.commit(g.project,`Fault exercise created (seed ${s}). Diagnose it, then submit your answer.`);setPicked([]);setResult('');w.setTab('diagnostics');}catch(e){w.setNotice(String((e as Error).message));}};
 const submit=()=>{try{const r=submitGuess(w.project,picked);w.commit(r.project);setResult(`Correct: ${r.correct.length}/${d!.applied.length}${r.wrong.length?` · wrong guesses: ${r.wrong.map(k=>FAULT_LABEL[k]).join(', ')}`:''}${r.missed.length?` · still to find: ${r.missed.length}`:' · all found!'}`);}catch(e){w.setNotice(String((e as Error).message));}};
 return <section className="tool-panel" aria-label="Fault exercise generator">
  <div className="tool-row"><label>Seed <input aria-label="Fault seed" inputMode="numeric" value={seed} onChange={e=>setSeed(e.currentTarget.value)}/></label>
   <label>Faults <select aria-label="Fault count" value={count} onChange={e=>setCount(e.currentTarget.value)}>{[1,2,3,4].map(n=><option key={n}>{n}</option>)}</select></label>
   <button disabled={w.blocked} onClick={make}>Create fault exercise</button></div>
  <p className="editor-muted">The same seed on the same starting project always creates the same faults. Use Diagnostics, Network CLI and Packet trace to investigate.</p>
  {d?<><h4>Your diagnosis ({d.applied.length} fault{d.applied.length>1?'s':''} injected, seed {d.seed})</h4>
   <div className="fault-picks" role="group" aria-label="Suspected faults">{FAULT_KINDS.map(k=><label key={k}><input type="checkbox" checked={picked.includes(k)} onChange={e=>setPicked(p=>e.currentTarget.checked?[...p,k]:p.filter(x=>x!==k))}/> {FAULT_LABEL[k]}</label>)}</div>
   <div className="tool-row"><button onClick={submit} disabled={w.blocked||!picked.length}>Submit diagnosis</button><button disabled={w.blocked} onClick={()=>w.commit(reveal(w.project),'Answer revealed')}>Reveal answer</button></div>
   {result&&<p role="status">{result}</p>}
   {d.revealed&&<ul aria-label="Answer">{d.applied.map((a,i)=><li key={i}><b>{FAULT_LABEL[a.kind as FaultKind]??a.kind}</b> — {a.message}</li>)}</ul>}</>:<p className="muted">No fault exercise in this project yet.</p>}
 </section>;
}

/** Feature 10: instructor mode (scenario packs, class sheet). File-based only. */
export function InstructorPanel({w}:{w:Workbench}){
 const packRef=useRef<HTMLInputElement>(null),sheetRef=useRef<HTMLInputElement>(null),profRef=useRef<HTMLInputElement>(null);const [msg,setMsg]=useState('');
 const custom=SCENARIOS.filter(s=>s.id.startsWith('custom-'));
 const readText=(f:File)=>new Promise<string>((res,rej)=>{if(f.size>2_000_000){rej(new Error('File too large'));return;}f.text().then(res,rej);});
 const onPack=async(f:File)=>{try{const sc=loadPack(await readText(f));setMsg(`Loaded ${sc.length} custom scenario(s): ${sc.map(s=>s.title).join(', ')}`);w.setNotice('Scenario pack loaded');}catch(e){setMsg(`Pack rejected: ${(e as Error).message}`);}};
 const onProfiles=async(f:File)=>{try{const ps=loadProfilePack(await readText(f));setMsg(`Loaded ${ps.length} device profile(s): ${ps.map(x=>x.model).join(', ')}. They are educational simulations; enter your own quotation per device.`);w.setNotice('Device profile pack loaded');}catch(e){setMsg(`Profile pack rejected: ${(e as Error).message}`);}};
 const onSheet=async(files:FileList)=>{
  const rows:SheetRow[]=[];const bad:string[]=[];
  for(const f of Array.from(files).slice(0,200)){try{
   const o=parseProjectText(await readText(f),f.name),a=(o.project.assessments||[]).at(-1)?.assessment;
   rows.push({student:f.name.replace(/\.securitylab\.json$|\.json$/i,''),project:o.project.title,scenario:o.project.scenarioId,score:a?a.score:'',passed:a?(a.passed?'yes':'no'):'not assessed',assisted:o.project.assisted?'yes':'no',assessments:o.project.assessments?.length||0});
  }catch(e){bad.push(`${f.name}: ${(e as Error).message}`);}}
  if(rows.length)downloadText(classSheetCsv(rows),'class-results.csv','text/csv;charset=utf-8');
  setMsg(`${rows.length} project(s) summarised${bad.length?`; ${bad.length} rejected (${bad.join(' | ')})`:''}.`);
 };
 return <section className="tool-panel" aria-label="Instructor mode">
  <p className="editor-muted">Local files only. Scenario packs define the brief, permitted equipment and scored objectives. Custom scenarios are embedded in each project, so learners can open them without the pack.</p>
  <div className="tool-row"><button onClick={()=>packRef.current?.click()}>Load scenario pack…</button>
   <button onClick={()=>downloadText(exportPack([SAMPLE_PACK_SCENARIO]),'sample-scenario-pack.json')}>Download sample pack</button>
   <button onClick={()=>profRef.current?.click()}>Load device profile pack…</button>
   <button onClick={()=>downloadText(exportProfilePack([SAMPLE_PROFILE]),'sample-profile-pack.json')}>Download sample profile pack</button>
   <button onClick={()=>sheetRef.current?.click()}>Class results sheet from project files…</button></div>
  <input hidden type="file" ref={packRef} accept=".json,application/json" onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void onPack(f);e.currentTarget.value='';}}/>
  <input hidden type="file" ref={profRef} accept=".json,application/json" onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void onProfiles(f);e.currentTarget.value='';}}/>
  <input hidden type="file" multiple ref={sheetRef} accept=".json,application/json" onChange={e=>{const f=e.currentTarget.files;if(f?.length)void onSheet(f);e.currentTarget.value='';}}/>
  {msg&&<p role="status">{msg}</p>}
  <h4>Custom scenarios loaded ({custom.length})</h4>
  {custom.length?<ul>{custom.map(s=><li key={s.id}>{s.title} — equipment: {s.allowedKinds.join(', ')} <button disabled={w.blocked} onClick={()=>w.switchScenario(s.id)}>Open</button></li>)}</ul>:<p className="muted">None yet.</p>}
 </section>;
}

/** Feature 11: audit trail and replay. */
export function AuditPanel({w}:{w:Workbench}){
 const a=w.project.audit||[],stats=auditStats(w.project);const [i,setI]=useState(-1);
 const shown=i<0?a.length-1:Math.min(i,a.length-1);
 return <section className="tool-panel" aria-label="Audit trail">
  <p><b>{stats.entries}</b> recorded actions · {stats.durationMinutes.toFixed(1)} min span · {stats.assessments} assessment run(s){stats.firstDeviceAfterMinutes!==null?` · first equipment after ${stats.firstDeviceAfterMinutes.toFixed(1)} min`:''}</p>
  {stats.flags.map((f,k)=><p key={k} className="warning-line">⚑ {f}</p>)}
  {a.length>0&&<><label>Replay position <input type="range" aria-label="Replay position" min={0} max={a.length-1} value={shown} onChange={e=>setI(Number(e.currentTarget.value))}/></label>
   <p aria-live="polite"><b>Step {shown+1}/{a.length}</b> · {new Date(a[shown].at).toLocaleTimeString()} · {a[shown].summary} → {a[shown].devices} devices, {a[shown].cables} cables</p></>}
  <ol className="audit-list" aria-label="Actions">{a.slice(-60).map((e,k)=><li key={k}>{e.at.slice(11,19)} — {e.summary}</li>)}</ol>
  {!a.length&&<p className="muted">No actions recorded yet. Edit the installation and they appear here.</p>}
 </section>;
}

/** Feature 12: bill of materials and quotation. */
export function QuotePanel({w}:{w:Workbench}){
 const [s,setS]=useState<QuoteSettings>(DEFAULT_QUOTE_SETTINGS);
 const set=(patch:Partial<QuoteSettings>)=>setS(v=>({...v,...patch}));
 let q:ReturnType<typeof buildQuote>|null=null,err='';try{q=buildQuote(w.project,s);}catch(e){err=(e as Error).message;}
 const n=(v:string)=>{const x=Number(v);return Number.isFinite(x)&&x>=0?x:0;};
 return <section className="tool-panel" aria-label="Quotation">
  <div className="tool-row"><label>Labour rate / h <input aria-label="Labour rate" inputMode="decimal" value={s.labourRatePerHour} onChange={e=>set({labourRatePerHour:n(e.currentTarget.value)})}/></label>
   <label>Margin % <input aria-label="Margin percent" inputMode="decimal" value={s.marginPercent} onChange={e=>set({marginPercent:n(e.currentTarget.value)})}/></label>
   <label>VAT % <input aria-label="VAT percent" inputMode="decimal" value={s.vatPercent} onChange={e=>set({vatPercent:n(e.currentTarget.value)})}/></label>
   <label>Ethernet GHS/m <input aria-label="Ethernet rate" inputMode="decimal" value={s.cableRatePerMetre.ethernet} onChange={e=>set({cableRatePerMetre:{...s.cableRatePerMetre,ethernet:n(e.currentTarget.value)}})}/></label></div>
  {err&&<p className="warning-line">{err}</p>}
  {q&&<><table className="tool-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
   {q.lines.map((l,i)=><tr key={i} className={l.needsQuotation?'warning-line':''}><td>{l.description}</td><td>{l.qty}</td><td>{l.unitCost===null?'quote needed':l.unitCost.toFixed(2)}</td><td>{l.total===null?'—':l.total.toFixed(2)}</td></tr>)}
   {q.cables.map(c=><tr key={c.medium}><td>Cable ({c.medium})</td><td>{c.metres} m</td><td>{c.rate.toFixed(2)}</td><td>{c.total.toFixed(2)}</td></tr>)}
   <tr><td>Labour ({q.labourHours} h)</td><td></td><td></td><td>{q.labour.toFixed(2)}</td></tr>
   <tr><td><b>Subtotal</b></td><td></td><td></td><td>{q.subtotal.toFixed(2)}</td></tr><tr><td>Margin</td><td></td><td></td><td>{q.margin.toFixed(2)}</td></tr><tr><td>VAT</td><td></td><td></td><td>{q.vat.toFixed(2)}</td></tr>
   <tr><td><b>Total ({q.currency})</b></td><td></td><td></td><td><b>{q.total.toFixed(2)}</b></td></tr></tbody></table>
   {q.warnings.map((x,i)=><p key={i} className="warning-line">⚠ {x}</p>)}
   <div className="tool-row"><button onClick={()=>downloadText(quoteCsv(q!),'quotation.csv','text/csv;charset=utf-8')}>Export CSV</button><button onClick={()=>downloadText(quoteHtml(w.project,q!),'quotation.html','text/html;charset=utf-8')}>Export printable HTML</button></div></>}
  <p className="editor-muted">Training estimate. Catalogue prices are placeholders and manufacturer models need your own supplier quotation (set per device in the Inspector). Not a binding quote.</p>
 </section>;
}

/** Feature 17: printable plan report (use the browser's Print -> Save as PDF). */
export function ReportPanel({w}:{w:Workbench}){
 const [note,setNote]=useState('');
 const html=()=>planReportHtml(w.project,w.result);
 const safeName=w.project.title.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').slice(0,60)||'project';
 const open=()=>{try{const url=URL.createObjectURL(new Blob([html()],{type:'text/html;charset=utf-8'}));const win=window.open(url,'_blank','noopener');if(!win)setNote('Pop-up blocked: use Download instead, then open the file and print it.');else{setNote('Report opened in a new tab. Use Print, then choose Save as PDF.');setTimeout(()=>URL.revokeObjectURL(url),60_000);}}catch(e){setNote(`Could not build the report: ${(e as Error).message}`);}};
 return <section className="tool-panel" aria-label="Printable report">
  <p>Creates a standalone report with the floor plan(s), equipment list, estimate, good-practice review and diagnostics.</p>
  <div className="tool-row"><button onClick={open}>Open printable report</button><button onClick={()=>{try{downloadText(html(),`${safeName}-report.html`,'text/html;charset=utf-8');setNote('Report downloaded. Open it and use Print → Save as PDF.');}catch(e){setNote(`Could not build the report: ${(e as Error).message}`);}}}>Download report (HTML)</button></div>
  {note&&<p role="status">{note}</p>}
  <p className="editor-muted">Printing to PDF is done by your browser; SecurityLab does not upload anything.</p>
 </section>;
}
