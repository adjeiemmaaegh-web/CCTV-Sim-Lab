import React,{useState} from 'react';
import {profile} from '../../../src/domain/catalog.js';
import {accessClock,clockText} from '../../../src/engine/access.js';
import type {AccessIdentity,AccessMethod} from '../../../src/domain/types.js';
import type {Workbench} from '../hooks/useWorkbench.js';
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const number=(s:string,min:number,max:number)=>{const n=Number(s);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):min;};
export function AccessConsole({w}:{w:Workbench}){
 const [selected,setSelected]=useState(''),[readerId,setReaderId]=useState(''),[token,setToken]=useState('CARD-1001');
 const [newName,setNewName]=useState('Visitor A'),[card,setCard]=useState('CARD-2002'),[pin,setPin]=useState('1357'),[biometric,setBiometric]=useState('BIO-DEMO-2002');
 const [fault,setFault]=useState<'wire'|'reader'|'lock'|'battery'|'power'>('wire'),[exitId,setExitId]=useState('');
 const controllers=w.project.devices.filter(d=>profile(d.profileId).kind==='access-controller');
 const controller=controllers.find(d=>d.id===selected)||controllers[0],state=controller?w.result.access?.controllers[controller.id]:undefined;
 const readers=(state?.connectedReaderIds||[]).map(id=>w.project.devices.find(d=>d.id===id)).filter((d):d is NonNullable<typeof d>=>!!d);
 const current=readers.find(d=>d.id===readerId)||readers[0];
 const method:AccessMethod=current?.accessReader?.method||'card';
 const identities=w.project.accessIdentities||[];
 const updateGrant=(identity:AccessIdentity,key:'startMinute'|'endMinute'|'days',value:number|number[])=>{
  if(!controller)return;const prev=identity.grants.find(g=>g.controllerId===controller.id)||{controllerId:controller.id,days:[0,1,2,3,4,5,6],startMinute:480,endMinute:1080};
  const updated={...prev,[key]:value},others=identity.grants.filter(g=>g.controllerId!==controller.id);
  w.updateIdentity(identity.id,{grants:[...others,updated]});
 };
 return <section className="access-console">
  <div className="alarm-console-heading"><strong>ACCESS CONTROL · SINGLE-DOOR ENGINEERING</strong><button disabled={w.blocked||controllers.length>0} onClick={w.loadAccessRig}>Install practice access rig</button></div>
  {!controller?<p className="editor-muted">Create a practice rig or place a controller, reader, electronic lock and exit button. Add a real floor-plan door opening and wire accessories with the Cable tool.</p>:<>
   <div className="alarm-command-row"><label>Controller <select value={controller.id} aria-label="Access controller" onChange={e=>{setSelected(e.target.value);setReaderId('');}}>{controllers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <span>Clock: <strong>{clockText(w.project)}</strong></span><span>Power: <strong>{state?.powered?(state.usingBattery?'BATTERY':'AC'):'OFFLINE'}</strong></span>
    <span>Relay: <strong>{state?.door?.locked?'LOCKED':'UNLOCKED'}</strong></span><span>Contact: <strong>{state?.door?.open?'OPEN':'CLOSED'}</strong></span>
    <span className={state?.door?.alarm?'warning-line':'good'}>{state?.door?.alarm?'ACCESS ALARM':'No active door alarm'}</span>
   </div>
   <div className="alarm-command-row"><label>Reader <select aria-label="Access input reader" value={current?.id||''} onChange={e=>setReaderId(e.target.value)}><option value="">Select reader</option>{readers.map(d=><option key={d.id} value={d.id}>{d.name} · {d.accessReader?.method||'card'}</option>)}</select></label>
    <label>{method.toUpperCase()} training token <input aria-label="Synthetic access token" value={token} maxLength={64} onChange={e=>setToken(e.target.value)} autoComplete="off"/></label>
    <button disabled={w.blocked||!current} className="primary" onClick={()=>current&&w.accessPresent(controller.id,current.id,method,token)}>Present synthetic credential</button>
    <label>Exit input <select aria-label="Exit button" value={state?.exitIds.includes(exitId)?exitId:state?.exitIds[0]||''} onChange={e=>setExitId(e.target.value)}><option value="">Choose REX</option>{(state?.exitIds||[]).map(id=><option key={id} value={id}>{w.project.devices.find(d=>d.id===id)?.name||id}</option>)}</select></label>
    <button disabled={w.blocked||!state?.exitIds.length} onClick={()=>state?.exitIds.length&&w.accessExit(controller.id,state.exitIds.includes(exitId)?exitId:state.exitIds[0])}>Request Exit</button>
   </div>
   <div className="alarm-command-row"><strong>DOOR CONTACT</strong><button disabled={w.blocked||!state?.door} onClick={()=>w.accessDoor(controller.id,true)}>Open door</button><button disabled={w.blocked||!state?.door} onClick={()=>w.accessDoor(controller.id,false)}>Close door</button><button disabled={w.blocked||!state?.door} onClick={()=>w.accessAcknowledge(controller.id)}>Acknowledge alarm</button>
    <span>Unlock countdown: {state?.door?.unlockSeconds??0}s</span><span>Held open: {state?.door?.heldOpenSeconds??0}s</span></div>
   <div className="alarm-command-row"><strong>VIRTUAL CLOCK</strong>{[1,5,15,30,60,300].map(sec=><button key={sec} disabled={w.blocked} onClick={()=>w.accessTime(sec)}>+{sec}s</button>)}<small>Door relock, held-open monitoring and battery usage advance on explicit clock steps.</small></div>
   <div className="alarm-command-row"><strong>FAULT INJECTION</strong><select aria-label="Access fault type" value={fault} onChange={e=>setFault(e.target.value as typeof fault)}><option value="wire">Disconnect access wire</option><option value="reader">Disable reader</option><option value="lock">Jam lock</option><option value="battery">Deplete battery</option><option value="power">Cut AC supply</option></select><button disabled={w.blocked} onClick={()=>w.accessFault(fault)}>Inject access fault</button></div>
   <div className="alarm-zone-grid"><div className="alarm-zone-tile"><strong>CONTROLLER</strong><span>{state?.powered?'Powered':'Unpowered'}</span><small>{state?.powerUsedW.toFixed(1)} / {state?.powerBudgetW.toFixed(1)} W</small></div><div className="alarm-zone-tile"><strong>READERS</strong><span>{readers.length} wired</span><small>Card / PIN / virtual biometric</small></div><div className="alarm-zone-tile"><strong>LOCK</strong><span>{state?.lockIds.length||0} connected</span><small>{state?.door?.locked?'Secure (simulated)':'Released (simulated)'}</small></div><div className="alarm-zone-tile"><strong>DOOR STATE</strong><span>{state?.door?.open?'Open':'Closed'}</span><small>{state?.door?.faults.join('; ')||'No door faults'}</small></div></div>
   <h3>Synthetic credential and permission editor</h3>
   <div className="alarm-command-row"><label>Name <input value={newName} maxLength={80} onChange={e=>setNewName(e.target.value)}/></label><label>Card code <input value={card} maxLength={64} onChange={e=>setCard(e.target.value)}/></label><label>PIN token <input value={pin} maxLength={64} onChange={e=>setPin(e.target.value)}/></label><label>Biometric demo ID <input value={biometric} maxLength={64} onChange={e=>setBiometric(e.target.value)}/></label><button disabled={w.blocked||identities.length>=100} onClick={()=>w.addIdentity(newName,card,pin,biometric,controller.id)}>Add synthetic identity</button></div>
   <div className="access-credential-list">{identities.map(i=>{const grant=i.grants.find(g=>g.controllerId===controller.id);return <div key={i.id} className="access-identity"><div className="alarm-command-row"><strong>{i.name}</strong><label>Active <input type="checkbox" disabled={w.blocked} checked={i.enabled} onChange={e=>w.updateIdentity(i.id,{enabled:e.target.checked})}/></label><label>Allow this controller <input type="checkbox" disabled={w.blocked} checked={!!grant} onChange={e=>w.updateIdentity(i.id,{grants:e.target.checked?[...i.grants,{controllerId:controller.id,days:[0,1,2,3,4,5,6],startMinute:480,endMinute:1080}]:i.grants.filter(g=>g.controllerId!==controller.id)})}/></label><button disabled={w.blocked} onClick={()=>w.removeIdentity(i.id)}>Delete</button></div>
    <div className="editor-muted">Card: {i.cardToken||'—'} · PIN: {i.pinToken||'—'} · Biometric token: {i.biometricToken||'—'} (synthetic only)</div>
    {grant&&<div className="alarm-command-row"><label>From minute <input type="number" min={0} max={1439} disabled={w.blocked} value={grant.startMinute} onChange={e=>updateGrant(i,'startMinute',number(e.target.value,0,1439))}/></label><label>Until minute <input type="number" min={0} max={1440} disabled={w.blocked} value={grant.endMinute} onChange={e=>updateGrant(i,'endMinute',number(e.target.value,0,1440))}/></label>{days.map((d,n)=><label key={d}>{d} <input type="checkbox" disabled={w.blocked} checked={grant.days.includes(n)} onChange={e=>updateGrant(i,'days',e.target.checked?[...grant.days,n].sort() :grant.days.filter(v=>v!==n))}/></label>)}</div>}
   </div>})}</div>
   {(state?.faults||[]).map((x,i)=><p className="warning-line" key={i}>⚠ {x}</p>)}
  </>}
  <h3>Access event journal</h3><div className="alarm-log">{(w.project.accessLog||[]).slice(-25).reverse().map(e=><p key={e.id} className={e.decision==='denied'||e.decision==='alarm'?'warning-line':e.decision==='granted'?'good':''}><span className="muted">[{days[e.clock.day]} {String(Math.floor(e.clock.minute/60)).padStart(2,'0')}:{String(e.clock.minute%60).padStart(2,'0')}:{String(e.clock.second).padStart(2,'0')}]</span> {e.decision.toUpperCase()} · {e.reason}</p>)}</div>
  <p className="editor-muted">Classroom simulation only. No real credentials, fingerprints, cards, controller firmware, fire-alarm integration or legal compliance certification. The event log is editable project data, not tamper-proof forensic evidence.</p>
 </section>;
}
