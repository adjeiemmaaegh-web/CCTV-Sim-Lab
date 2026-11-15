import React,{useMemo,useState} from 'react';
import type {Workbench} from '../../hooks/useWorkbench.js';
import type {Environment,Weather} from '../../../../src/domain/types.js';
import {profile} from '../../../../src/domain/catalog.js';
import {cameraView} from '../../../../src/tools/cameraView.js';
import {analyseCamera,anprCheck,camerasForWidth,PPM_BANDS,HORIZONTAL_PIXELS,focalLengthMm,pixelsPerMetre,scaleFromReference} from '../../../../src/tools/lens.js';
import {analyseCables,dcDrop,minimumAwg,poeDelivery,OHM_PER_M} from '../../../../src/tools/cableEng.js';
import {DUTY,diskFailureOutcome,planFromProject,type Raid} from '../../../../src/tools/storage.js';
import {DEFAULT_ENVIRONMENT,describeEnvironment} from '../../../../src/engine/environment.js';

const cameras=(w:Workbench)=>w.project.devices.filter(d=>profile(d.profileId).kind==='camera');
const num=(s:string,fallback:number)=>{const n=Number(s);return Number.isFinite(n)?n:fallback;};

/** Feature 3: ray-cast camera view strip. */
export function CameraViewPanel({w}:{w:Workbench}){
 const cams=cameras(w);const [id,setId]=useState('');const cid=id||cams[0]?.id;
 const view=useMemo(()=>{try{return cid?cameraView(w.project,cid,72):null;}catch{return null;}},[w.project,cid]);
 if(!cams.length)return <section className="tool-panel"><p className="editor-muted">Install a camera to see its simulated view.</p></section>;
 const W=720,H=180;
 return <section className="tool-panel" aria-label="Simulated camera view">
  <div className="tool-row"><label>Camera <select aria-label="View camera" value={cid} onChange={e=>setId(e.currentTarget.value)}>{cams.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <span className="editor-muted">{view?`FOV ${view.fovDeg.toFixed(0)}° · range ${view.rangeUnits.toFixed(0)} units · ${view.night?(view.infrared?'night / IR':'night / no IR'):'day'}`:''}</span></div>
  {view&&<><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Schematic first-person camera view. Taller bars are nearer walls; markers are targets." className="camera-strip">
   <rect width={W} height={H} fill="#06101c"/>
   {view.columns.map((c,i)=>{const bw=W/view.columns.length,max=Math.max(1,view.rangeUnits),h=c.hitWall?Math.min(H,H*0.95*(1-c.distance/max)+14):6,g=Math.round(255*c.brightness);
    return <rect key={i} x={i*bw} y={(H-h)/2} width={bw+0.5} height={h} fill={c.hitWall?`rgb(${g*0.4|0},${g*0.7|0},${g|0})`:'#0f2a3d'}/>;})}
   {view.targets.filter(t=>t.visible).map(t=>{const x=W*(0.5+t.angleDeg/view.fovDeg);return <g key={t.id}><line x1={x} x2={x} y1={10} y2={H-10} stroke="#51d3d0" strokeDasharray="3 3"/><text x={x+4} y={22} fill="#51d3d0" fontSize="11">{t.name}</text></g>;})}
  </svg>
  <ul className="target-list">{view.targets.map(t=><li key={t.id} className={t.visible?'good':'warning-line'}>{t.name}: {t.visible?`in view (${t.distance.toFixed(0)} units)`:t.reason}</li>)}</ul>
  {view.notes.map((n,i)=><p key={i} className="editor-muted">{n}</p>)}</>}
  <p className="editor-muted">Schematic ray-cast view for training; windows and doors are treated as see-through. Not video.</p>
 </section>;
}

/** Feature 4: lens / pixel-density calculator. */
export function LensPanel({w}:{w:Workbench}){
 const cams=cameras(w);const [id,setId]=useState('');const cam=cams.find(c=>c.id===id)||cams[0];
 const [dist,setDist]=useState('10');const [width,setWidth]=useState('40');const [sensor,setSensor]=useState('6.4');
 const d=Math.max(0.5,num(dist,10));
 const a=cam?analyseCamera(cam,d):null;
 const px=cam?(HORIZONTAL_PIXELS[cam.resolution||'1080p']??1920):1920,fov=cam?.fov??90;
 let count:number|string='—';try{count=camerasForWidth(Math.max(1,num(width,40)),fov,d);}catch{count='—';}
 return <section className="tool-panel" aria-label="Lens calculator">
  <div className="tool-row">{cams.length>0&&<label>Camera <select aria-label="Lens camera" value={cam?.id} onChange={e=>setId(e.currentTarget.value)}>{cams.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
   <label>Target distance (m) <input aria-label="Target distance" inputMode="decimal" value={dist} onChange={e=>setDist(e.currentTarget.value)}/></label>
   <label>Width to cover (m) <input aria-label="Width to cover" inputMode="decimal" value={width} onChange={e=>setWidth(e.currentTarget.value)}/></label>
   <label>Sensor width (mm) <input aria-label="Sensor width" inputMode="decimal" value={sensor} onChange={e=>setSensor(e.currentTarget.value)}/></label></div>
  {cam?<>
   <p><b>{pixelsPerMetre(px,fov,d).toFixed(0)} px/m</b> at {d} m → <b>{a!.band==='none'?'below detection':PPM_BANDS.find(b=>b.id===a!.band)!.label}</b> · scene width {(2*d*Math.tan(fov*Math.PI/360)).toFixed(1)} m</p>
   <table className="tool-table"><thead><tr><th>Band</th><th>px/m</th><th>Max distance</th></tr></thead><tbody>{a!.zones.map(z=><tr key={z.id}><td>{z.label}</td><td>{z.ppm}</td><td>{z.maxDistanceM.toFixed(1)} m</td></tr>)}</tbody></table>
   <p>Cameras needed to cover {width} m at {d} m with 10% overlap: <b>{count}</b> · lens for this FOV on a {sensor} mm sensor: <b>{focalLengthMm(Math.max(1,num(sensor,6.4)),fov).toFixed(2)} mm</b></p>
  </>:<p className="editor-muted">Install a camera to analyse its pixel density.</p>}
  <p className="editor-muted">Bands: detect 25, observe 62, recognise 125, identify 250 px/m (training guidance; follow the governing standard for real designs).</p>
 </section>;
}

/** Feature 5: cable engineering checks. */
export function CablePanel({w}:{w:Workbench}){
 const findings=useMemo(()=>analyseCables(w.project),[w.project]);
 const [v,setV]=useState('12');const [a,setA]=useState('0.5');const [len,setLen]=useState('50');const [awg,setAwg]=useState('22');
 const volts=num(v,12),amps=Math.max(0,num(a,0.5)),length=Math.max(0,num(len,50));
 const drop=OHM_PER_M[Number(awg)]?dcDrop(volts,amps,length,Number(awg)):null;const min=minimumAwg(volts,amps,length);
 const poe=poeDelivery(12.95,Math.max(1,length));
 const name=(id:string)=>w.project.devices.find(d=>d.id===id)?.name||id;
 return <section className="tool-panel" aria-label="Cable engineering">
  <table className="tool-table"><thead><tr><th>Cable</th><th>Medium</th><th>Length</th><th>Result</th></tr></thead>
   <tbody>{findings.length?findings.map(f=>{const c=w.project.cables.find(x=>x.id===f.cableId)!;return <tr key={f.cableId} className={f.ok?'':'warning-line'}><td>{name(c.a)} ↔ {name(c.b)}</td><td>{f.medium}</td><td>{f.lengthM.toFixed(0)} m</td><td>{f.ok?'PASS':'FAIL'} — {f.messages.join('; ')}{f.pdVolts?` (${f.pdVolts.toFixed(1)} V at device)`:''}</td></tr>;}):<tr><td colSpan={4}>No cables yet.</td></tr>}</tbody></table>
  <h4>DC voltage-drop calculator</h4>
  <div className="tool-row"><label>Supply (V) <input aria-label="Supply volts" value={v} onChange={e=>setV(e.currentTarget.value)}/></label><label>Load (A) <input aria-label="Load amps" value={a} onChange={e=>setA(e.currentTarget.value)}/></label><label>Length (m) <input aria-label="Run length" value={len} onChange={e=>setLen(e.currentTarget.value)}/></label>
   <label>AWG <select aria-label="Conductor gauge" value={awg} onChange={e=>setAwg(e.currentTarget.value)}>{Object.keys(OHM_PER_M).map(g=><option key={g}>{g}</option>)}</select></label></div>
  {drop&&<p className={drop.ok?'good':'warning-line'}>Drop {drop.dropV.toFixed(2)} V ({drop.dropPercent.toFixed(1)}%) → {drop.atLoadV.toFixed(2)} V at load · {drop.ok?'within 10%':'exceeds 10%'} · minimum gauge: {min?`${min} AWG`:'none of the listed gauges suffice'}</p>}
  <p className="editor-muted">A 12.95 W (802.3af) camera at {Math.max(1,length)} m over 24 AWG: {poe.ok?`${poe.pdVolts.toFixed(1)} V at the device — OK`:poe.reason}.</p>
 </section>;
}

/** Feature 6: storage and RAID planner. */
export function StoragePanel({w}:{w:Workbench}){
 const [days,setDays]=useState('14');const [raid,setRaid]=useState<Raid>('raid5');const [disks,setDisks]=useState('4');const [tb,setTb]=useState('4');const [failed,setFailed]=useState('0');
 let plan:ReturnType<typeof planFromProject>|null=null,error='';
 try{plan=planFromProject(w.project,Math.max(1,num(days,14)),raid,Math.max(1,Math.round(num(disks,4))),Math.max(0.1,num(tb,4)));}catch(e){error=String((e as Error).message);}
 const outcome=diskFailureOutcome(raid,Math.max(1,Math.round(num(disks,4))),Math.max(0,Math.round(num(failed,0))));
 return <section className="tool-panel" aria-label="Storage planner">
  <div className="tool-row"><label>Retention (days) <input aria-label="Retention days" value={days} onChange={e=>setDays(e.currentTarget.value)}/></label>
   <label>RAID <select aria-label="RAID level" value={raid} onChange={e=>setRaid(e.currentTarget.value as Raid)}>{['none','raid0','raid1','raid5','raid6','raid10'].map(r=><option key={r}>{r}</option>)}</select></label>
   <label>Disks <input aria-label="Disk count" value={disks} onChange={e=>setDisks(e.currentTarget.value)}/></label>
   <label>Disk size (TB) <input aria-label="Disk size TB" value={tb} onChange={e=>setTb(e.currentTarget.value)}/></label>
   <label>Failed disks <input aria-label="Failed disks" value={failed} onChange={e=>setFailed(e.currentTarget.value)}/></label></div>
  {error&&<p className="warning-line">{error}</p>}
  {plan&&<><p><b>{plan.cameras.length}</b> camera(s) · <b>{plan.gbPerDay.toFixed(0)} GB/day</b> · need <b>{(plan.neededGB/1000).toFixed(2)} TB</b> for {days} days (+10% overhead) · usable <b>{(plan.usableGB/1000).toFixed(1)} TB</b> → <span className={plan.ok?'good':'warning-line'}>{plan.ok?'sufficient':'INSUFFICIENT'}</span> ({Number.isFinite(plan.daysAchievable)?plan.daysAchievable.toFixed(1):'∞'} days achievable{plan.disksForNeed?`, ${plan.disksForNeed} disks needed`:''})</p>
   <p>Inbound video load: {plan.peakInboundMbps.toFixed(1)} Mb/s. Duty factors: continuous {DUTY.continuous}, motion {DUTY.motion}, scheduled {DUTY.scheduled}.</p></>}
  <p className={outcome.state==='healthy'?'good':outcome.state==='degraded'?'warning-line':'warning-line'}>{outcome.message}</p>
 </section>;
}

/** Feature 7: environment effects. */
export function EnvironmentPanel({w}:{w:Workbench}){
 const env=w.project.environment??DEFAULT_ENVIRONMENT;
 const set=(next:Partial<Environment>)=>w.commit({...w.project,environment:{...env,...next}},'Environment updated');
 return <section className="tool-panel" aria-label="Environment">
  <div className="tool-row"><label>Weather <select aria-label="Weather" value={env.weather} disabled={w.blocked} onChange={e=>set({weather:e.currentTarget.value as Weather})}>{['clear','rain','fog','dust'].map(x=><option key={x}>{x}</option>)}</select></label>
   <label>Ambient °C <input aria-label="Ambient temperature" type="number" min={-40} max={70} value={env.ambientC} disabled={w.blocked} onChange={e=>{const n=Number(e.currentTarget.value);if(Number.isFinite(n)&&n>=-40&&n<=70)set({ambientC:n});}}/></label>
   <label><input type="checkbox" checked={env.glare} disabled={w.blocked} onChange={e=>set({glare:e.currentTarget.checked})}/> Sun glare (daytime)</label></div>
  <ul>{describeEnvironment(env,w.project.night).map((l,i)=><li key={i}>{l}</li>)}</ul>
  <p className="editor-muted">Simplified training heuristics: they change simulated camera range, PIR range and battery capacity. They do not model real optics or chemistry.</p>
 </section>;
}

/** Feature 13 (ANPR): plate-read feasibility. */
export function AnprPanel({w}:{w:Workbench}){
 const cams=cameras(w);const [id,setId]=useState('');const cam=cams.find(c=>c.id===id)||cams[0];
 const [dist,setDist]=useState('10');const [speed,setSpeed]=useState('15');const [angle,setAngle]=useState('10');const [shutter,setShutter]=useState('1000');
 const px=cam?(HORIZONTAL_PIXELS[cam.resolution||'1080p']??1920):2560,fov=cam?.fov??28;
 let r:ReturnType<typeof anprCheck>|null=null,err='';
 try{r=anprCheck(px,fov,Math.max(0.5,num(dist,10)),Math.max(0,num(speed,15)),Math.min(89,Math.max(0,num(angle,10))),1/Math.max(1,num(shutter,1000)));}catch(e){err=(e as Error).message;}
 return <section className="tool-panel" aria-label="ANPR check">
  {cams.length>0&&<div className="tool-row"><label>Camera <select aria-label="ANPR camera" value={cam?.id} onChange={e=>setId(e.currentTarget.value)}>{cams.map(c=><option key={c.id} value={c.id}>{c.name} ({c.fov}°)</option>)}</select></label></div>}
  <div className="tool-row"><label>Distance (m) <input aria-label="ANPR distance" value={dist} onChange={e=>setDist(e.currentTarget.value)}/></label><label>Vehicle speed (km/h) <input aria-label="ANPR speed" value={speed} onChange={e=>setSpeed(e.currentTarget.value)}/></label>
   <label>Angle to plate (°) <input aria-label="ANPR angle" value={angle} onChange={e=>setAngle(e.currentTarget.value)}/></label><label>Shutter 1/<input aria-label="ANPR shutter" value={shutter} onChange={e=>setShutter(e.currentTarget.value)}/></label></div>
  {err&&<p className="warning-line">{err}</p>}
  {r&&<><p className={r.ok?'good':'warning-line'}><b>{r.ok?'Plate read feasible':'Plate read NOT reliable'}</b> — {r.platePixels.toFixed(0)} px across the plate, blur ≈ {r.blurPx.toFixed(1)} px, maximum distance at this angle {r.maxDistanceM.toFixed(1)} m</p>
   {r.reasons.map((x,i)=><p key={i} className="warning-line">• {x}</p>)}</>}
  <p className="editor-muted">Training guidance: a plate is about 0.52 m wide and readers usually need about 130 px across it. Use the ANPR camera profile (narrow field of view) from the Equipment Library.</p>
 </section>;
}

/** Feature 16: plan scale calibration from a known reference distance (manual; no automatic image measuring). */
export function ScalePanel({w}:{w:Workbench}){
 const [v,setV]=useState({ax:'0',ay:'0',bx:'300',by:'0',m:'30'});
 const set=(k:keyof typeof v,x:string)=>setV(s=>({...s,[k]:x}));
 let result:number|null=null,err='';try{result=scaleFromReference(num(v.ax,0),num(v.ay,0),num(v.bx,0),num(v.by,0),num(v.m,0));}catch(e){err=(e as Error).message;}
 const current=w.project.unitsPerMeter??10;
 return <section className="tool-panel" aria-label="Plan scale">
  <p>Current scale: <b>{current} plan units per metre</b>. Measure two points on your floor plan (units shown in the Measure tool) whose real distance you know.</p>
  <div className="tool-row">{(['ax','ay','bx','by'] as const).map(k=><label key={k}>{k.toUpperCase()} <input aria-label={`Scale ${k}`} value={v[k]} onChange={e=>set(k,e.currentTarget.value)}/></label>)}
   <label>Real distance (m) <input aria-label="Scale real distance" value={v.m} onChange={e=>set('m',e.currentTarget.value)}/></label></div>
  {err?<p className="warning-line">{err}</p>:<p>Result: <b>{result!.toFixed(2)} units/m</b></p>}
  <button disabled={w.blocked||!!err} onClick={()=>w.setPropertyScale(Math.round(result!*100)/100)}>Apply scale</button>
  <p className="editor-muted">The scale is entered manually; the app does not measure images automatically. Changing it recalculates cable lengths.</p>
 </section>;
}
