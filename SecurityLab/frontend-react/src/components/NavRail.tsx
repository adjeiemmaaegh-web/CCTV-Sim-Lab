import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {Icon} from './icons.js';

export type Panel='settings'|'help'|null;
/** Left rail. Each section focuses the matching console tab (and canvas view) of the existing workstation. */
const ITEMS:{id:string;label:string;icon:string;tab:Workbench['tab']}[]=[
 {id:'equipment',label:'Equipment',icon:'equipment',tab:'systems'},
 {id:'network',label:'Network',icon:'network',tab:'network'},
 {id:'alarms',label:'Alarms',icon:'alarm',tab:'alarm'},
 {id:'access',label:'Access',icon:'access',tab:'access'},
 {id:'power',label:'Power',icon:'power',tab:'power'},
 {id:'scenarios',label:'Scenarios',icon:'scenarios',tab:'scenario'},
 {id:'assessment',label:'Assessment',icon:'assessment',tab:'assessment'},
];
export function NavRail({w,openPanel,onView}:{w:Workbench;openPanel:(p:Panel)=>void;onView:(v:'floor'|'topology')=>void}){
 return <nav className="nav-rail" aria-label="Sections">
  {ITEMS.map(i=><button key={i.id} className={w.tab===i.tab?'active':''} aria-current={w.tab===i.tab?'page':undefined} onClick={()=>{w.setTab(i.tab);onView(i.id==='network'?'topology':'floor');}}>
   <Icon name={i.icon} size={22}/><span>{i.label}</span></button>)}
  <span className="nav-spacer"/>
  <button onClick={()=>openPanel('settings')}><Icon name="settings" size={22}/><span>Settings</span></button>
  <button onClick={()=>openPanel('help')}><Icon name="help" size={22}/><span>Help</span></button>
 </nav>;
}
