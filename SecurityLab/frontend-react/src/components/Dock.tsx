import React,{useEffect,useRef,useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {Icon} from './icons.js';
import {profile} from '../../../src/domain/catalog.js';
import {clockLabel} from '../../../src/engine/cctv.js';
import {SystemHealth} from './SystemHealth.js';

type Tab=Workbench['tab'];
/** Primary dock tabs (as in the design) and the overflow menu. `console` opens the Network CLI tool. */
const PRIMARY:{id:string;label:string;icon:string;tab:Tab;tool?:string}[]=[
 {id:'realtime',label:'Realtime',icon:'realtime',tab:'systems'},
 {id:'events',label:'Events',icon:'events',tab:'events'},
 {id:'diagnostics',label:'Diagnostics',icon:'diagnostics',tab:'diagnostics'},
 {id:'power',label:'Power',icon:'power',tab:'power'},
 {id:'access',label:'Access',icon:'access',tab:'access'},
 {id:'console',label:'Console',icon:'console',tab:'tools',tool:'cli'},
 {id:'tools',label:'Tools',icon:'tools',tab:'tools'},
];
const MORE:{label:string;tab:Tab}[]=[
 {label:'Network',tab:'network'},{label:'Recordings',tab:'recordings'},{label:'Alarm',tab:'alarm'},{label:'Scenario',tab:'scenario'},{label:'Assessment',tab:'assessment'},{label:'Field-review',tab:'field-review'},
];

export function DockTabs({w}:{w:Workbench}){
 const [more,setMore]=useState(false);const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!more)return;const close=(e:MouseEvent)=>{if(!ref.current?.contains(e.target as Node))setMore(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setMore(false);};
  document.addEventListener('mousedown',close);document.addEventListener('keydown',key);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',key);};},[more]);
 const events=w.project.events.length;
 const isActive=(t:typeof PRIMARY[number])=>t.tab===w.tab&&(t.id==='console'?w.toolId==='cli':t.id==='tools'?w.toolId!=='cli':true);
 const inMore=MORE.some(m=>m.tab===w.tab);
 return <div className="dock-tabs" role="tablist" aria-label="Simulation console">
  {PRIMARY.map(t=><button key={t.id} role="tab" aria-selected={isActive(t)} className={isActive(t)?'active':''} onClick={()=>{if(t.tool)w.setToolId(t.tool);else if(t.id==='tools'&&w.toolId==='cli')w.setToolId('trace');w.setTab(t.tab);}}>
   <Icon name={t.icon} size={18}/><span>{t.label}{t.id==='events'?` (${events})`:''}</span></button>)}
  <div className="dock-more" ref={ref}>
   <button role="tab" aria-selected={inMore} aria-haspopup="menu" aria-expanded={more} className={inMore?'active':''} onClick={()=>setMore(m=>!m)}><Icon name="more" size={18}/><span>{inMore?MORE.find(m=>m.tab===w.tab)!.label:'More'}</span></button>
   {more&&<div className="menu dock-menu" role="menu">{MORE.map(m=><button key={m.tab} role="menuitem" onClick={()=>{w.setTab(m.tab);setMore(false);}}>{m.label}</button>)}</div>}
  </div>
 </div>;
}

/** Realtime dashboard: every figure is read from the live simulation result. */
export function RealtimePanel({w}:{w:Workbench}){
 const r=w.result;
 const cameras=w.project.devices.filter(d=>profile(d.profileId).kind==='camera').length;
 const netIssues=r.network?.diagnostics.length??0;
 const alarmsActive=Object.values(r.alarm?.panels||{}).filter(p=>p.phase==='triggered').length;
 const accessEvents=(w.project.accessLog||[]).length;
 const load=r.power?.totalLoadW??0;
 return <section className="realtime" aria-label="Realtime status">
  <div className="rt-run">
   <button className={`run-btn ${w.running?'on':''}`} onClick={w.toggleRun} disabled={w.blocked} aria-pressed={w.running} aria-label={w.running?'Pause simulation clock':'Run simulation clock'} title={w.running?'Pause the virtual clock':'Run the virtual clock: one virtual minute per second for up to 60 minutes'}><Icon name={w.running?'pause':'play'} size={30}/></button>
   <div><strong className={w.running?'good':''}>Simulation: {w.running?`Running (${60-w.runLeft}/60 min)`:'Paused'}</strong><small>Time: {clockLabel(w.project)}</small></div>
  </div>
  <div className="rt-cards">
   <article className="stat"><Icon name="camera" size={34}/><div><strong>Cameras</strong><span>{r.recordingCameras} / {cameras} Recording</span></div></article>
   <article className="stat"><Icon name="network" size={34}/><div><strong>Network</strong><span className={netIssues?'warning-line':'good'}>{netIssues?`${netIssues} issue${netIssues>1?'s':''}`:'Online'}</span></div></article>
   <article className="stat"><Icon name="power" size={34}/><div><strong>Power</strong><span>{load.toFixed(load<10?1:0)} W</span></div></article>
   <article className="stat"><Icon name="shield" size={34}/><div><strong>Alarms</strong><span className={alarmsActive?'warning-line':''}>{alarmsActive} Active</span></div></article>
   <article className="stat"><Icon name="access" size={34}/><div><strong>Access</strong><span>{accessEvents} Events</span></div></article>
  </div>
  <details className="rt-details"><summary>System health details</summary><SystemHealth w={w}/></details>
 </section>;
}
