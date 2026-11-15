import React from 'react';
import {profile} from '../../../src/domain/catalog.js';
import type {Device} from '../../../src/domain/types.js';
import type {Workbench} from '../hooks/useWorkbench.js';
function DeviceField({w,device,label,keyName,type='text',min,max}:{w:Workbench;device:Device;label:string;keyName:keyof Device;type?:string;min?:number;max?:number}){
 return <label className="prop-field"><span>{label}</span><input disabled={w.blocked} type={type} min={min} max={max} value={String(device[keyName]??'')} onChange={e=>w.update(device.id,{[keyName]:type==='number'?Number(e.currentTarget.value):e.currentTarget.value})}/></label>;
}
export function Inspector({w}:{w:Workbench}){
 const s=w.selected;
 const device=s?.kind==='device'?w.project.devices.find(d=>d.id===s.id):undefined;
 const room=s?.kind==='room'?w.project.rooms.find(r=>r.id===s.id):undefined;
 const cable=s?.kind==='cable'?w.project.cables.find(c=>c.id===s.id):undefined;
 const wall=s?.kind==='wall'?w.project.walls.find(x=>x.id===s.id):undefined;
 const dProfile=device?profile(device.profileId):undefined;
 const health=device?w.result.devices[device.id]:undefined;
 return <aside className="inspector panel"><div className="panel-heading"><h2>Properties & Diagnostics</h2><p>Selected object configuration and health</p></div>
 <div className="inspector-scroll">{device&&dProfile?<>
  <div className="device-summary"><span className="big-icon">{dProfile.kind==='camera'?'◉':dProfile.kind==='switch'?'▤':'▣'}</span><div><strong>{device.name}</strong><small>{dProfile.model} · Simulated training profile</small></div><span className={health?.powered?'good':'warn'}>{health?.powered?'Powered':'Offline'}</span></div>
  <div className="section-heading">CONFIGURATION</div>
  <div className="fields"><DeviceField w={w} device={device} label="Name" keyName="name"/><DeviceField w={w} device={device} label="IP Address" keyName="ip"/><DeviceField w={w} device={device} label="Subnet Mask" keyName="mask"/><DeviceField w={w} device={device} label="Gateway" keyName="gateway"/>
  {dProfile.kind==='camera'&&<><DeviceField w={w} device={device} label="Orientation (°)" keyName="heading" type="number" min={0} max={360}/><DeviceField w={w} device={device} label="Field of View (°)" keyName="fov" type="number" min={1} max={180}/><DeviceField w={w} device={device} label="Range (units)" keyName="range" type="number" min={0} max={1000}/></>}
  {dProfile.kind==='switch'&&<DeviceField w={w} device={device} label="PoE budget (W)" keyName="poeBudgetW" type="number" min={0} max={500}/>}
  {dProfile.kind==='nvr'&&<><DeviceField w={w} device={device} label="Storage GB" keyName="storageGB" type="number" min={0} max={100000}/><DeviceField w={w} device={device} label="Used GB" keyName="usedGB" type="number" min={0}/></>}
  {(['enabled','motionEnabled','recordingEnabled'] as const).map(k=><label key={k} className="checkfield"><span>{k==='enabled'?'Device powered/enabled':k==='motionEnabled'?'Motion detection':'Recording enabled'}</span><input disabled={w.blocked} type="checkbox" checked={device[k]} onChange={e=>w.update(device.id,{[k]:e.currentTarget.checked})}/></label>)}
  </div><div className="section-heading">DEVICE HEALTH</div>
  <div className="health">{(['powered','connected','networkOk','recordingReady'] as const).map(k=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><strong className={health?.[k]?'good':'warn'}>{health?.[k]?'✓ OK':'● Not ready'}</strong></div>)}
  {(health?.faults||[]).map(x=><div key={x} className="warning-line">⚠ {x}</div>)}</div>
  <div className="section-heading">SPECIFICATIONS</div><div className="specs"><p>Manufacturer: {dProfile.manufacturer}</p><p>Model: {dProfile.model}</p><p>Power: {dProfile.powerW} W</p><p>Ports: {dProfile.ethernetPorts}</p><p>Price: GHS {dProfile.costGhs}</p><p>Simulated, not manufacturer firmware</p></div>
 </>:room?<div className="fields"><h3>Room</h3><label className="prop-field"><span>Room name</span><input disabled={w.blocked} value={room.name} onChange={e=>w.updateRoom(room.id,{name:e.currentTarget.value})}/></label>{(['x','y','w','h'] as const).map(k=><label className="prop-field" key={k}><span>{k.toUpperCase()}</span><input disabled={w.blocked} type="number" value={room[k]} onChange={e=>w.updateRoom(room.id,{[k]:Number(e.currentTarget.value)})}/></label>)}</div>:cable?<div className="fields"><h3>Ethernet cable</h3><label className="prop-field"><span>Length (m)</span><input disabled={w.blocked} type="number" min={1} max={500} value={cable.lengthMeters} onChange={e=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,lengthMeters:Number(e.currentTarget.value)}:c)})}/></label><label className="checkfield"><span>Cable connected</span><input disabled={w.blocked} type="checkbox" checked={cable.connected} onChange={e=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,connected:e.currentTarget.checked}:c)})}/></label><p className="muted">Status: {w.result.cables[cable.id]?.reason}</p></div>:wall?<div className="fields"><h3>Wall / barrier</h3><label className="prop-field"><span>Type</span><select disabled={w.blocked} value={wall.kind} onChange={e=>w.updateWall(wall.id,{kind:e.currentTarget.value as typeof wall.kind})}><option value="wall">Solid wall</option><option value="door">Door opening</option><option value="window">Window</option></select></label></div>:<div className="no-selection"><span>⌖</span><h3>No equipment selected</h3><p>Select an object on the floor plan to inspect its configuration, connections and diagnostics.</p></div>}
 {s&&<button className="danger" onClick={w.removeSelection} disabled={w.blocked}>Delete selected element</button>}</div></aside>;
}
