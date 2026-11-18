import {ACTIVITIES} from '../workspace/activities.js';
import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {Icon} from './icons.js';

export type Panel='settings'|'help'|null;
/** Left rail. Each section focuses the matching console tab (and canvas view) of the existing workstation. */
export function NavRail({w,openPanel,onView,onRevealPanels}:{w:Workbench;openPanel:(p:Panel)=>void;onView:(v:'floor'|'topology')=>void;onRevealPanels:()=>void}){
 return <nav className="nav-rail" aria-label="Primary activities">
  {ACTIVITIES.map(i=><button key={i.id} className={w.activity===i.id?'active':''} aria-current={w.activity===i.id?'page':undefined} onClick={()=>{onRevealPanels();w.setPlacing(null);w.setCableStart(null);w.setMode('select');w.setTab(i.tab);w.setActivity(i.id);onView(i.view);}}>
   <Icon name={i.icon} size={22}/><span>{i.label}</span></button>)}
  <span className="nav-spacer"/>
  <button onClick={()=>openPanel('settings')}><Icon name="settings" size={22}/><span>Settings</span></button>
  <button onClick={()=>openPanel('help')}><Icon name="help" size={22}/><span>Help</span></button>
 </nav>;
}
