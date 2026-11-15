import {PowerConfigPanel} from './PowerConfig.js';
import React from 'react';
import {Icon,kindIcon} from './icons.js';
import {profile} from '../../../src/domain/catalog.js';
import {distanceMeters,scaleOf} from '../../../src/property/editor.js';
import type {Device,Point,Room,Wall,FloorplanSettings} from '../../../src/domain/types.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import {CameraSettings,RecorderSettings} from './CctvConfig.js';
import {signalOf} from '../../../src/engine/cctv.js';
import {NetworkSettings} from './NetworkConfig.js';
import {AlarmConfig} from './AlarmConfig.js';
import {AccessConfig} from './AccessConfig.js';

const parse=(s:string)=>Number.isFinite(Number(s))?Number(s):0;
function DeviceField({w,device,label,keyName,type='text',min,max}:{w:Workbench;device:Device;label:string;keyName:keyof Device;type?:string;min?:number;max?:number}){
 return <label className="prop-field"><span>{label}</span><input disabled={w.blocked} type={type} min={min} max={max} value={String(device[keyName]??'')} onChange={e=>w.update(device.id,{[keyName]:type==='number'?parse(e.currentTarget.value):e.currentTarget.value})}/></label>;
}
function Numeric({name,value,onChange,disabled,min=0,max=1000,step=1}:{name:string;value:number;onChange:(n:number)=>void;disabled:boolean;min?:number;max?:number;step?:number}){
 return <label className="prop-field"><span>{name}</span><input disabled={disabled} type="number" min={min} max={max} step={step} value={value} onChange={e=>onChange(parse(e.currentTarget.value))}/></label>;
}
function RoomFields({w,room}:{w:Workbench;room:Room}){
 const m=scaleOf(w.project);
 return <><div className="section-heading">PROPERTY GEOMETRY — ROOM</div><div className="fields"><label className="prop-field"><span>Room name</span><input disabled={w.blocked} value={room.name} maxLength={120} onChange={e=>w.updateRoom(room.id,{name:e.currentTarget.value})}/></label>
 {(['x','y','w','h'] as const).map(k=><Numeric key={k} disabled={w.blocked} name={`${k.toUpperCase()} (units)`} value={room[k]} max={k==='w'?1000:k==='h'?650:1000} min={k==='w'||k==='h'?20:0} onChange={v=>w.updateRoom(room.id,{[k]:v})}/>)}
 <p className="editor-muted">Approximately {(room.w/m).toFixed(2)} m × {(room.h/m).toFixed(2)} m at the current plan scale.</p>
 <p className="editor-muted">Resize using the lower-right corner handle. Newly created rooms include physical walls; any openings linked to the room move and scale with it.</p></div></>;
}
function WallFields({w,wall}:{w:Workbench;wall:Wall}){
 const length=distanceMeters({x:wall.x1,y:wall.y1},{x:wall.x2,y:wall.y2},scaleOf(w.project));
 const move=(key:'x1'|'y1'|'x2'|'y2',value:number)=>{
  const end=key==='x1'||key==='y1'?'start':'end';
  const pt=end==='start'?{x:wall.x1,y:wall.y1}:{x:wall.x2,y:wall.y2};
  w.editWallEndpoint(wall.id,end,{...pt,[key.startsWith('x')?'x':'y']:value});
 };
 return <><div className="section-heading">WALL & OPENING ENGINEERING</div><div className="fields"><label className="prop-field"><span>Barrier type</span><select disabled={w.blocked} value={wall.kind} onChange={e=>w.updateWall(wall.id,{kind:e.currentTarget.value as Wall['kind']})}><option value="wall">Solid wall (blocks line of sight)</option><option value="door">Door opening (clear)</option><option value="window">Window opening (clear)</option></select></label>
 {(['x1','y1','x2','y2'] as const).map(k=><Numeric key={k} name={`${k.toUpperCase()} (units)`} value={wall[k]} max={k.startsWith('x')?1000:650} disabled={w.blocked} onChange={v=>move(k,v)}/>)}
 <p className="editor-muted">Length: {length.toFixed(2)} m. Drag endpoint handles or use the precise coordinates.</p><p className="editor-muted">Solid walls occlude simulated cameras. Doors and windows are modelled as fully transparent openings; glass optics, door-leaf state and fire ratings are not simulated.</p></div></>;
}
function ReferenceFields({w}:{w:Workbench}){
 const f=w.project.floorplanSettings??{x:0,y:0,width:1000,height:650,opacity:0.36,locked:true};
 return <><div className="section-heading">FLOOR-PLAN IMAGE REFERENCE</div><div className="fields">
 <label className="checkfield"><span>Lock overlay position</span><input disabled={w.blocked} type="checkbox" checked={f.locked} onChange={e=>w.setFloorplanSettings({locked:e.target.checked})}/></label>
 {(['x','y','width','height','opacity'] as const).map(k=><Numeric key={k} name={k==='opacity'?'Opacity (0–1)':`${k} (plan units)`} value={f[k]} disabled={w.blocked} min={k==='x'?-1000:k==='y'?-650:k==='opacity'?0:20} max={k==='opacity'?1:k==='width'?3000:k==='height'?1950:k==='x'?1000:650} step={k==='opacity'?0.05:1} onChange={v=>w.setFloorplanSettings({[k]:v})}/>)}
 <p className="editor-muted">The image is a tracing aid only. It does not create walls, change camera coverage or affect assessment until real geometry is drawn over it.</p></div></>;
}
export function Inspector({w}:{w:Workbench}){
 const s=w.selected;
 const [tab,setTab]=React.useState<'general'|'coverage'|'network'>('general');
 const device=s?.kind==='device'?w.project.devices.find(d=>d.id===s.id):undefined;
 const room=s?.kind==='room'?w.project.rooms.find(r=>r.id===s.id):undefined;
 const wall=s?.kind==='wall'?w.project.walls.find(x=>x.id===s.id):undefined;
 const cable=s?.kind==='cable'?w.project.cables.find(c=>c.id===s.id):undefined;
 const target=s?.kind==='target'?w.project.targets.find(t=>t.id===s.id):undefined;
 const site=s?.kind==='site'?w.project.siteElements?.find(t=>t.id===s.id):undefined;
 const reference=s?.kind==='reference'&&Boolean(w.project.floorplanImage);
 const dProfile=device?profile(device.profileId):undefined,health=device?w.result.devices[device.id]:undefined;
 return <aside className="inspector panel" aria-label="Properties"><div className="panel-heading prop-heading"><h2><Icon name={dProfile?kindIcon(dProfile.kind):'settings'} size={20}/> {device?'Device Properties':room?'Room Properties':wall?'Wall Properties':cable?'Cable Properties':'Properties'}</h2>{s&&<button className="icon-btn" aria-label="Close properties" onClick={()=>w.setSelected(null)}><Icon name="close" size={18}/></button>}</div>
 <div className="inspector-scroll">
 {device&&dProfile?<>
  <div className="device-summary"><span className="big-icon"><Icon name={kindIcon(dProfile.kind)} size={34}/></span><div><strong>{dProfile.name}</strong><small>{device.name}</small></div><span className={health?.powered?'badge good':'badge warn'}><i className="dot"/>{health?.powered?(health.networkOk||!dProfile.kind.match(/camera|nvr|dvr/)?'Online':'Powered'):'Offline'}</span></div>
  <div className="prop-tabs" role="tablist" aria-label="Device property groups">{([["general","General"],["coverage","Coverage"],["network","Network"]] as const).map(([id,lbl])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{lbl}</button>)}</div>
  {tab==="general"&&<>
  <div className="section-heading">IDENTITY & POSITION</div><div className="fields"><DeviceField w={w} device={device} label="Name" keyName="name"/>
  <Numeric name="X (plan units)" value={device.x} disabled={w.blocked} onChange={x=>w.moveDevice(device.id,{x,y:device.y})}/>
  <Numeric name="Y (plan units)" value={device.y} max={650} disabled={w.blocked} onChange={y=>w.moveDevice(device.id,{x:device.x,y})}/>
  {dProfile.kind==='switch'&&<DeviceField w={w} device={device} label="PoE budget (W)" keyName="poeBudgetW" type="number" min={0} max={dProfile.manufacturerSpec?dProfile.poeBudgetW:500}/>}
  {(dProfile.kind==='camera'?['enabled','motionEnabled'] as const:['enabled'] as const).map(k=><label key={k} className="checkfield"><span>{k==='enabled'?'Device enabled':k==='motionEnabled'?'Motion detection':'Recording enabled'}</span><input disabled={w.blocked} type="checkbox" checked={device[k]} onChange={e=>w.update(device.id,{[k]:e.target.checked})}/></label>)}
  </div>{dProfile.kind==='camera'&&<CameraSettings w={w} camera={device}/>}
  {dProfile.kind.startsWith('alarm-')&&<AlarmConfig w={w} device={device}/>}
  {dProfile.kind.startsWith('access-')&&<AccessConfig w={w} device={device}/>} 
  {dProfile.kind.startsWith('power-')&&<PowerConfigPanel w={w} device={device}/>} 
  {(dProfile.kind==='nvr'||dProfile.kind==='dvr')&&<RecorderSettings w={w} device={device}/>}
  <div className="section-heading">LIVE SIMULATION HEALTH</div><div className="health">{(dProfile.kind.startsWith('alarm-')||dProfile.kind.startsWith('access-')||dProfile.kind.startsWith('power-')?['powered','connected'] as const:['powered','connected','networkOk','recordingReady'] as const).map(k=><div key={k}><span>{k.replace(/([A-Z])/g,' $1')}</span><strong className={health?.[k]?'good':'warn'}>{health?.[k]?'✓ OK':'● Not ready'}</strong></div>)}{(health?.faults||[]).map(x=><div key={x} className="warning-line">⚠ {x}</div>)}</div>
  <div className="section-heading">{dProfile.manufacturerSpec?'DOCUMENTED MANUFACTURER PROFILE':'SIMULATED TRAINING PROFILE'}</div><div className="specs"><p>Manufacturer: {dProfile.manufacturer}</p><p>Model: {dProfile.model}</p><p>Power: {dProfile.powerW} W</p><p>Ethernet ports: {dProfile.ethernetPorts}</p>
  {dProfile.kind==='switch'&&<p>PoE: {dProfile.poePorts} output ports · {dProfile.poeBudgetW} W shared · {dProfile.maxPortW} W per port</p>}
  {dProfile.manufacturerSpec?<><p>Source variant: {dProfile.manufacturerSpec.variant} · edition {dProfile.manufacturerSpec.edition}</p><p>Reviewed: {dProfile.manufacturerSpec.documentedAt} · {dProfile.manufacturerSpec.status==='reference-only'?'NOT PLACEABLE':'SIMULATED'}</p>
    <p><a href={dProfile.manufacturerSpec.sourceUrl} target="_blank" rel="noopener noreferrer">Manufacturer specification source</a></p>
    <p><strong>Documented facts</strong></p><ul>{dProfile.manufacturerSpec.sourcedFacts.map(v=><li key={v}>{v}</li>)}</ul>
    <p><strong>Simulation limits</strong></p><ul>{dProfile.manufacturerSpec.limitations.map(v=><li key={v}>{v}</li>)}</ul>
    <Numeric name="Your local quotation (GHS)" value={device.unitCostGhs??0} step={1} min={0} max={999999} disabled={w.blocked} onChange={v=>w.update(device.id,{unitCostGhs:v>0?v:undefined})}/>
    <p className="editor-muted">Enter a genuine local equipment quotation. Until then, assessment budget points are withheld. This is not a vendor price list.</p>
   </>:<p>Catalogue training estimate: GHS {dProfile.costGhs}</p>}
  <p>Virtual rules only — NOT actual manufacturer firmware, security approval or certified interoperability.</p></div>
  </>}
  {tab==="coverage"&&(dProfile.kind==='camera'?<><div className="section-heading">CAMERA COVERAGE</div><div className="fields"><><DeviceField w={w} device={device} label="Orientation (°)" keyName="heading" type="number" min={0} max={360}/><DeviceField w={w} device={device} label="Field of View (°)" keyName="fov" type="number" min={1} max={180}/><DeviceField w={w} device={device} label="Range (units)" keyName="range" type="number" min={0} max={1000}/></></div><p className="editor-muted">The shaded area on the plan follows these values, walls and the day/night and weather settings. Open Tools &gt; Lens calculator or Camera view for pixel density and a simulated view.</p></>:<p className="editor-muted">Coverage fields apply to cameras. Detector heading and range for alarm sensors are in the General tab.</p>)}
  {tab==="network"&&((dProfile.kind==='nvr'||dProfile.kind==='router'||dProfile.kind==='server'||dProfile.kind==='ap'||(dProfile.kind==='camera'&&signalOf(device)==='ip'))?<><div className="section-heading">IP NETWORK SETTINGS</div><div className="fields"><><DeviceField w={w} device={device} label="IP Address" keyName="ip"/><DeviceField w={w} device={device} label="Subnet Mask" keyName="mask"/><DeviceField w={w} device={device} label="Gateway" keyName="gateway"/></></div><p className="editor-muted">VLANs, ports, DHCP and routing: use Tools &gt; Network CLI or the Network tab of the dock.</p></>:<p className="editor-muted">This device has no IP settings. Wired alarm, access and power devices connect through their own circuits.</p>)}
 </>:room?<RoomFields w={w} room={room}/>:wall?<WallFields w={w} wall={wall}/>:cable?<div className="fields"><h3>{cable.medium?.startsWith('power-')?`Electrical ${cable.medium.slice(6).toUpperCase()} circuit`:cable.medium==='alarm'?'Wired alarm circuit':cable.medium==='access'?'Dedicated access-control wiring':cable.medium==='coax'?'Coaxial video cable':'Ethernet cable'}</h3>
  {cable.medium!=='coax'&&cable.medium!=='alarm'&&cable.medium!=='access'&&!cable.medium?.startsWith('power-')&&<><Numeric name="End A port (0 = automatic)" value={cable.aPort||0} min={0} max={48} disabled={w.blocked} onChange={aPort=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,aPort:aPort||undefined}:c)},'Cable end A port changed')}/><Numeric name="End B port (0 = automatic)" value={cable.bPort||0} min={0} max={48} disabled={w.blocked} onChange={bPort=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,bPort:bPort||undefined}:c)},'Cable end B port changed')}/><Numeric name="Link maximum (Mb/s)" value={cable.speedMbps||1000} min={1} max={10000} disabled={w.blocked} onChange={speedMbps=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,speedMbps}:c)},'Link bandwidth updated')}/></>}
  {cable.medium?.startsWith('power-')&&<Numeric name="Electrical cable maximum current (A)" value={cable.powerMaxAmps|| (cable.medium==='power-ac'?16:cable.medium==='power-pv'?15:60)} min={0.1} max={200} disabled={w.blocked} onChange={powerMaxAmps=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,powerMaxAmps}:c)},'Electrical cable current rating changed')}/>} 
  <Numeric name="Cable length (m)" value={cable.lengthMeters} min={1} max={500} disabled={w.blocked} onChange={lengthMeters=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,lengthMeters}:c)})}/>
  <label className="checkfield"><span>Cable connected</span><input type="checkbox" disabled={w.blocked} checked={cable.connected} onChange={e=>w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,connected:e.target.checked}:c)})}/></label><p className="editor-muted">Status: {w.result.cables[cable.id]?.reason}. {cable.medium==='alarm'?'Dedicated supervised training circuit':cable.medium==='access'?'Dedicated controller I/O training circuit':cable.medium?.startsWith('power-')?'Directed virtual supply conductor, not a real power installation':`Used ${w.result.network?.links[cable.id]?.usedMbps.toFixed(2)||'0'} / ${w.result.network?.links[cable.id]?.capacityMbps.toFixed(0)||'?'} Mb/s`}</p></div>
 :target?<><div className="section-heading">SCENARIO ASSESSMENT TARGET</div><p className="editor-muted">{target.name} · This target affects assessment coverage. You may move it, but cannot delete it.</p><Numeric name="X (units)" value={target.x} disabled={w.blocked} onChange={x=>w.updateTarget(target.id,{x})}/><Numeric name="Y (units)" value={target.y} max={650} disabled={w.blocked} onChange={y=>w.updateTarget(target.id,{y})}/></>
 :site?<><div className="section-heading">SITE ANNOTATION</div><label className="prop-field"><span>Marker label</span><input disabled={w.blocked} value={site.label} onChange={e=>w.updateSiteElement(site.id,{label:e.target.value})}/></label><p className="editor-muted">Type: {site.kind}. Markers document gates and entryways but do not create functional alarm/security devices.</p><Numeric name="X (units)" value={site.x} disabled={w.blocked} onChange={x=>w.updateSiteElement(site.id,{x})}/><Numeric name="Y (units)" value={site.y} max={650} disabled={w.blocked} onChange={y=>w.updateSiteElement(site.id,{y})}/></>
 :reference?<ReferenceFields w={w}/>:<div className="no-selection"><span>⌖</span><h3>Property workspace</h3><p>Select a room, wall, device, cable or marker to edit its exact position and behaviour.</p><p>Stage 9 adds documented manufacturer-specific models to generic training devices. No genuine vendor firmware, radio pairing or independent interoperability certification is included.</p></div>}
 {!s&&<div className="site-scale-editor"><div className="section-heading">SITE SCALE</div><Numeric name="Virtual units per metre" min={1} max={100} value={scaleOf(w.project)} disabled={w.blocked} onChange={w.setPropertyScale}/><p className="editor-muted">Default 10 units/metre. This controls measurements and cable lengths, not manufacturer dimensions.</p>{w.project.floorplanImage&&<button onClick={()=>w.setSelected({kind:'reference',id:'floorplan'})}>Edit floor-plan reference</button>}</div>}
 {s&&s.kind!=='target'&&<button className="danger" onClick={w.removeSelection} disabled={w.blocked}>Delete selected {s.kind==='reference'?'image reference':'element'}</button>}
 </div></aside>;
}
