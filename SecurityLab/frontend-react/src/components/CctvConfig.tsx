import {SafeNumber} from './SafeNumber.js';
import React from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import type {Device, MotionZone, PTZPreset,RecordingMode} from '../../../src/domain/types.js';
import {profile} from '../../../src/domain/catalog.js';
import {bitrateOf,clockLabel,fovOf,modeOf,ptzPresetFields,recorderBandwidth,signalOf,supportedResolution} from '../../../src/engine/cctv.js';

type SetNumber=(value:number)=>void;
function NumberSetting({name,value,onChange,disabled,min=0,max=9999,step=1}:{name:string;value:number;onChange:SetNumber;disabled:boolean;min?:number;max?:number;step?:number}){
 return <label className="prop-field"><span>{name}</span><SafeNumber label={name} value={value} onApply={onChange} disabled={disabled} min={min} max={max} step={step}/></label>;
}
function CheckSetting({name,checked,onChange,disabled}:{name:string;checked:boolean;onChange:(value:boolean)=>void;disabled:boolean}){
 return <label className="checkfield"><span>{name}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={e=>onChange(e.currentTarget.checked)}/></label>;
}
export function CameraSettings({w,camera}:{w:Workbench;camera:Device}){
 const spec=profile(camera.profileId),s=w.result.devices[camera.id],disabled=w.blocked;
 const alter=(fields:Partial<Device>)=>w.update(camera.id,fields);
 const zones=camera.motionZones||[],presets=camera.ptzPresets||[];
 const addZone=()=>{
  if(zones.length>=8){w.setNotice('Maximum eight detection zones per camera');return;}
  const zone:MotionZone={id:crypto.randomUUID(),name:`Zone ${zones.length+1}`,x:Math.max(0,Math.round(camera.x-60)),y:Math.max(0,Math.round(camera.y-35)),w:120,h:80,enabled:true};
  alter({motionZones:[...zones,zone]});
 };
 const updateZone=(id:string,fields:Partial<MotionZone>)=>alter({motionZones:zones.map(z=>z.id===id?{...z,...fields,id:z.id}:z)});
 const capturePreset=()=>{
  if(!spec.isPTZ||presets.length>=8){w.setNotice('PTZ camera presets are limited to eight');return;}
  const preset:PTZPreset={id:crypto.randomUUID(),name:`Preset ${presets.length+1}`,heading:camera.heading,opticalZoom:camera.opticalZoom||1,tiltDegrees:camera.tiltDegrees||0};
  alter({ptzPresets:[...presets,preset]});
 };
 const sch=camera.recordingSchedule||{days:[0,1,2,3,4,5,6],startMinute:0,endMinute:1440};
 return <>
  <div className="section-heading">CAMERA IMAGE & COVERAGE</div>
  <div className="fields">
   <p className="editor-muted">{signalOf(camera)==='analog'?'Analog coaxial video with local DC power':'IP video stream supplied over Ethernet and PoE'}. All signal paths are virtual.</p>
   <label className="prop-field"><span>Resolution label</span><select disabled={disabled} value={camera.resolution||'1080p'} onChange={e=>alter({resolution:e.target.value as Device['resolution']})}>{['720p','1080p','1440p','4K'].map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="prop-field"><span>Encoding model</span><select disabled={disabled} value={camera.codec||'H264'} onChange={e=>alter({codec:e.target.value as Device['codec']})}><option>H264</option><option>H265</option></select></label>
   <NumberSetting name="Reference bitrate (Mb/s)" min={0.25} max={spec.maxBitrateMbps||16} step={0.25} disabled={disabled} value={camera.bitrateMbps||bitrateOf(camera)} onChange={v=>alter({bitrateMbps:v})}/>
   <NumberSetting name="Frame rate (frames/s)" min={1} max={spec.maxFrameRate||60} disabled={disabled} value={camera.frameRate||20} onChange={v=>alter({frameRate:v})}/>
   <CheckSetting name="IR illuminator" disabled={disabled} checked={camera.infraredEnabled!==false} onChange={v=>alter({infraredEnabled:v})}/>
   {signalOf(camera)==='analog'&&<CheckSetting name="12 V adapter connected" disabled={disabled} checked={camera.analogPowerConnected!==false} onChange={v=>alter({analogPowerConnected:v})}/>}
   <p className="editor-muted">Calculated field of view: {fovOf(camera).toFixed(1)}°. Effective video load: {bitrateOf(camera).toFixed(2)} Mb/s. {supportedResolution(camera)?'Resolution supported by the simulated sensor.':'⚠ Resolution exceeds sensor capability.'} Codec, frame rate and resolution adjust simulated bitrate, storage and recorder bandwidth. Night visibility depends on IR and PoE headroom.</p>
  </div>
  {spec.isPTZ&&<><div className="section-heading">PTZ CONTROL & PRESETS</div><div className="fields">
   <NumberSetting name="Pan / heading (°)" min={0} max={359} disabled={disabled} value={camera.heading} onChange={v=>alter(ptzPresetFields(camera,v,camera.opticalZoom||1,camera.tiltDegrees||0))}/>
   <NumberSetting name="Tilt angle (°)" min={-60} max={60} disabled={disabled} value={camera.tiltDegrees||0} onChange={v=>alter(ptzPresetFields(camera,camera.heading,camera.opticalZoom||1,v))}/>
   <NumberSetting name="Optical zoom (×)" min={1} max={spec.maxZoom||20} step={0.5} disabled={disabled} value={camera.opticalZoom||1} onChange={v=>alter(ptzPresetFields(camera,camera.heading,v,camera.tiltDegrees||0))}/>
   <button disabled={disabled||presets.length>=8} onClick={capturePreset}>Save current PTZ preset</button>
   {presets.map(p=><div key={p.id} className="cctv-preset"><span>{p.name} · {p.heading.toFixed(0)}° · {p.opticalZoom}×</span><button disabled={disabled} onClick={()=>alter(ptzPresetFields(camera,p.heading,p.opticalZoom,p.tiltDegrees))}>Recall</button><button disabled={disabled} title="Delete preset" onClick={()=>alter({ptzPresets:presets.filter(x=>x.id!==p.id)})}>×</button></div>)}
   <p className="editor-muted">PTZ is simulated as immediate pan/tilt/zoom settings. No real motors or 3D video are emulated.</p>
  </div></>}
  <div className="section-heading">RECORDING & EVENT RULES</div><div className="fields">
   <label className="prop-field"><span>Recording mode</span><select disabled={disabled} value={modeOf(camera)} onChange={e=>{const recordingMode=e.target.value as RecordingMode;alter({recordingMode,recordingEnabled:recordingMode!=='off'});}}>
    <option value="motion">Motion activated</option><option value="continuous">Continuous</option><option value="scheduled">Scheduled (continuous in window)</option><option value="off">Disabled</option>
   </select></label>
   <NumberSetting name="Motion sensitivity (%)" min={0} max={100} disabled={disabled} value={camera.motionSensitivity??50} onChange={v=>alter({motionSensitivity:v})}/>
   {modeOf(camera)==='scheduled'&&<><NumberSetting name="Schedule begins (hour)" disabled={disabled} min={0} max={23} value={Math.floor(sch.startMinute/60)} onChange={v=>alter({recordingSchedule:{...sch,startMinute:v*60}})}/>
    <NumberSetting name="Schedule ends (hour; 24 = midnight)" min={0} max={24} disabled={disabled} value={Math.floor(sch.endMinute/60)} onChange={v=>alter({recordingSchedule:{...sch,endMinute:v*60}})}/>
    <div className="weekday-row"><span>Active days (Mon → Sun)</span>{['M','T','W','T','F','S','S'].map((label,i)=><label key={i} title={['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][i]}><input type="checkbox" checked={sch.days.includes(i)} disabled={disabled} onChange={e=>alter({recordingSchedule:{...sch,days:e.target.checked?[...sch.days,i].sort():sch.days.filter(d=>d!==i)}})}/>{label}</label>)}</div>
   </>}
   <p className="editor-muted">Virtual time: {clockLabel(w.project)}. Recorder channel: {s?.channel??'—'} · {s?.recorderId?w.project.devices.find(d=>d.id===s.recorderId)?.name||s.recorderId:'not assigned'}.</p>
  </div>
  <div className="section-heading">MOTION DETECTION ZONES</div><div className="fields">
   <button disabled={disabled||zones.length>=8} onClick={addZone}>+ Add rectangular detection zone</button>
   {zones.length===0&&<p className="editor-muted">Without zones, the entire visible camera field is eligible for motion detection. Zones are drawn in amber while this camera is selected.</p>}
   {zones.map(z=><div className="cctv-zone" key={z.id}>
    <label className="prop-field"><span>Zone name</span><input disabled={disabled} value={z.name} maxLength={64} onChange={e=>updateZone(z.id,{name:e.target.value})}/></label>
    <CheckSetting name="Zone active" checked={z.enabled} disabled={disabled} onChange={v=>updateZone(z.id,{enabled:v})}/>
    <div className="cctv-zone-grid">{(['x','y','w','h'] as const).map(k=><NumberSetting key={k} name={k.toUpperCase()} min={k==='w'||k==='h'?1:0} max={k==='w'?1000:k==='h'?650:k==='x'?1000:650} value={z[k]} disabled={disabled} onChange={v=>updateZone(z.id,{[k]:v})}/>)}</div>
    <button disabled={disabled} onClick={()=>alter({motionZones:zones.filter(v=>v.id!==z.id)})}>Remove zone</button>
   </div>)}
  </div>
 </>;
}
export function RecorderSettings({w,device}:{w:Workbench;device:Device}){
 const recorderSpec=profile(device.profileId);const result=w.result.recorders[device.id],isDvr=recorderSpec.kind==='dvr';
 const update=(fields:Partial<Device>)=>w.update(device.id,fields);
 return <><div className="section-heading">{isDvr?'ANALOG DVR':'IP NVR'} — CHANNELS & DISK</div><div className="fields">
  <NumberSetting name="Installed disk (GB)" min={0} max={recorderSpec.maxInstalledStorageGB||100000} disabled={w.blocked} value={device.storageGB||0} onChange={v=>update({storageGB:v})}/>
  <NumberSetting name="Used disk (GB)" min={0} max={Math.max(100000,device.storageGB||0)} disabled={w.blocked} value={device.usedGB||0} onChange={v=>update({usedGB:v})}/>
  <NumberSetting name="Incoming video budget (Mb/s)" min={0} max={recorderSpec.manufacturerSpec?recorderSpec.maxIncomingMbps||0:1000} disabled={w.blocked} value={recorderBandwidth(device)} onChange={v=>update({incomingMbps:v})}/>
  <CheckSetting name="Simulate drive failure" checked={!!device.storageFailed} disabled={w.blocked} onChange={v=>update({storageFailed:v})}/>
  <div className="recorder-summary"><strong>{result?.channelsUsed||0} / {result?.channelsTotal||0} channels used</strong><span>{(result?.bandwidthUsedMbps||0).toFixed(2)} / {(result?.bandwidthLimitMbps||0).toFixed(2)} Mb/s</span><span>{(result?.freeGB||0).toFixed(2)} GB free</span><span>Conservative continuous retention: {(result?.estimatedRetentionHours||0).toFixed(1)} h</span></div>
  {result?.cameras.map((camId,index)=><p className="recorder-channel" key={camId}>CH {index+1} · {w.project.devices.find(d=>d.id===camId)?.name||camId}</p>)}
  {result?.faults.map(f=><p className="warning-line" key={f}>⚠ {f}</p>)}
  <p className="editor-muted">No real codecs, digital video capture or physical DVR/NVR firmware. Retention is a bitrate/storage estimate; overhead and motion duty cycle are excluded.</p>
 </div></>;
}
