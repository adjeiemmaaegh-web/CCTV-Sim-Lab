import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {Device,AccessControllerConfig,AccessReaderConfig,AccessLockConfig} from '../../../src/domain/types.js';
import {controllerConfig} from '../../../src/engine/access.js';
import {profile} from '../../../src/domain/catalog.js';
const number=(value:string,min:number,max:number)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;};
export function AccessConfig({w,device}:{w:Workbench;device:Device}){
 const kind=profile(device.profileId).kind;
 if(kind==='access-controller'){
  const c=controllerConfig(device),status=w.result.access?.controllers[device.id];
  const edit=(fields:Partial<AccessControllerConfig>)=>w.update(device.id,{accessController:{...c,...fields}});
  return <section className="access-config"><div className="section-heading">SINGLE-DOOR ACCESS CONTROLLER</div>
   <div className="fields">
    <label className="prop-field"><span>Physical door opening</span><select disabled={w.blocked} value={c.doorWallId} onChange={e=>edit({doorWallId:e.target.value})}><option value="">Select a door</option>{w.project.walls.filter(x=>x.kind==='door').map((wall,i)=><option value={wall.id} key={wall.id}>Door {i+1} · {wall.id.slice(0,8)}</option>)}</select></label>
    {([['unlockSeconds','Unlock pulse (seconds)',1,60],['heldOpenLimitSeconds','Door-held-open alarm (seconds)',1,600],['supplyCapacityW','Accessory output capacity (W)',1,250],['batteryCapacityWh','Battery capacity (Wh)',0,2000],['batteryChargeWh','Battery remaining (Wh)',0,2000]] as const).map(([key,title,lo,hi])=><label key={key} className="prop-field"><span>{title}</span><input type="number" disabled={w.blocked} min={lo} max={hi} value={c[key]} onChange={e=>{const n=number(e.target.value,lo,hi);edit(key==='batteryCapacityWh'?{batteryCapacityWh:n,batteryChargeWh:Math.min(n,c.batteryChargeWh)}:{[key]:key==='batteryChargeWh'?Math.min(n,c.batteryCapacityWh):n});}}/></label>)}
    <label className="checkfield"><span>Enable simulated battery backup</span><input type="checkbox" disabled={w.blocked} checked={c.batteryEnabled} onChange={e=>edit({batteryEnabled:e.target.checked})}/></label>
   </div><p className="editor-muted">A wired reader, electronic lock and door-wall assignment are required. Readers, locks and exit buttons use dedicated access-control cable; they do not become IP devices. Output load: {status?.powerUsedW.toFixed(1)||'0.0'} / {status?.powerBudgetW.toFixed(1)||'0.0'} W.</p>
   <p className={status?.faults.length?'warning-line':'good'}>{status?.faults.join('; ')||'Controller configuration ready for evaluation'}</p>
  </section>;
 }
 if(kind==='access-reader'){
  const config:AccessReaderConfig=device.accessReader||{method:profile(device.profileId).accessReaderMethod||'card',fault:'none'};
  const edit=(fields:Partial<AccessReaderConfig>)=>w.update(device.id,{accessReader:{...config,...fields}});
  return <section className="access-config"><div className="section-heading">SIMULATED ACCESS READER</div><div className="fields">
   <div className="prop-field"><span>Reader input method</span><strong>{config.method.toUpperCase()} · fixed model capability</strong></div>
   <label className="prop-field"><span>Reader condition</span><select disabled={w.blocked} value={config.fault} onChange={e=>edit({fault:e.target.value as AccessReaderConfig['fault']})}><option value="none">Ready</option><option value="offline">Reader offline</option><option value="tamper">Reader tampered</option></select></label>
  </div><p className="editor-muted">No RFID card is read, no fingerprint or face is collected, and no real biometric matching takes place. Only fictional training tokens are compared.</p></section>;
 }
 if(kind==='access-lock'){
  const config:AccessLockConfig=device.accessLock||{failMode:device.profileId==='access-maglock'?'fail-safe':'fail-secure',fault:'none'};
  const edit=(fields:Partial<AccessLockConfig>)=>w.update(device.id,{accessLock:{...config,...fields}});
  return <section className="access-config"><div className="section-heading">ELECTRONIC LOCK BEHAVIOUR</div><div className="fields">
   <label className="prop-field"><span>Power-loss position</span><select disabled={w.blocked} value={config.failMode} onChange={e=>edit({failMode:e.target.value as AccessLockConfig['failMode']})}><option value="fail-safe">Fail-safe: unlock on power loss</option><option value="fail-secure">Fail-secure: remain locked on power loss</option></select></label>
   <label className="prop-field"><span>Injected lock fault</span><select disabled={w.blocked} value={config.fault} onChange={e=>edit({fault:e.target.value as AccessLockConfig['fault']})}><option value="none">Normal operation</option><option value="stuck-locked">Stuck locked</option><option value="stuck-open">Stuck unlocked</option></select></label>
  </div><p className="editor-muted">This is a simplified power/relay model, not a life-safety or building-code approval. Real emergency egress and fire interfaces need separate certified design.</p></section>;
 }
 return <section className="access-config"><div className="section-heading">{kind==='access-exit'?'REQUEST-TO-EXIT INPUT':'SYNTHETIC ACCESS EVENT SERVER'}</div><p className="editor-muted">{kind==='access-exit'?'Wire the exit input to a powered door controller. The Access Console can release that door through the simulated REX input.':'A local visualization device only. Access history is stored in project data and does not need external services or cloud connectivity.'}</p></section>;
}
