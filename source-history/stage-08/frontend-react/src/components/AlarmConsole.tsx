import React,{useState} from 'react';
import {ALARM_STIMULI} from '../../../src/engine/alarm.js';
import type {AlarmStimulus} from '../../../src/engine/alarm.js';
import {profile} from '../../../src/domain/catalog.js';
import type {Workbench} from '../hooks/useWorkbench.js';

export function AlarmConsole({w}:{w:Workbench}){
 const [selected,setSelected]=useState(''),[pin,setPin]=useState('1234'),[stimulus,setStimulus]=useState<AlarmStimulus>('motion');
 const [point,setPoint]=useState({x:360,y:265}),[intensity,setIntensity]=useState(90),[fault,setFault]=useState<'open'|'short'|'tamper'|'battery'|'mains'|'zone'|'wire'>('wire');
 const panels=w.project.devices.filter(d=>profile(d.profileId).kind==='alarm-panel');
 const panel=panels.find(d=>d.id===selected)||panels[0];
 const status=panel?w.result.alarm?.panels[panel.id]:undefined;
 const useDevicePosition=()=>{
  const d=w.selected?.kind==='device'?w.project.devices.find(x=>x.id===w.selected?.id):undefined;
  if(d)setPoint({x:d.x,y:d.y});else w.setNotice('Select a detector on the floor plan first');
 };
 return <section className="alarm-console">
  <div className="alarm-console-heading"><strong>WIRED INTRUSION ALARM WORKSTATION</strong><button disabled={w.blocked||panels.length>0} onClick={w.loadAlarmRig}>Install practice rig</button></div>
  {!panel?<p className="editor-muted">Install the optional practice rig, or place an alarm panel, detectors, a keypad and outputs independently and connect each accessory with purple alarm cable.</p>:<>
   <div className="alarm-command-row"><label>Panel <select aria-label="Alarm panel" value={panel.id} onChange={e=>setSelected(e.target.value)}>{panels.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
    <label>Virtual PIN <input aria-label="Virtual alarm keypad PIN" type="password" autoComplete="off" maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))}/></label>
    {(['stay','away','disarm','silence'] as const).map(action=><button disabled={w.blocked} key={action} onClick={()=>w.alarmCommand(panel.id,action,pin)}>{action.toUpperCase()}</button>)}
   </div>
   <div className="alarm-telemetry"><span>MODE <b>{status?.mode.toUpperCase()}</b></span><span>STATE <b>{status?.phase.toUpperCase()}</b></span><span>DELAY <b>{status?.remainingSeconds||0}s</b></span><span>SUPPLY <b>{status?.usingBattery?'BATTERY':status?.acOn?'AC':'OFF'}</b></span><span>ALERT OUTPUTS <b>{status?.activeOutputs.length||0}</b></span><span>BATTERY <b>{status?.batteryWh.toFixed(1)||'0'} Wh</b></span></div>
   <div className="alarm-command-row"><strong>VIRTUAL CLOCK</strong>{[5,15,30,60,300].map(seconds=><button key={seconds} disabled={w.blocked} onClick={()=>w.alarmTime(seconds)}>+{seconds}s</button>)}<small>Exit, entry and siren timers advance only when you press a clock control.</small></div>
   <div className="alarm-command-row"><label>Intrusion stimulus <select aria-label="Alarm intrusion type" value={stimulus} onChange={e=>setStimulus(e.target.value as AlarmStimulus)}>{ALARM_STIMULI.map(s=><option key={s.type} value={s.type}>{s.label}</option>)}</select></label>
    <label>X <input aria-label="Intrusion X" type="number" min="0" max="1000" value={point.x} onChange={e=>setPoint(p=>({...p,x:Math.max(0,Math.min(1000,Number(e.target.value)||0))}))}/></label>
    <label>Y <input aria-label="Intrusion Y" type="number" min="0" max="650" value={point.y} onChange={e=>setPoint(p=>({...p,y:Math.max(0,Math.min(650,Number(e.target.value)||0))}))}/></label>
    <label>Intensity <input aria-label="Intrusion intensity" type="number" min="0" max="100" value={intensity} onChange={e=>setIntensity(Math.max(0,Math.min(100,Number(e.target.value)||0)))}/></label>
    <button onClick={useDevicePosition}>Use selected sensor</button><button disabled={w.blocked} className="primary" onClick={()=>w.alarmStimulus(stimulus,point,intensity)}>Trigger stimulus</button>
   </div>
   <div className="alarm-command-row"><strong>INJECT / REPAIR A FAULT</strong><select aria-label="Alarm fault type" value={fault} onChange={e=>setFault(e.target.value as typeof fault)}><option value="wire">Broken circuit</option><option value="open">Open contact</option><option value="short">Short circuit</option><option value="tamper">Tamper switch</option><option value="battery">Failed battery</option><option value="mains">AC mains failure</option><option value="zone">Incorrect zone</option></select><button disabled={w.blocked} onClick={()=>w.alarmFault(fault)}>Inject fault</button><small>Repair through the device inspector, reconnect cable or restore power.</small></div>
   <div className="alarm-zone-grid">{status?.zones.map(z=><div key={z.number} className={`alarm-zone-tile ${z.faults.length?'failed':z.triggered?'triggered':z.armed?'armed':''}`}><strong>Z{z.number} · {z.name}</strong><span>{z.type} / {z.devices.length} detector(s)</span><small>{z.triggered?'ALARM':z.faults.length?z.faults.join('; '):z.armed?'MONITORING':'STANDBY'}</small></div>)}</div>
   {(status?.faults||[]).map((f,i)=><p key={i} className="warning-line">⚠ {f}</p>)}
  </>}
  <div className="alarm-log">{w.project.events.filter(e=>e.id.startsWith('alarm-')).slice(-12).reverse().map(e=><p key={e.id} className={e.kind==='fault'?'warning-line':''}><span className="muted">[{e.at.slice(11,19)}]</span> {e.message}</p>)}</div>
  <p className="editor-muted">All detectors and relay outputs are simulated locally. No real emergency dispatch, authentication, central monitoring, or manufacturer certification is implied.</p>
 </section>;
}
