import React,{useRef,useState} from 'react';
import {profile} from '../../../src/domain/catalog.js';
import {coveragePolygon} from '../../../src/engine/geometry.js';
import type {Point} from '../../../src/domain/types.js';
import type {Workbench} from '../hooks/useWorkbench.js';
const pt=(p:Point)=>`${p.x},${p.y}`;
export function Canvas({w}:{w:Workbench}){
 const svg=useRef<SVGSVGElement>(null),started=useRef<{start:Point;type:'device'|'wall'|'room';id?:string}|null>(null);
 const [drag,setDrag]=useState<Point|null>(null);
 const [view,setView]=useState<'floor'|'topology'>('floor'),[showCoverage,setShowCoverage]=useState(true),[zoom,setZoom]=useState(1);
 const getPoint=(e:React.PointerEvent<SVGSVGElement>):Point=>{const m=svg.current?.getScreenCTM();if(!m)return{x:0,y:0};const p=svg.current!.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(m.inverse());return{x:Math.min(1000,Math.max(0,q.x)),y:Math.min(650,Math.max(0,q.y))};};
 const onDown=(e:React.PointerEvent<SVGSVGElement>)=>{
  if(w.blocked)return;
  const el=e.target as SVGElement,d=el.closest('[data-device]') as SVGElement|null,c=el.closest('[data-cable]') as SVGElement|null;
  const p=getPoint(e);
  if(w.mode==='cable'){if(d?.dataset.device)w.selectOrCable(d.dataset.device);return;}
  if(w.mode==='test'){w.doMotion(p);return;}
  if(w.placing){w.install(w.placing,p);return;}
  if(w.mode==='wall'||w.mode==='room'){started.current={start:p,type:w.mode};setDrag(p);svg.current?.setPointerCapture(e.pointerId);return;}
  if(d?.dataset.device){w.setSelected({kind:'device',id:d.dataset.device});if(view==='floor'){started.current={start:p,type:'device',id:d.dataset.device};setDrag(p);svg.current?.setPointerCapture(e.pointerId);}return;}
  if(c?.dataset.cable){w.setSelected({kind:'cable',id:c.dataset.cable});return;}
  w.setSelected(null);
 };
 const onUp=(e:React.PointerEvent<SVGSVGElement>)=>{
  const op=started.current;started.current=null;if(!op)return;setDrag(null);
  const end=getPoint(e);if(Math.hypot(end.x-op.start.x,end.y-op.start.y)<5)return;
  if(op.type==='wall')w.addWall(op.start,end);
  if(op.type==='room')w.addRoom(op.start,end);
  if(op.type==='device'&&op.id){const old=w.project.devices.find(x=>x.id===op.id);if(old)w.update(old.id,{x:Math.min(1000,Math.max(0,old.x+end.x-op.start.x)),y:Math.min(650,Math.max(0,old.y+end.y-op.start.y))});}
 };
 const mode=(id:typeof w.mode,label:string)=> <button key={id} className={w.mode===id?'active':''} onClick={()=>{w.setMode(id);if(id!=='place')w.setPlacing(null);w.setCableStart(null);}} disabled={w.blocked}>{label}</button>;
 const isCamera=(id:string)=>profile(id).kind==='camera';
 return <section className="canvas-panel panel"><div className="panel-heading workspace-heading"><div><h2>Installation Canvas</h2><p>Place devices, connect network cabling, test coverage and resolve faults</p></div><div className="tabs"><button className={view==='floor'?'active':''} onClick={()=>setView('floor')}>Floor Plan</button><button className={view==='topology'?'active':''} onClick={()=>setView('topology')}>Network Topology</button></div></div>
 <div className="toolbar"><div className="toolgroup">{mode('select','Select')}{mode('cable','Cable')}{mode('wall','Wall')}{mode('room','Room')}{mode('test','Test Motion')}</div><div className="toolgroup"><label><input type="checkbox" checked={showCoverage} onChange={e=>setShowCoverage(e.target.checked)}/> Coverage</label><button onClick={()=>setZoom(Math.min(2,zoom*1.2))}>+</button><button onClick={()=>setZoom(Math.max(0.65,zoom/1.2))}>−</button><button onClick={()=>setZoom(1)}>Fit</button></div></div>
 <div className="canvas-body" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('application/x-securitylab-profile');if(!id||w.blocked)return;const matrix=svg.current?.getScreenCTM();if(!matrix)return;const point=svg.current!.createSVGPoint();point.x=e.clientX;point.y=e.clientY;const position=point.matrixTransform(matrix.inverse());w.install(id,{x:Math.max(0,Math.min(1000,position.x)),y:Math.max(0,Math.min(650,position.y))});}}>
 <svg ref={svg} viewBox={`${(1000-1000/zoom)/2} ${(650-650/zoom)/2} ${1000/zoom} ${650/zoom}`} role="application" aria-label="SecurityLab installation canvas; select, place, connect and test virtual devices" onPointerDown={onDown} onPointerMove={e=>{if(started.current)setDrag(getPoint(e));}} onPointerUp={onUp} onPointerCancel={()=>{started.current=null;setDrag(null);}}>
 <defs><pattern id="smallgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1b3550" strokeWidth="0.6"/></pattern></defs><rect width="1000" height="650" fill="#0b2036"/><rect width="1000" height="650" fill="url(#smallgrid)"/>
 {w.project.floorplanImage&&<image href={w.project.floorplanImage} width="1000" height="650" opacity="0.2" preserveAspectRatio="xMidYMid meet"/>}
 {w.project.rooms.map(r=><g key={r.id}><rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(17,56,81,.35)" stroke="#51758f" strokeDasharray="6 4" strokeWidth="1.5"/><text x={r.x+10} y={r.y+18} fill="#779fb9" fontSize="15">{r.name}</text></g>)}
 {w.project.walls.map(r=><line key={r.id} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={r.kind==='wall'?'#9aaebe':'#69849b'} strokeWidth={r.kind==='wall'?5:2} />)}
 {showCoverage&&view==='floor'&&w.project.devices.filter(d=>isCamera(d.profileId)).map(d=>{
    const st=w.result.devices[d.id],poly=coveragePolygon(d,w.project.walls,w.project.night,30);
    return <polygon key={d.id} points={poly.map(pt).join(' ')} fill={st?.networkOk?'rgba(25,205,167,.16)':'rgba(239,123,85,.11)'} stroke={st?.networkOk?'#1c9b86':'#965d58'} strokeOpacity="0.6" strokeWidth="1"/>;
 })}
 {w.project.cables.map(c=>{
   const a=w.project.devices.find(d=>d.id===c.a),b=w.project.devices.find(d=>d.id===c.b);if(!a||!b)return null;
   const ok=w.result.cables[c.id]?.up;
   return <g key={c.id} data-cable={c.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={18}/><line pointerEvents="none" x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={ok?'#38baf2':'#e77874'} strokeDasharray={c.connected?'0':'6 5'} strokeWidth={3}/></g>;
 })}
 {w.project.targets.map(t=>{
   const covered=w.result.coverage.find(c=>c.id===t.id)?.covered;
   return <g key={t.id} transform={`translate(${t.x} ${t.y})`}><circle r="11" fill="#1f2937" stroke={covered?'#18cca9':'#f4a04d'} strokeWidth="2"/><circle r="4" fill={covered?'#18cca9':'#f4a04d'}/><text x="12" y="-14" fontSize="12" fill="#bfd3de">{t.name}</text></g>;
 })}
 {w.project.devices.map(d=>{
  const kind=profile(d.profileId).kind,st=w.result.devices[d.id],on=st?.networkOk||kind==='switch'&&st?.powered||kind==='nvr'&&st?.powered;
  const x=drag&&started.current?.id===d.id?d.x+drag.x-started.current.start.x:d.x;
  const y=drag&&started.current?.id===d.id?d.y+drag.y-started.current.start.y:d.y;
  return <g data-device={d.id} tabIndex={0} role="button" aria-label={`${d.name} ${on?'online':'offline'}`} key={d.id} transform={`translate(${x} ${y})`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();w.selectOrCable(d.id);}}}>
   <circle r="18" fill="#0b2841" stroke={w.selected?.id===d.id?'#fff':on?'#33dbba':'#f2a566'} strokeWidth={3}/><text pointerEvents="none" textAnchor="middle" y="5" fill="#fff" fontSize="18">{kind==='camera'?'◉':kind==='switch'?'▤':'▣'}</text><text pointerEvents="none" textAnchor="middle" y="37" fontSize="11" fill="#d8eaf5">{d.name}</text>
  </g>;
 })}
 {view==='topology'&&<g className="topology-layer">
 <rect width="1000" height="650" fill="#0d2035"/>
 <text x="40" y="55" fill="#91bcd2" fontSize="21">Network graph · actual cable endpoints</text>
 {w.project.cables.map(c=>{
  const a=w.project.devices.find(d=>d.id===c.a),b=w.project.devices.find(d=>d.id===c.b);if(!a||!b)return null;
  const locate=(d:typeof a)=>{const list=w.project.devices.filter(v=>profile(v.profileId).kind===profile(d.profileId).kind);const index=list.findIndex(v=>v.id===d.id);const k=profile(d.profileId).kind;return{x:k==='camera'?170:k==='switch'?500:830,y:160+index*(380/Math.max(1,list.length-1))};};
  const p1=locate(a),p2=locate(b),up=w.result.cables[c.id]?.up;
  return <g key={c.id} data-cable={c.id}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="25"/><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={up?'#35bded':'#d97477'} strokeWidth="3" pointerEvents="none"/></g>;
 })}
 {w.project.devices.map(d=>{const group=w.project.devices.filter(v=>profile(v.profileId).kind===profile(d.profileId).kind);const index=group.findIndex(v=>v.id===d.id),k=profile(d.profileId).kind;
  const x=k==='camera'?170:k==='switch'?500:830,y=160+index*(380/Math.max(1,group.length-1));
  return <g key={d.id} data-device={d.id} transform={`translate(${x} ${y})`} tabIndex={0} role="button" aria-label={`${d.name} topology device`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();w.selectOrCable(d.id);}}}>
   <rect x="-65" y="-31" width="130" height="62" rx="9" fill="#16364f" stroke={w.result.devices[d.id]?.networkOk?'#21ceaf':'#ca8b57'} strokeWidth="2"/>
   <text y="-7" fill="#d8f2f6" fontSize="14" pointerEvents="none" textAnchor="middle">{k==='camera'?'CAMERA':k==='switch'?'PoE SWITCH':'NVR'}</text>
   <text y="13" fill="#94b4c9" fontSize="11" pointerEvents="none" textAnchor="middle">{d.name.slice(0,22)}</text>
  </g>;
 })}
 </g>}
 {started.current&&drag&&(started.current.type==='wall'||started.current.type==='room')&& (started.current.type==='wall'?<line x1={started.current.start.x} y1={started.current.start.y} x2={drag.x} y2={drag.y} stroke="#fff" strokeDasharray="4 4" strokeWidth={3}/>:<rect x={Math.min(started.current.start.x,drag.x)} y={Math.min(started.current.start.y,drag.y)} width={Math.abs(started.current.start.x-drag.x)} height={Math.abs(started.current.start.y-drag.y)} fill="#1b9d9d22" stroke="#fff" strokeDasharray="4 4"/>)}
 </svg>
 <div className="canvas-hint">{w.mode==='cable'?'Select two device endpoints for a cable':w.mode==='test'?'Click on the plan to simulate movement':w.placing?'Click to place selected equipment':'Drag devices; select a device to inspect and configure'}</div>
 </div><div className="canvas-status"><span>CAMERAS {w.result.requiredCameras}</span><span>ONLINE {w.result.onlineCameras}</span><span>RECORDING {w.result.recordingCameras}</span><span>TARGETS {w.result.coverage.filter(x=>x.covered).length}/{w.result.coverage.length}</span><span className="good">{w.project.night?'NIGHT':'DAY'} · {w.project.mainsOn?'AC ONLINE':'AC OFF'}</span></div>
 </section>;
}
