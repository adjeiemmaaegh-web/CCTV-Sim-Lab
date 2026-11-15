import React,{useState} from 'react';
import {PROFILES} from '../../../src/domain/catalog.js';
import type {Workbench} from '../hooks/useWorkbench.js';
export function Catalog({w}:{w:Workbench}){
 const [query,setQuery]=useState('');
 const groups=[['camera','IP / ANALOG CAMERAS'],['switch','SWITCHES / VLANs'],['router','ROUTERS & DHCP'],['ap','WIRELESS ACCESS POINTS'],['server','NETWORK DIAGNOSTICS'],['alarm-panel','INTRUSION CONTROL PANELS'],['alarm-sensor','ALARMS / INTRUSION DETECTORS'],['alarm-keypad','ALARM KEYPADS'],['alarm-output','SIRENS & STROBES'],['nvr','IP RECORDERS (NVR)'],['dvr','ANALOG RECORDERS (DVR)']] as const;
 const filtered=(kind:string)=>PROFILES.filter(p=>p.kind===kind&&`${p.name} ${p.model} ${p.protocols.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
 return <aside className="catalog panel"><div className="panel-heading"><h2>Equipment Library</h2><p>Place, cable and configure virtual security hardware</p></div>
 <div className="pad"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search cameras, intrusion alarms, routers…" aria-label="Search equipment"/></div>
 <div className="catalog-scroll">{groups.map(([kind,title])=><section key={kind}><h3>{title} ({filtered(kind).length})</h3>{filtered(kind).map(p=><button key={p.id} draggable={!w.blocked} onDragStart={e=>e.dataTransfer.setData('application/x-securitylab-profile',p.id)} onClick={()=>{w.setPlacing(p.id);w.setMode('place');w.setNotice(`Click the floor plan to place ${p.name}`);}} className={`equipment ${w.placing===p.id?'chosen':''}`} disabled={w.blocked}>
  <span className={`equipment-icon ${kind}`}>{kind==='camera'?'◉':kind==='switch'?'▤':kind==='router'?'⇆':kind==='ap'?'◌':kind.startsWith('alarm-')?'⚑':kind==='server'?'▣':'▣'}</span><span className="equipment-content"><strong>{p.name}</strong><small>{p.model} · {p.powerW} W {p.kind==='camera'?` · ${p.signal||'ip'} · ${p.defaultFov}°`:''}</small></span><span className="price">₵{p.costGhs}</span>
 </button>)}</section>)}<section><h3>STAGE 6 ALARM PRACTICE</h3><button className="alarm-practice" onClick={w.loadAlarmRig} disabled={w.blocked||w.project.devices.some(d=>PROFILES.find(p=>p.id===d.profileId)?.kind==='alarm-panel')}>Install wired alarm practice rig</button><p className="muted tiny">The starter installs an 8-zone panel, three detectors, a keypad, siren and strobe, with physical alarm circuits. Configure, arm and investigate faults in the Alarm Console. Access control and solar laboratories follow in Stages 7–8.</p></section></div>
 </aside>;
}
