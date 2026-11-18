import {SafeNumber} from './SafeNumber.js';
import React from 'react';
import type {Device,AlarmPanelConfig,AlarmZone,AlarmDeviceState} from '../../../src/domain/types.js';
import {profile} from '../../../src/domain/catalog.js';
import {panelConfig} from '../../../src/engine/alarm.js';
import type {Workbench} from '../hooks/useWorkbench.js';

const num=(s:string,min:number,max:number,fallback:number):number=>{
 const n=Number(s);return s.trim()!==''&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;
};
const DEFAULT_SENSOR:AlarmDeviceState={zone:1,normallyClosed:true,fault:'none',bypassed:false,sensitivity:50};
export function AlarmConfig({w,device}:{w:Workbench;device:Device}){
 const spec=profile(device.profileId),health=w.result.alarm?.devices[device.id];
 if(spec.kind==='alarm-panel'){
  const c=panelConfig(device),status=w.result.alarm?.panels[device.id];
  const edit=(change:Partial<AlarmPanelConfig>)=>{const next={...c,...change};next.batteryChargeWh=Math.min(next.batteryChargeWh,next.batteryCapacityWh);w.update(device.id,{alarmPanel:next});};
  const changeZone=(n:number,patch:Partial<AlarmZone>)=>edit({zones:c.zones.map(z=>z.number===n?{...z,...patch,number:n}:z)});
  const numberField=(key:'entryDelaySec'|'exitDelaySec'|'sirenDurationSec'|'batteryCapacityWh'|'batteryChargeWh',label:string,min:number,max:number)=>
   <label className="prop-field" key={key}><span>{label}</span><SafeNumber label={label} disabled={w.blocked} min={min} max={max} value={c[key]} onApply={n=>edit({[key]:Math.round(n)})}/></label>;
  return <section className="alarm-config">
   <div className="section-heading">ALARM PANEL / POWER</div><p className="editor-muted">Training model only. No real security code or panel firmware.</p>
   <div className="fields"><label className="prop-field"><span>Training PIN</span><button disabled={w.blocked} type="button" onClick={async()=>{const pin=await w.ask('New 4–8 digit virtual PIN',c.pin);if(pin!==null){if(/^\d{4,8}$/.test(pin))edit({pin});else w.setNotice('Training PIN must be 4–8 digits');}}}>Change virtual PIN</button></label>
    {numberField('entryDelaySec','Entry delay (s)',0,180)}
    {numberField('exitDelaySec','Exit delay (s)',0,180)}
    {numberField('sirenDurationSec','Siren duration (s)',1,900)}
    {numberField('batteryCapacityWh','Battery capacity (Wh)',0,1000)}
    {numberField('batteryChargeWh','Battery remaining (Wh)',0,c.batteryCapacityWh)}
    <label className="checkfield"><span>Backup battery installed</span><input type="checkbox" disabled={w.blocked} checked={c.batteryEnabled} onChange={e=>edit({batteryEnabled:e.target.checked})}/></label>
    <label className="checkfield"><span>Panel tamper circuit</span><input type="checkbox" disabled={w.blocked} checked={c.tamper} onChange={e=>edit({tamper:e.target.checked})}/></label>
   </div>
   {status&&<div className="alarm-panel-status"><strong>{status.mode.toUpperCase()} · {status.phase.toUpperCase()}</strong><span>{status.powered?'POWERED':'NO POWER'} · {status.usingBattery?'BATTERY':'AC'} · {status.batteryWh.toFixed(1)} Wh</span><span>{status.activeOutputs.length} active siren/strobe outputs</span></div>}
   <div className="section-heading">ZONE CONFIGURATION</div>
   <div className="alarm-zone-table">{c.zones.map(zone=>{
     const z=status?.zones.find(x=>x.number===zone.number);
     return <div className="alarm-zone-row" key={zone.number}>
      <strong>Z{zone.number}</strong>
      <input aria-label={`Zone ${zone.number} name`} disabled={w.blocked} maxLength={80} value={zone.name} onChange={e=>changeZone(zone.number,{name:e.target.value})}/>
      <select aria-label={`Zone ${zone.number} type`} disabled={w.blocked} value={zone.type} onChange={e=>changeZone(zone.number,{type:e.currentTarget.value as AlarmZone['type']})}><option value="instant">Instant</option><option value="entry">Entry delay</option><option value="interior">Interior (stay bypass)</option><option value="24h">24-hour panic</option></select>
      <select aria-label={`Zone ${zone.number} contact polarity`} disabled={w.blocked} value={zone.contact||'nc'} onChange={e=>changeZone(zone.number,{contact:e.currentTarget.value as 'nc'|'no'})}><option value="nc">NC input</option><option value="no">NO input</option></select>
      <label><input aria-label={`Enable zone ${zone.number}`} type="checkbox" disabled={w.blocked} checked={zone.enabled} onChange={e=>changeZone(zone.number,{enabled:e.target.checked})}/> On</label>
      <label><input aria-label={`Bypass zone ${zone.number}`} type="checkbox" disabled={w.blocked} checked={zone.bypassed} onChange={e=>changeZone(zone.number,{bypassed:e.target.checked})}/> Bypass</label>
      <small className={z?.faults.length?'warn':'good'}>{z?.devices.length||0} inputs · {z?.faults.length?'FAULT':z?.armed?'ARMED':'IDLE'}</small>
     </div>;
    })}</div><p className="editor-muted">Default zones are demonstrations. Connect a virtual sensor to this panel, set its zone number, select the zone type, then use the Alarm Console to arm and simulate events.</p>
  </section>;
 }
 if(spec.kind==='alarm-sensor'){
  const s=device.alarmDevice??DEFAULT_SENSOR;
  const edit=(patch:Partial<AlarmDeviceState>)=>w.update(device.id,{alarmDevice:{...s,...patch}});
  return <section className="alarm-config"><div className="section-heading">DETECTOR / SUPERVISED CIRCUIT</div><div className="fields">
   <label className="prop-field"><span>Assigned panel zone</span><SafeNumber label="Assigned panel zone" min={1} max={32} disabled={w.blocked} value={s.zone} onApply={n=>edit({zone:Math.round(n)})}/></label>
   <label className="prop-field"><span>Detector sensitivity</span><SafeNumber label="Detector sensitivity" min={0} max={100} disabled={w.blocked} value={s.sensitivity} onApply={n=>edit({sensitivity:Math.round(n)})}/></label>
   <label className="prop-field"><span>Circuit convention</span><select disabled={w.blocked} value={s.normallyClosed?'nc':'no'} onChange={e=>edit({normallyClosed:e.target.value==='nc'})}><option value="nc">Normally closed (NC)</option><option value="no">Normally open (NO)</option></select></label>
   <label className="prop-field"><span>Injected circuit condition</span><select disabled={w.blocked} value={s.fault} onChange={e=>edit({fault:e.target.value as AlarmDeviceState['fault']})}><option value="none">Healthy</option><option value="open">Open circuit</option><option value="short">Short circuit</option><option value="tamper">Tamper contact</option></select></label>
   <label className="checkfield"><span>Bypass this detector</span><input type="checkbox" disabled={w.blocked} checked={s.bypassed} onChange={e=>edit({bypassed:e.target.checked})}/></label>
   {['pir','beam'].includes(spec.alarmSensorType||'')&&<><label className="prop-field"><span>Detector heading (°)</span><SafeNumber label="Detector heading (°)" min={0} max={360} disabled={w.blocked} value={device.heading} onApply={n=>w.update(device.id,{heading:n})}/></label><label className="prop-field"><span>Range (plan units)</span><SafeNumber label="Range (plan units)" min={5} max={1000} disabled={w.blocked} value={device.range} onApply={n=>w.update(device.id,{range:n})}/></label></>}
   </div><p className="editor-muted">{spec.alarmSensorType?.toUpperCase()} detects matching virtual events only while powered and connected to a functioning panel. NC/NO must match the configured panel zone input. End-of-line resistance and bus protocol details are approximated using explicit faults.</p>
   <p className={health?.faults.length?'warning-line':'good'}>{health?.wired?'Circuit linked':'No panel connection'} · {health?.powered?'Operating':'Not operating'} · {health?.faults.join('; ')||'No sensor faults'}</p>
  </section>;
 }
 return <section className="alarm-config"><div className="section-heading">{spec.kind==='alarm-output'?'ALARM ANNUNCIATOR':'ALARM KEYPAD'}</div><p className="editor-muted">Connect this accessory using the Cable tool to an alarm panel. It responds only when the connected panel is powered and configured correctly.</p><p className={health?.powered?'good':'warning-line'}>{health?.wired?'Linked to panel':'Not connected'} · {health?.powered?'Ready':'Inactive'}</p>{spec.kind==='alarm-output'&&<p className="editor-muted">Panel output supply is limited to two annunciators and a combined 24 W in this teaching model. Sirens and strobes activate during the latched alarm interval.</p>}</section>;
}
