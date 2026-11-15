import React,{useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {PowerFault} from '../../../src/engine/power.js';
import {profile} from '../../../src/domain/catalog.js';

export function PowerConsole({w}:{w:Workbench}){
 const result=w.result.power;
 const [fault,setFault]=useState<PowerFault>('grid');
 const settings=w.project.powerSettings||{mode:'legacy' as const,solarPercent:70,virtualMinutes:0};
 const electrical=w.project.devices.filter(d=>profile(d.profileId).kind.startsWith('power-'));
 return <div className="power-lab">
  <div className="power-lab-tools">
   <strong>⚡ ELECTRICAL & BACKUP POWER LAB</strong>
   <label>Power calculation mode <select disabled={w.blocked} value={settings.mode} onChange={e=>w.setPowerSettings({mode:e.target.value as 'legacy'|'wired'})}>
    <option value="legacy">Legacy – implicit local mains for older projects</option>
    <option value="wired">Strict – physical AC / DC / PV circuits required</option>
   </select></label>
   <label>Simulated irradiance {settings.solarPercent}% <input type="range" min="0" max="100" step="5" disabled={w.blocked} value={settings.solarPercent} onChange={e=>w.setPowerSettings({solarPercent:Number(e.target.value)})}/></label>
   <span>Grid: <b className={w.project.mainsOn?'good':'warn'}>{w.project.mainsOn?'ON':'OUTAGE'}</b></span>
   {[15,60,240].map(min=><button key={min} disabled={w.blocked} onClick={()=>w.powerTime(min)}>Advance +{min} min</button>)}
  </div>
  <div className="power-lab-tools"><label>Fault injection <select disabled={w.blocked} value={fault} onChange={e=>setFault(e.target.value as PowerFault)}>
   <option value="grid">AC grid outage</option><option value="solar">Solar array failure</option><option value="battery">Battery discharged</option>
   <option value="ups">UPS failure</option><option value="inverter">Inverter failure</option><option value="breaker">Trip AC distribution</option>
   <option value="wire">Disconnect power cable</option><option value="overload">Reduce UPS output rating</option><option value="reset">Reset grid and fault flags</option>
  </select></label><button disabled={w.blocked} onClick={()=>w.powerFault(fault)}>Apply Fault</button>
  <span>Elapsed virtual time: {settings.virtualMinutes} min</span>
  {settings.mode==='legacy'&&<span className="warning-line">Legacy mode ignores external wiring for old installations. Select Strict for power design and diagnostics.</span>}
  </div>
  <div className="power-metrics">
   <div><small>CONNECTED LOAD</small><strong>{(result?.totalLoadW||0).toFixed(1)} W</strong></div>
   <div><small>GRID DRAW</small><strong>{(result?.gridDrawW||0).toFixed(1)} W</strong></div>
   <div><small>SOLAR AVAILABLE</small><strong>{(result?.solarGenerationW||0).toFixed(1)} W</strong></div>
   <div><small>BATTERY DISCHARGE</small><strong>{(result?.batteryDrawW||0).toFixed(1)} W</strong></div>
   <div><small>BACKUP ESTIMATE</small><strong>{(result?.estimatedBackupMinutes||0).toFixed(0)} min</strong></div>
   <div><small>ISSUES</small><strong className={result?.issues.length?'warn':'good'}>{result?.issues.length||0}</strong></div>
  </div>
  <div className="power-status-grid">
   <div><h4>POWER EQUIPMENT</h4>{!electrical.length&&<p>No electrical devices installed. Use “Install grid + UPS + solar power rig” in the catalogue.</p>}
    {electrical.map(d=>{const status=result?.devices[d.id];return <button className="power-device-row" key={d.id} onClick={()=>w.setSelected({kind:'device',id:d.id})}>
     <span>{status?.powered?'🟢':'⚪'} {d.name}</span><strong>{(status?.outputW||0).toFixed(1)} W · {(status?.chargeWh||0).toFixed(0)} Wh</strong>
    </button>;})}
   </div><div><h4>ELECTRICAL CIRCUITS</h4>{Object.values(result?.cables||{}).length===0&&<p>No wired AC/DC/PV runs connected.</p>}
    {Object.values(result?.cables||{}).map(c=><button className="power-device-row" key={c.id} onClick={()=>w.setSelected({kind:'cable',id:c.id})}>
     <span>{c.up?'✓':'⚠'} {c.media.replace('power-','').toUpperCase()} · {c.voltageV} V</span><strong>{c.watts.toFixed(1)} / {c.maxWatts.toFixed(0)} W</strong>
     {!!c.faults.length&&<small className="warn">{c.faults.join('; ')}</small>}
    </button>)}
   </div>
  </div><small className="editor-muted">Educational model: no physical current, electrical protection certification or actual battery charging equipment is connected. Approximate backup time is not a manufacturer guarantee.</small>
 </div>;
}
