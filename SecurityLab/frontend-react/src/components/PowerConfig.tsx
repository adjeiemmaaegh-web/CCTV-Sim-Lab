import {SafeNumber} from './SafeNumber.js';
import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {Device,PowerConfig} from '../../../src/domain/types.js';
import {configOf} from '../../../src/engine/power.js';
import {profile} from '../../../src/domain/catalog.js';

export function PowerConfigPanel({w,device}:{w:Workbench;device:Device}){
 const config=configOf(device),spec=profile(device.profileId),live=w.result.power?.devices[device.id];
 const update=<K extends keyof PowerConfig>(key:K,value:PowerConfig[K])=>{
  const next={...config,[key]:value};
  if(key==='capacityWh')next.chargeWh=Math.min(next.chargeWh,next.capacityWh);
  if(key==='chargeWh')next.chargeWh=Math.min(Math.max(0,next.chargeWh),next.capacityWh);
  w.update(device.id,{powerConfig:next});
 };
 const numeric=(key:keyof Pick<PowerConfig,'ratedW'|'capacityWh'|'chargeWh'|'efficiency'|'chargeLimitW'|'dischargeLimitW'>,label:string,min:number,max:number,step=1)=><label className="prop-field" key={key}>
  <span>{label}</span><SafeNumber label={label} min={min} max={max} step={step} disabled={w.blocked} value={config[key]} onApply={n=>update(key,n)}/>
 </label>;
 return <div className="power-config"><div className="section-heading">STAGE 8 • ELECTRICAL DEVICE MODEL</div>
  <p className="editor-muted">{spec.model} · {spec.powerInputType?.toUpperCase()||'NONE'} {spec.powerInputV||0} V input → {spec.powerOutputType?.toUpperCase()||'NONE'} {spec.powerOutputV||0} V output. All terminals are simulated.</p>
  <div className="fields">
   {numeric('ratedW','Rated output (W)',0,10000)}
   {config.capacityWh>0&&<>{numeric('capacityWh','Storage capacity (Wh)',0,100000)}{numeric('chargeWh','Stored energy (Wh)',0,config.capacityWh,0.1)}</>}
   {numeric('efficiency','Conversion efficiency (0.50–1.00)',0.5,1,0.01)}
   {config.capacityWh>0&&<>{numeric('chargeLimitW','Charging limit (W)',0,5000)}{numeric('dischargeLimitW','Discharge limit (W)',0,10000)}</>}
   <label className="prop-field"><span>Injected component fault</span><select disabled={w.blocked} value={config.fault} onChange={e=>update('fault',e.target.value as PowerConfig['fault'])}>
    <option value="none">None</option><option value="tripped">Breaker tripped</option><option value="failed">Component failed</option><option value="low-battery">Low-battery service fault</option>
   </select></label>
  </div>
  <div className="section-heading">LIVE ELECTRICAL STATE</div><div className="health">
   <div><span>Active output</span><strong className={live?.powered?'good':'warn'}>{live?.powered?'ENERGIZED':'OFF'}</strong></div>
   <div><span>Load (W)</span><strong>{(live?.outputW||0).toFixed(1)}</strong></div>
   <div><span>Headroom (W)</span><strong>{(live?.availableW||0).toFixed(1)}</strong></div>
   <div><span>Energy (Wh)</span><strong>{(live?.chargeWh||0).toFixed(1)} / {(live?.capacityWh||0).toFixed(0)}</strong></div>
   {live?.source&&<div><span>Power source</span><strong>{live.source}</strong></div>}
   {(live?.faults||[]).map(f=><div className="warning-line" key={f}>⚠ {f}</div>)}
  </div>
  <p className="editor-muted">Training approximation only: voltage compatibility, rated watts, cable current and finite Wh are modelled. Earthing, shock risk, fuses, AC waveforms, battery chemistry, panel thermal protection and real IEC/NEC compliance are not certified or simulated.</p>
 </div>;
}
