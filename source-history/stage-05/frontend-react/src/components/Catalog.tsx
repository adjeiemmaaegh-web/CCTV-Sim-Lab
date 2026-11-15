import React,{useState} from 'react';
import {PROFILES} from '../../../src/domain/catalog.js';
import type {Workbench} from '../hooks/useWorkbench.js';
export function Catalog({w}:{w:Workbench}){
 const [query,setQuery]=useState('');
 const groups=[['camera','IP / ANALOG CAMERAS'],['switch','SWITCHES / VLANs'],['router','ROUTERS & DHCP'],['ap','WIRELESS ACCESS POINTS'],['server','NETWORK DIAGNOSTICS'],['nvr','IP RECORDERS (NVR)'],['dvr','ANALOG RECORDERS (DVR)']] as const;
 const filtered=(kind:string)=>PROFILES.filter(p=>p.kind===kind&&`${p.name} ${p.model} ${p.protocols.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 return <aside className="catalog panel"><div className="panel-heading"><h2>Equipment Library</h2><p>Place, cable and configure virtual security hardware</p></div>
 <div className="pad"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search equipment, router, Wi-Fi, VLAN…" aria-label="Search equipment"/></div>
 <div className="catalog-scroll">{groups.map(([kind,title])=><section key={kind}><h3>{title} ({filtered(kind).length})</h3>{filtered(kind).map(p=><button key={p.id} draggable={!w.blocked} onDragStart={e=>e.dataTransfer.setData('application/x-securitylab-profile',p.id)} onClick={()=>{w.setPlacing(p.id);w.setMode('place');w.setNotice(`Click the floor plan to place ${p.name}`);}} className={`equipment ${w.placing===p.id?'chosen':''}`} disabled={w.blocked}>
  <span className={`equipment-icon ${kind}`}>{kind==='camera'?'◉':kind==='switch'?'▤':kind==='router'?'⇆':kind==='ap'?'◌':kind==='server'?'▣':'▣'}</span><span className="equipment-content"><strong>{p.name}</strong><small>{p.model} · {p.powerW} W {p.kind==='camera'?` · ${p.signal||'ip'} · ${p.defaultFov}°`:''}</small></span><span className="price">₵{p.costGhs}</span>
 </button>)}</section>)}<section><h3>FUTURE LABORATORIES</h3><p className="muted tiny">Intrusion, access control and backup-power laboratories are planned for Stages 6–8. Current networking devices are educational models, not real firmware.</p></section></div>
 </aside>;
}
