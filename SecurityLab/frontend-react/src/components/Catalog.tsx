import {EquipmentCompare} from './EquipmentCompare.js';
import React,{useState} from 'react';
import {PROFILES} from '../../../src/domain/catalog.js';
import {MANUFACTURERS} from '../../../src/domain/manufacturers/index.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import {Icon,kindIcon} from './icons.js';

/** Library categories: each groups several device kinds, as in the workstation design. */
const CATEGORIES:{id:string;title:string;icon:string;kinds:string[]}[]=[
 {id:'cctv',title:'CCTV Cameras',icon:'camera',kinds:['camera']},
 {id:'rec',title:'Recording & Storage',icon:'recorder',kinds:['nvr','dvr']},
 {id:'net',title:'Network Devices',icon:'network',kinds:['switch','router','ap','server']},
 {id:'alarm',title:'Alarm Devices',icon:'alarm',kinds:['alarm-panel','alarm-sensor','alarm-keypad','alarm-output']},
 {id:'access',title:'Access Control',icon:'access',kinds:['access-controller','access-reader','access-lock','access-exit','access-server']},
 {id:'power',title:'Power & Infrastructure',icon:'power',kinds:['power-grid','power-ups','power-psu','power-solar','power-controller','power-battery','power-inverter','power-ac-panel','power-dc-panel']},
];
const specLine=(p:(typeof PROFILES)[number])=>{
 const bits:string[]=[];
 if(p.kind==='camera'){if(p.megapixels)bits.push(`${p.megapixels} MP`);bits.push(p.signal==='analog'?'Analog':'IP');if(p.defaultFov)bits.push(`${p.defaultFov}°`);}
 else bits.push(p.model);
 bits.push(`${p.powerW} W`);
 if(p.manufacturerSpec)bits.push(p.manufacturerSpec.status==='reference-only'?'Data sheet only':'Documented simulation');
 return bits.join(' · ');
};

