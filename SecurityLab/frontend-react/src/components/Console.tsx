import React,{useState} from 'react';
import {probeNetwork,resolveNetworkName} from '../../../src/engine/networking.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {LabEvent} from '../../../src/domain/types.js';
import {DockTabs,RealtimePanel} from './Dock.js';
import {clockLabel,modeOf,signalOf} from '../../../src/engine/cctv.js';
import {profile} from '../../../src/domain/catalog.js';
import {AlarmConsole} from './AlarmConsole.js';
import {AccessConsole} from './AccessConsole.js';
import {PowerConsole} from './PowerConsole.js';
import {ScenarioConsole} from './ScenarioConsole.js';
import {AssessmentConsole} from './AssessmentConsole.js';
import {FieldReviewConsole} from './FieldReviewConsole.js';
import {ToolsConsole} from './ToolsConsole.js';
export function Console({w}:{w:Workbench}){
 const [fault,setFault]=useState('disconnect');
 const [source,setSource]=useState('');const [destination,setDestination]=useState('');const [lastProbe,setLastProbe]=useState('');const [hostname,setHostname]=useState('recorder.lab');
 const faults=[['disconnect','Disconnect video cable'],['ipconflict','Duplicate IP address'],['badsubnet','Incorrect subnet mask'],['lowpoe','Insufficient PoE budget'],['power','Switch/recorder failure'],['storage','Recorder disk full'],['diskfail','Failed recording drive'],['bandwidth','Recorder bandwidth exceeded'],['dhcp','Remove reachable DHCP lease'],['vlan','Move camera to wrong VLAN'],['wifi','Incorrect wireless PSK'],['orientation','Incorrect camera orientation'],['coax','Analog coax fault'],['nightir','Night IR unavailable']];
 const recorders=Object.values(w.result.recorders),clips=(w.project.clips||[]).slice(-30).reverse();
 const cameras=w.project.devices.filter(d=>profile(d.profileId).kind==='camera');
 const network=w.result.network;
 const participants=w.project.devices.filter(d=>!profile(d.profileId).kind.startsWith('access-')&&!profile(d.profileId).kind.startsWith('alarm-')&&profile(d.profileId).kind!=='switch'&&!(profile(d.profileId).kind==='camera'&&profile(d.profileId).signal==='analog'));
 const probe=()=>{
  const a=source||participants[0]?.id,b=destination||participants[1]?.id;
  if(!a||!b||a===b){w.setNotice('Choose two different IP devices to probe');return;}
  const up=new Set(w.project.cables.filter(c=>w.result.cables[c.id]?.up).map(c=>c.id));
  const powered=new Set(w.project.devices.filter(d=>w.result.devices[d.id]?.powered).map(d=>d.id));
  const trace=probeNetwork(w.project,up,powered,a,b);
  const message=`Simulated path ${w.project.devices.find(d=>d.id===a)?.name} → ${w.project.devices.find(d=>d.id===b)?.name}: ${trace.ok?'REACHABLE':'FAILED'} — ${trace.reason}`;
  setLastProbe(`${message}${trace.links.length?` · ${trace.links.length} links`:''}`);
  const event:LabEvent={id:`probe-${crypto.randomUUID()}`,at:new Date().toISOString(),kind:trace.ok?'info':'warning',message,recorded:false};
  w.commit({...w.project,events:[...w.project.events,event].slice(-250)},'Network diagnostic probe recorded');
 };
 const dnsProbe=()=>{
  const from=source||participants[0]?.id;
  if(!from){w.setNotice('Select a DNS lookup source');return;}
  const up=new Set(w.project.cables.filter(c=>w.result.cables[c.id]?.up).map(c=>c.id));
  const powered=new Set(w.project.devices.filter(d=>w.result.devices[d.id]?.powered).map(d=>d.id));
  const lookup=resolveNetworkName(w.project,up,powered,from,hostname.trim());
  const message=`DNS ${hostname}: ${lookup.ok?lookup.ip:'FAILED'} — ${lookup.reason}`;
  setLastProbe(message);
  const event:LabEvent={id:`dns-${crypto.randomUUID()}`,at:new Date().toISOString(),kind:lookup.ok?'info':'warning',message,recorded:false};
  w.commit({...w.project,events:[...w.project.events,event].slice(-250)},'Simulated DNS lookup recorded');
 };
 return <section className={`console panel ${w.tab==='field-review'||w.tab==='tools'?'console-expanded':''}`}><div className="console-head"><DockTabs w={w}/>
  {(w.tab==='diagnostics'||w.tab==='events')&&<div className="fault-controls"><select aria-label="Fault type" value={fault} onChange={e=>setFault(e.currentTarget.value)}>{faults.map(([value,title])=><option value={value} key={value}>{title}</option>)}</select><button disabled={w.blocked} onClick={()=>w.runFault(fault)}>Inject Fault</button><button disabled={w.blocked} onClick={()=>w.commit({...w.project,events:[]},'Event log cleared')}>Clear Events</button></div>}</div>
  {w.tab==='network'&&<div className="network-probe"><strong>SIMULATED IPV4 CONNECTIVITY PROBE</strong><label>From <select aria-label="Probe source" value={source} onChange={e=>setSource(e.currentTarget.value)}><option value="">Choose source</option>{participants.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>To <select aria-label="Probe destination" value={destination} onChange={e=>setDestination(e.currentTarget.value)}><option value="">Choose destination</option>{participants.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button disabled={w.blocked} onClick={probe}>Probe Route</button><label>DNS hostname <input aria-label="DNS hostname" value={hostname} onChange={e=>setHostname(e.target.value)} maxLength={79}/></label><button disabled={w.blocked} onClick={dnsProbe}>Resolve DNS</button>{lastProbe&&<span role="status">{lastProbe}</span>}</div>}
  {w.tab==='recordings'&&<div className="recording-time"><strong>VIRTUAL TIME · {clockLabel(w.project)}</strong><span>Advance recording storage &amp; active schedules:</span>{[1,15,60].map(min=><button key={min} disabled={w.blocked} onClick={()=>w.advanceTime(min)}>+{min} min</button>)}<small>Only continuous/scheduled streams grow storage while clock advances. Motion recording creates virtual clip metadata.</small></div>}
  {w.tab==='systems'&&<RealtimePanel w={w}/>}
  {w.tab==='power'&&<PowerConsole w={w}/>}
  {w.tab==='scenario'&&<ScenarioConsole w={w}/>}
  {w.tab==='assessment'&&<AssessmentConsole w={w}/>}
  {w.tab==='field-review'&&<FieldReviewConsole w={w}/>}
  {w.tab==='tools'&&<ToolsConsole w={w}/>}
  <div className="console-body" style={w.tab==='systems'||w.tab==='power'||w.tab==='scenario'||w.tab==='assessment'||w.tab==='field-review'||w.tab==='tools'?{display:'none'}:undefined}><div className="log-lines" tabIndex={0} role="region" aria-label="Simulation log output">{w.tab==='diagnostics'?(w.result.issues.length?w.result.issues.map((issue,i)=><p className="warning-line" key={i}>⚠ {issue}</p>):<p className="good">✓ No active simulation faults</p>):w.tab==='network'?<><p className="editor-muted">L2/L3 network and radio rules — deterministic teaching approximation; no actual packets transmitted.</p>{participants.map(d=>{const a=network?.addresses[d.id];const radio=network?.wireless[d.id];return <p key={d.id} className={a?.faults.length?'warning-line':''}><strong>{d.name}</strong> · {a?.ip||'No address'} · {a?.source||'static'} · VLAN {a?.vlanId||10}{radio?` · Wi-Fi ${radio.connected?'associated':'offline'} (${radio.signalPercent}%)`:''}{a?.faults.length?` · ${a.faults.join('; ')}`:''}</p>;})}{Object.values(network?.links||{}).map(link=><p key={link.id} className={link.faults.length?'warning-line':''}>↔ {link.id.startsWith('radio:')?'Wi-Fi':'Ethernet'} · P{link.aPort}/P{link.bPort} · VLAN {link.vlans.join(',')||'none'} · {link.usedMbps.toFixed(2)}/{link.capacityMbps.toFixed(2)} Mb/s{link.faults.length?` · ${link.faults.join('; ')}`:''}</p>)}{(network?.diagnostics||[]).map((d,i)=><p key={`diag-${i}`} className="warning-line">⚠ {d}</p>)}</>:w.tab==='events'?(w.project.events.length?w.project.events.slice(-25).reverse().map(e=><p key={e.id} className={e.recorded?'good':''}><span className="muted">[{e.at.slice(11,19)}]</span> {e.message}</p>):<p className="muted">No simulated events yet. Use Test Motion on the plan.</p>):w.tab==='recordings'?<>
   <p className="editor-muted">Channel matrix — live simulation state (not actual video playback)</p>
   {recorders.length?recorders.map(r=><div key={r.id} className="recorder-console"><strong>{w.project.devices.find(d=>d.id===r.id)?.name||r.id}</strong><span>{r.channelsUsed}/{r.channelsTotal} channels · {r.bandwidthUsedMbps.toFixed(2)}/{r.bandwidthLimitMbps.toFixed(2)} Mb/s · {r.usedGB.toFixed(2)}/{r.storageGB.toFixed(0)} GB</span><div className="recorder-channel-grid">{Array.from({length:r.channelsTotal},(_,idx)=>{const camId=r.cameras[idx];const cam=w.project.devices.find(d=>d.id===camId);return <div key={idx} className={`recorder-channel-tile ${cam?'active':''}`}><strong>CH {idx+1}</strong><span>{cam?.name||'No signal'}</span><small>{cam?`${signalOf(cam).toUpperCase()} · ${modeOf(cam)}`:'—'}</small></div>;})}</div></div>):<p className="warning-line">No NVR or DVR installed; recording channels are unavailable.</p>}
   <p className="editor-muted">Recent motion metadata (does not contain playable video)</p>{clips.length?clips.map(c=><p key={c.id} className="good">● {c.at.slice(11,19)} · {w.project.devices.find(d=>d.id===c.cameraId)?.name||c.cameraId} · CH {w.result.devices[c.cameraId]?.channel??'?'} · {c.durationSeconds}s · {c.sizeGB.toFixed(4)} GB event storage</p>):<p className="muted">No virtual clips. Trigger motion with an operational camera and recorder.</p>}
  </>:w.tab==='alarm'?<AlarmConsole w={w}/>:w.tab==='access'?<AccessConsole w={w}/>:w.assessment.rubric.map(r=><p key={r.id}><span className="good">{r.earned}/{r.max}</span> · {r.title} — {r.details}</p>)}</div>
  {w.tab==='access'?<div className="assessment-card alarm-summary-card"><strong>Access Control Status</strong><p>Virtual doors, credential decisions and controller wiring</p><div className="metric-row"><div><small>CONTROLLERS</small><b>{Object.keys(w.result.access?.controllers||{}).length}</b></div><div><small>GRANTED</small><b>{w.result.access?.grantedCount||0}</b></div><div><small>DENIED</small><b>{w.result.access?.deniedCount||0}</b></div><div><small>DOOR ALERTS</small><b>{Object.values(w.result.access?.doors||{}).filter(d=>d.alarm).length}</b></div></div><p className="editor-muted">Local synthetic tokens and deterministic schedules only. No production authentication.</p></div>:w.tab==='alarm'?<div className="assessment-card alarm-summary-card"><strong>Intrusion Alarm Status</strong><p>Panel supervision, armed areas and simulated active outputs</p>
   <div className="metric-row"><div><small>PANELS</small><b>{Object.keys(w.result.alarm?.panels||{}).length}</b></div><div><small>ARMED</small><b>{Object.values(w.result.alarm?.panels||{}).filter(x=>x.mode!=='disarmed').length}</b></div><div><small>ACTIVE OUTPUTS</small><b>{Object.values(w.result.alarm?.panels||{}).reduce((n,p)=>n+p.activeOutputs.length,0)}</b></div><div><small>CIRCUIT FAULTS</small><b>{Object.values(w.result.alarm?.wires||{}).filter(x=>!x.up).length}</b></div></div>
   <p className="editor-muted">Manual virtual clock · independent alarm circuits · simulated siren activation only</p></div>:<div className="assessment-card"><strong>Installation Assessment: {w.assessment.passed?'PASSED':'IN PROGRESS'}</strong><p>{w.assessment.passed?'Exercise operational criteria met in simulation.':'Complete configuration, troubleshoot faults and verify recording evidence.'}</p>
   <div className="metric-row"><div><small>SCORE</small><b>{w.assessment.score}/100</b></div><div><small>TARGETS</small><b>{w.result.coverage.filter(x=>x.covered).length}/{w.result.coverage.length}</b></div><div><small>ONLINE</small><b>{w.result.onlineCameras}/{w.result.requiredCameras}</b></div><div><small>RECORDING</small><b>{w.result.recordingCameras}</b></div></div>
   <p className="editor-muted">{cameras.length} installed cameras · {recorders.length} recorders · {clips.length} recent stored-event entries · {clockLabel(w.project)}</p>
  </div>}</div></section>;
}
