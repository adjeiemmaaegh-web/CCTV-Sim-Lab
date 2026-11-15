import React,{useMemo,useState} from 'react';
import type {Workbench} from '../../hooks/useWorkbench.js';
import {DISCLAIMER,RULE_SETS,reviewProject,summarise,type SetId} from '../../../../src/tools/standards.js';

/** Feature 14: selectable good-practice checklists (training guidance, not certification). */
export function StandardsPanel({w}:{w:Workbench}){
 const [sets,setSets]=useState<SetId[]>(['cctv','alarm','fire','network']);
 const rules=useMemo(()=>reviewProject(w.project,sets,w.result),[w.project,w.result,sets]);
 const sum=summarise(rules);
 const icon={pass:'✓',warn:'⚠',fail:'✗',na:'–'} as const;
 return <section className="tool-panel" aria-label="Good practice review">
  <div className="tool-row" role="group" aria-label="Rule sets">{RULE_SETS.map(s=><label key={s.id} style={{flexDirection:'row',gap:6,alignItems:'center'}}><input type="checkbox" checked={sets.includes(s.id)} onChange={e=>setSets(v=>e.currentTarget.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/> {s.title}</label>)}</div>
  <p aria-live="polite"><b className="good">{sum.pass} pass</b> · <b>{sum.warn} warn</b> · <b className="warning-line">{sum.fail} fail</b> · {sum.na} n/a</p>
  <table className="tool-table" aria-label="Review results"><thead><tr><th></th><th>Rule</th><th>Finding</th></tr></thead>
   <tbody>{rules.map(r=><tr key={r.id} className={r.status==='fail'||r.status==='warn'?'warning-line':''}><td aria-label={r.status}>{icon[r.status]}</td><td>{r.title}</td><td>{r.detail}</td></tr>)}</tbody></table>
  <p className="editor-muted">{DISCLAIMER}</p>
 </section>;
}