export function Catalog({w,onChoose}:{w:Workbench;onChoose?:()=>void}){
 const [query,setQuery]=useState('');
 const [maker,setMaker]=useState('all');
 const [family,setFamily]=useState<'all'|'generic'|'manufacturer'>('all');
 const [inspectedId,setInspectedId]=useState('');
 const [open,setOpen]=useState<Record<string,boolean>>({cctv:true});
 const inspected=PROFILES.find(p=>p.id===inspectedId&&p.manufacturerSpec);
 const q=query.trim().toLowerCase();
 const items=(kinds:string[])=>PROFILES.filter(p=>kinds.includes(p.kind)&&w.isAllowedProfile(p.id)&&(maker==='all'||p.manufacturer===maker)&&(family==='all'||(family==='manufacturer')===!!p.manufacturerSpec)&&`${p.name} ${p.model} ${p.manufacturer} ${p.protocols.join(' ')}`.toLowerCase().includes(q));
 const choose=(p:(typeof PROFILES)[number])=>{
  if(p.manufacturerSpec?.status==='reference-only'){setInspectedId(p.id);w.setNotice(`${p.name}: reference only. Review official source and limitations in Filters; wireless Jeweller pairing is not simulated.`);return;}
  w.setPlacing(p.id);w.setMode('place');onChoose?.();w.setNotice(`Click the floor plan to place ${p.name}`);
 };
 const rigs=[
  {id:'alarm-panel-8',label:'Install wired alarm practice rig',done:w.project.devices.some(d=>PROFILES.find(p=>p.id===d.profileId)?.kind==='alarm-panel'),run:w.loadAlarmRig},
  {id:'access-controller-1',label:'Install single-door access rig',done:w.project.devices.some(d=>PROFILES.find(p=>p.id===d.profileId)?.kind==='access-controller'),run:w.loadAccessRig},
  {id:'power-solar',label:'Install grid + UPS + solar power rig',done:w.project.devices.some(d=>PROFILES.find(p=>p.id===d.profileId)?.kind.startsWith('power-')),run:w.loadPowerRig},
 ].filter(r=>w.isAllowedProfile(r.id));
 return <aside className="catalog panel" aria-label="Equipment library">
  <div className="panel-heading"><h2>Equipment Library</h2><p>Choose a device, then place it on the plan</p></div>
  <div className="pad search-box"><Icon name="search" size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search equipment..." aria-label="Search equipment"/></div>
  <details className="catalog-filter-box"><summary>Filters and specification sheets</summary>
   <div className="catalog-filters"><label>Library <select aria-label="Equipment family" value={family} onChange={e=>setFamily(e.target.value as 'all'|'generic'|'manufacturer')}><option value="all">All models</option><option value="generic">Generic training</option><option value="manufacturer">Manufacturer profiles</option></select></label><label>Manufacturer <select aria-label="Manufacturer" value={maker} onChange={e=>setMaker(e.target.value)}><option value="all">All manufacturers</option>{MANUFACTURERS.map(name=><option value={name} key={name}>{name}</option>)}</select></label><small>Manufacturer models are documented references, not real firmware or product endorsements. GHS prices require your own quotations.</small></div>
   <div className="vendor-browser"><label>Manufacturer specification sheet<select aria-label="Browse documented manufacturer models" value={inspectedId} onChange={e=>setInspectedId(e.target.value)}><option value="">Select a device model to inspect…</option>{PROFILES.filter(p=>p.manufacturerSpec).map(p=><option key={p.id} value={p.id}>{p.manufacturer} · {p.model}</option>)}</select></label>{inspected?.manufacturerSpec&&<section className="vendor-detail" aria-label="Documented virtual device specification"><strong>{inspected.name}</strong><small>{inspected.manufacturerSpec.variant} · Profile {inspected.manufacturerSpec.edition} · {inspected.manufacturerSpec.status==='reference-only'?'REFERENCE ONLY — NOT PLACEABLE':'VIRTUAL SIMULATION PROFILE'}</small><ul>{inspected.manufacturerSpec.sourcedFacts.map((fact,i)=><li key={i}>{fact}</li>)}</ul><p><b>SecurityLab limitations:</b> {inspected.manufacturerSpec.limitations.join(' · ')}</p><a href={inspected.manufacturerSpec.sourceUrl} target="_blank" rel="noopener noreferrer">Open official reference documentation</a></section>}</div>
  </details>
  <EquipmentCompare w={w}/>
  <div className="catalog-scroll">
   {CATEGORIES.map(cat=>{
    const list=items(cat.kinds),isOpen=q?list.length>0:!!open[cat.id];
    return <section key={cat.id} className={`cat ${isOpen?'open':''}`}>
     <button className="cat-head" aria-expanded={isOpen} onClick={()=>setOpen(o=>({...o,[cat.id]:!o[cat.id]}))}><Icon name={cat.icon} size={18}/><span>{cat.title} ({list.length})</span><Icon name="chevron" size={16}/></button>
     {isOpen&&<div className="cat-items">{list.length===0&&<p className="muted tiny">No matching equipment.</p>}{list.map(p=><button key={p.id} draggable={!w.blocked&&p.manufacturerSpec?.status!=='reference-only'}
      onDragStart={e=>{if(p.manufacturerSpec?.status==='reference-only'){e.preventDefault();return;}e.dataTransfer.setData('application/x-securitylab-profile',p.id);}}
      onClick={()=>choose(p)} className={`equipment ${w.placing===p.id?'chosen':''}`} disabled={w.blocked} title={`${p.name} — ${p.manufacturerSpec?'quotation needed':`training estimate ₵${p.costGhs}`}`}>
      <span className={`equipment-icon ${p.kind}`}><Icon name={kindIcon(p.kind)} size={22}/></span>
      <span className="equipment-content"><strong>{p.name}</strong><small>{specLine(p)}</small></span>
      <span className="grip" aria-hidden="true">{'⋮⋮'}</span>
     </button>)}</div>}
    </section>;
   })}
   {rigs.length>0&&<section className={`cat ${open.rigs?'open':''}`}><button className="cat-head" aria-expanded={!!open.rigs} onClick={()=>setOpen(o=>({...o,rigs:!o.rigs}))}><Icon name="scenarios" size={18}/><span>Practice rigs ({rigs.length})</span><Icon name="chevron" size={16}/></button>
    {open.rigs&&<div className="cat-items">{rigs.map(r=><button key={r.id} className="alarm-practice" onClick={r.run} disabled={w.blocked||r.done}>{r.label}</button>)}
     <p className="muted tiny">Starter circuits with physical wiring. Configure, test and investigate faults in the matching dock tab. Electrical supplies use dedicated AC/DC/PV wires.</p></div>}</section>}
  </div>
 </aside>;
}
