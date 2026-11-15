import React,{useState} from 'react';
import {PROFILES} from '../../../src/domain/catalog.js';
import type {Workbench} from '../hooks/useWorkbench.js';
export function Catalog({w}:{w:Workbench}){
 const [query,setQuery]=useState('');
 const groups=[['camera','CAMERAS'],['switch','NETWORK SWITCHES'],['nvr','RECORDING EQUIPMENT']] as const;
 return <aside className="catalog panel"><div className="panel-heading"><h2>Equipment Library</h2><p>Choose equipment and place it on the canvas</p></div>
 <div className="pad"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search equipment…" aria-label="Search equipment"/></div>
 <div className="catalog-scroll">{groups.map(([kind,title])=><section key={kind}><h3>{title}</h3>{PROFILES.filter(p=>p.kind===kind&&`${p.name} ${p.model}`.toLowerCase().includes(query.toLowerCase())).map(p=><button key={p.id} draggable={!w.blocked} onDragStart={e=>e.dataTransfer.setData('application/x-securitylab-profile',p.id)} onClick={()=>{w.setPlacing(p.id);w.setMode('place');w.setNotice(`Click the floor plan to place ${p.name}`);}} className={`equipment ${w.placing===p.id?'chosen':''}`} disabled={w.blocked}>
  <span className={`equipment-icon ${kind}`}>{kind==='camera'?'◉':kind==='switch'?'▤':'▣'}</span><span className="equipment-content"><strong>{p.name}</strong><small>{p.model} · {p.powerW}W {p.kind==='camera'?`· ${p.defaultFov}° FOV`:''}</small></span><span className="price">₵{p.costGhs}</span>
 </button>)}</section>)}<section><h3>FUTURE LABORATORIES</h3><p className="muted tiny">Alarm systems, access control, and solar equipment will be added in Stages 6–8. Listed here as roadmap scope, not operable Stage 2 devices.</p></section></div>
 </aside>;
}
