import React,{useEffect,useMemo,useRef,useState} from 'react';
import {profile} from '../../../src/domain/catalog.js';
import {coveragePolygon} from '../../../src/engine/geometry.js';
import {adjustDevice} from '../../../src/engine/environment.js';
import {floorView,hasFloors} from '../../../src/tools/floors.js';
import {FloorBar} from './FloorBar.js';
import {Icon} from './icons.js';
import {signalOf,mediumOf} from '../../../src/engine/cctv.js';
import {PLAN_WIDTH,PLAN_HEIGHT,snapped,bounded,distance,distanceMeters,scaleOf,clamp,transformRoomWalls} from '../../../src/property/editor.js';
import type {Point,Wall,Device} from '../../../src/domain/types.js';
import type {PropertyTemplate} from '../../../src/property/editor.js';
import type {Workbench,Mode} from '../hooks/useWorkbench.js';

type View='floor'|'topology';
type LayerName='rooms'|'walls'|'targets'|'site'|'coverage'|'zones'|'alarm'|'access'|'power'|'grid'|'image';
type Gesture=
 |{kind:'draw';tool:'wall'|'room'|'measure';start:Point}
 |{kind:'pan';client:Point;center:Point;rect:{width:number;height:number}}
 |{kind:'move';entity:'device'|'room'|'wall'|'target'|'site'|'reference';id:string;start:Point}
 |{kind:'resize-room';id:string;start:Point}
 |{kind:'wall-handle';id:string;handle:'start'|'end';start:Point};
const fmt=(p:Point)=>`${p.x},${p.y}`;
const label=(mode:Mode)=>({select:'Select',place:'Place',cable:'Cable',wall:'Wall',room:'Room',door:'Door',window:'Window',gate:'Gate',entrance:'Entrance',label:'Label',measure:'Measure',pan:'Pan',test:'Test Motion'}[mode]);
const DEFAULT_LAYERS:Record<LayerName,boolean>={rooms:true,walls:true,targets:true,site:true,coverage:true,zones:true,alarm:true,access:true,power:true,grid:true,image:true};
const pointEqual=(a:Point,b:Point)=>Math.abs(a.x-b.x)<1&&Math.abs(a.y-b.y)<1;
const kinds:PropertyTemplate[]=['residential','apartment','retail','office','warehouse'];

export function Canvas({w:wb,focusMode,onToggleFocus}:{w:Workbench;focusMode:boolean;onToggleFocus:()=>void}){
 const viewProject=useMemo(()=>floorView(wb.project,wb.floor),[wb.project,wb.floor]);
 const w:Workbench=viewProject===wb.project?wb:{...wb,project:viewProject};
 const svg=useRef<SVGSVGElement>(null),gesture=useRef<Gesture|null>(null);
 const [preview,setPreview]=useState<Point|null>(null);
 const view:View=wb.view,setView=wb.setView;
 const [layers,setLayers]=useState(DEFAULT_LAYERS),[snap,setSnap]=useState(true);
 const [zoom,setZoom]=useState(1),[center,setCenter]=useState<Point>({x:500,y:325});
 const [template,setTemplate]=useState<PropertyTemplate>('residential');
 const [measure,setMeasure]=useState<{start:Point;end:Point}|null>(null);
 const [spaceDown,setSpaceDown]=useState(false);
 const [showOpts,setShowOpts]=useState(false);
 const [intensity,setIntensity]=useState(75);
 useEffect(()=>{
  const down=(e:KeyboardEvent)=>{if(e.code==='Space'&&!(e.target as HTMLElement)?.closest('input,textarea,select,button'))setSpaceDown(true);};
  const up=(e:KeyboardEvent)=>{if(e.code==='Space')setSpaceDown(false);};
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);
  return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);};
 },[]);
 const deviceById=useMemo(()=>new Map(w.project.devices.map(d=>[d.id,d] as const)),[w.project.devices]);
 const coverageById=useMemo(()=>new Map(w.result.coverage.map(c=>[c.id,c] as const)),[w.result.coverage]);
 // Coverage ray casts are relatively expensive: recompute only when geometry or devices change.
 // A device under active drag is computed separately for accurate live previews.
 const cameraPolygonCache=useMemo(()=>new Map(w.project.devices
  .filter(d=>profile(d.profileId).kind==='camera')
  .map(d=>[d.id,coveragePolygon(adjustDevice(w.project,d),w.project.walls,w.project.night,45)] as const)),
  [w.project.devices,w.project.walls,w.project.night,w.project.environment]);
 const alarmPolygonCache=useMemo(()=>new Map(w.project.devices
  .filter(d=>profile(d.profileId).kind==='alarm-sensor'&&profile(d.profileId).alarmSensorType==='pir')
  .map(d=>[d.id,coveragePolygon(adjustDevice(w.project,d),w.project.walls,false,36)] as const)),
  [w.project.devices,w.project.walls,w.project.environment]);
 const toggle=(layer:LayerName)=>setLayers(l=>({...l,[layer]:!l[layer]}));
 const viewWidth=PLAN_WIDTH/zoom,viewHeight=PLAN_HEIGHT/zoom;
 const viewBox=`${center.x-viewWidth/2} ${center.y-viewHeight/2} ${viewWidth} ${viewHeight}`;
 const pointFrom=(clientX:number,clientY:number):Point=>{
  const element=svg.current; if(!element)return {x:0,y:0};
  const m=element.getScreenCTM();if(!m)return {x:0,y:0};
  const pt=element.createSVGPoint();pt.x=clientX;pt.y=clientY;
  const p=pt.matrixTransform(m.inverse());return{x:p.x,y:p.y};
 };
 const fromEvent=(e:React.PointerEvent<SVGSVGElement>)=>pointFrom(e.clientX,e.clientY);
 const editable=(point:Point)=>snapped(point,snap&&!spaceDown&&view==='floor');
 const begin=(op:Gesture,e:React.PointerEvent<SVGSVGElement>)=>{gesture.current=op;setPreview(op.kind==='pan'?null:op.start);e.currentTarget.setPointerCapture(e.pointerId);};
 const onDown=(e:React.PointerEvent<SVGSVGElement>)=>{
  if(e.button!==0&&e.button!==1)return;
  const point=fromEvent(e);
  if(w.mode==='pan'||spaceDown||e.button===1){
   const rect=e.currentTarget.getBoundingClientRect();begin({kind:'pan',client:{x:e.clientX,y:e.clientY},center:{...center},rect:{width:rect.width,height:rect.height}},e);return;
  }
  if(view==='topology'){
   const el=e.target as Element,d=el.closest('[data-device]'),c=el.closest('[data-cable]');
   if(w.blocked)return;
   if(d){w.selectOrCable(d.getAttribute('data-device')!);return;}
   if(c)w.setSelected({kind:'cable',id:c.getAttribute('data-cable')!});
   return;
  }
  if(w.blocked)return;
  const el=e.target as Element;
  const device=el.closest('[data-device]'),cable=el.closest('[data-cable]');
  if(w.mode==='cable'){if(device)w.selectOrCable(device.getAttribute('data-device')!);return;}
  if(w.mode==='test'){w.doMotion(bounded(point),intensity);return;}
  if(w.placing){w.install(w.placing,editable(point));return;}
  if(w.mode==='door'||w.mode==='window'){w.addOpening(point,w.mode);return;}
  if(w.mode==='gate'||w.mode==='entrance'||w.mode==='label'){w.addSiteElement(editable(point),w.mode);return;}
  if(w.mode==='wall'||w.mode==='room'||w.mode==='measure'){begin({kind:'draw',tool:w.mode,start:editable(point)},e);return;}
  const roomHandle=el.closest('[data-room-handle]'),wallHandle=el.closest('[data-wall-handle]');
  if(roomHandle){const id=roomHandle.getAttribute('data-room')!;w.setSelected({kind:'room',id});begin({kind:'resize-room',id,start:editable(point)},e);return;}
  if(wallHandle){const id=wallHandle.getAttribute('data-wall')!,handle=wallHandle.getAttribute('data-wall-handle') as 'start'|'end';
   w.setSelected({kind:'wall',id});begin({kind:'wall-handle',id,handle,start:editable(point)},e);return;
  }
  const site=el.closest('[data-site]'),target=el.closest('[data-target]'),wall=el.closest('[data-wall]'),room=el.closest('[data-room]'),reference=el.closest('[data-reference]');
  const found=([['device',device,'data-device'],['site',site,'data-site'],['target',target,'data-target'],['wall',wall,'data-wall'],['room',room,'data-room'],['reference',reference,'data-reference']] as const)
   .find(([,item])=>item);
  if(found){const [entity,node,key]=found;const id=node!.getAttribute(key)!;
   w.setSelected({kind:entity,id});begin({kind:'move',entity,id,start:editable(point)},e);return;
  }
  if(cable){w.setSelected({kind:'cable',id:cable.getAttribute('data-cable')!});return;}
  w.setSelected(null);
 };
 const onMove=(e:React.PointerEvent<SVGSVGElement>)=>{
  const op=gesture.current;if(!op)return;
  if(op.kind==='pan'){
   const rx=PLAN_WIDTH/(zoom*Math.max(1,op.rect.width)),ry=PLAN_HEIGHT/(zoom*Math.max(1,op.rect.height));
   setCenter({x:op.center.x-(e.clientX-op.client.x)*rx,y:op.center.y-(e.clientY-op.client.y)*ry});return;
  }
  setPreview(editable(fromEvent(e)));
 };
 const onUp=(e:React.PointerEvent<SVGSVGElement>)=>{
  const op=gesture.current;gesture.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  if(!op)return;
  const end=editable(fromEvent(e));setPreview(null);
  if(op.kind==='pan')return;
  if(op.kind==='draw'){
   if(op.tool==='measure'){setMeasure({start:op.start,end});return;}
   if(distance(op.start,end)<8)return;
   if(op.tool==='wall')w.addWall(op.start,end);else w.addRoom(op.start,end);
   return;
  }
  if(distance(op.start,end)<2)return;
  const delta={x:end.x-op.start.x,y:end.y-op.start.y};
  if(op.kind==='resize-room'){const room=w.project.rooms.find(r=>r.id===op.id);if(room)w.resizeSelectedRoom(op.id,{x:room.x+room.w+delta.x,y:room.y+room.h+delta.y});return;}
  if(op.kind==='wall-handle'){
   const wall=w.project.walls.find(r=>r.id===op.id);if(wall){const anchor=op.handle==='start'?{x:wall.x1,y:wall.y1}:{x:wall.x2,y:wall.y2};w.editWallEndpoint(op.id,op.handle,{x:anchor.x+delta.x,y:anchor.y+delta.y});}return;
  }
  if(op.entity==='device'){
   const device=w.project.devices.find(d=>d.id===op.id);if(device)w.moveDevice(device.id,{x:device.x+delta.x,y:device.y+delta.y});
  }else if(op.entity==='room')w.moveRoom(op.id,delta.x,delta.y);
  else if(op.entity==='wall')w.moveWall(op.id,delta.x,delta.y);
  else if(op.entity==='target'){
   const target=w.project.targets.find(t=>t.id===op.id);if(target)w.moveTarget(op.id,{x:target.x+delta.x,y:target.y+delta.y});
  }else if(op.entity==='site'){
   const site=w.project.siteElements?.find(t=>t.id===op.id);if(site)w.moveSiteElement(op.id,{x:site.x+delta.x,y:site.y+delta.y});
  }else if(op.entity==='reference'){
   const f=w.project.floorplanSettings;if(f&&!f.locked)w.setFloorplanSettings({x:f.x+delta.x,y:f.y+delta.y});
  }
 };
 const changeMode=(next:Mode)=>{w.setMode(next);if(next!=='place')w.setPlacing(null);w.setCableStart(null);};
 const modeButton=(id:Mode)=> <button key={id} className={`tool-btn ${w.mode===id?'active':''}`} aria-label={label(id)} aria-pressed={w.mode===id} title={label(id)} onClick={()=>changeMode(id)} disabled={w.blocked&&id!=='pan'}><Icon name={id==='place'?'equipment':id} size={19}/><span className="tool-label">{label(id)}</span></button>;
 const zoomTo=(next:number,anchor?:Point)=>{
  const value=clamp(next,0.5,3.5);
  if(anchor)setCenter(c=>({x:anchor.x-(anchor.x-c.x)*zoom/value,y:anchor.y-(anchor.y-c.y)*zoom/value}));
  setZoom(value);
 };
 // The native non-passive wheel listener avoids React's delegated passive wheel behaviour.
 useEffect(()=>{
  const element=svg.current;if(!element)return;
  const wheel=(e:WheelEvent)=>{
   if(!e.ctrlKey&&!e.metaKey){e.preventDefault();zoomTo(zoom*(e.deltaY<0?1.12:0.89),pointFrom(e.clientX,e.clientY));}
  };
  element.addEventListener('wheel',wheel,{passive:false});
  return()=>element.removeEventListener('wheel',wheel);
 },[zoom]);
 const fit=()=>{setZoom(1);setCenter({x:500,y:325});};
 const switchView=(next:View)=>{setView(next);fit();};
 const onDrop=(e:React.DragEvent<HTMLDivElement>)=>{
  e.preventDefault();if(view!=='floor'||w.blocked)return;
  const id=e.dataTransfer.getData('application/x-securitylab-profile');if(!id)return;
  const p=pointFrom(e.clientX,e.clientY);
  w.install(id,editable(p));
 };
 const applyTemplate=()=>{
  if(w.blocked)return;
  if(w.project.rooms.length+w.project.walls.length>0&&!window.confirm('Replace existing rooms, walls and site markers with this template? Installed equipment, cables and assessment targets will be kept.'))return;
  w.applyPropertyTemplate(template);fit();
 };
 const active=gesture.current,dx=preview&&active&&active.kind!=='pan'?preview.x-active.start.x:0,dy=preview&&active&&active.kind!=='pan'?preview.y-active.start.y:0;
 const ghost=(kind:Gesture['kind'],id?:string)=>active?.kind===kind&&(!id||('id' in active&&active.id===id));
 const offset=(kind:Gesture['kind'],id:string)=>ghost(kind,id)?{x:dx,y:dy}:{x:0,y:0};
 const previewWall=(wall:Wall):Wall=>{
  if(active?.kind==='move'&&active.entity==='room'&&wall.roomId===active.id){
   return {...wall,x1:wall.x1+dx,x2:wall.x2+dx,y1:wall.y1+dy,y2:wall.y2+dy};
  }
  if(active?.kind==='resize-room'&&wall.roomId===active.id){
   const room=w.project.rooms.find(r=>r.id===active.id);
   if(room){const after={...room,w:Math.max(20,room.w+dx),h:Math.max(20,room.h+dy)};return transformRoomWalls([wall],room,after)[0];}
  }
  if(active?.kind==='move'&&active.entity==='wall'&&active.id===wall.id)return {...wall,x1:wall.x1+dx,x2:wall.x2+dx,y1:wall.y1+dy,y2:wall.y2+dy};
  if(active?.kind==='wall-handle'&&active.id===wall.id)return active.handle==='start'?{...wall,x1:wall.x1+dx,y1:wall.y1+dy}:{...wall,x2:wall.x2+dx,y2:wall.y2+dy};
  return wall;
 };
 const isCamera=(d:Device)=>profile(d.profileId).kind==='camera';
 const isAlarm=(d:Device)=>profile(d.profileId).kind.startsWith('alarm-')||profile(d.profileId).kind.startsWith('access-');
 const topologyGroup=(d:Device)=>{const kind=profile(d.profileId).kind;return kind==='nvr'||kind==='dvr'||kind==='server'?'recorder':kind==='router'||kind==='ap'||kind==='switch'?'switch':kind;};
 const topologyPosition=(d:Device)=>{const group=topologyGroup(d),all=w.project.devices.filter(x=>!isAlarm(x)&&topologyGroup(x)===group),i=all.findIndex(x=>x.id===d.id);return{x:group==='camera'?160:group==='switch'?500:830,y:145+i*380/Math.max(1,all.length-1)};};
 const worldScale=scaleOf(w.project);
 return <section className="canvas-panel panel" id="securitylab-workspace" aria-label="Installation workspace">
  <div className="canvas-toolbar">
   <div className="view-tabs" role="group" aria-label="Plan view">
    <button className={view==='floor'?'active':''} aria-label="Floor Plan" aria-pressed={view==='floor'} onClick={()=>switchView('floor')}><Icon name="floorplan" size={18}/><span>Floor Plan</span></button>
    <button className={view==='topology'?'active':''} aria-label="Network Topology" aria-pressed={view==='topology'} onClick={()=>switchView('topology')}><Icon name="topology" size={18}/><span>Network Topology</span></button>
   </div>
   <button className="tool-btn focus-toggle" aria-label={focusMode?'Restore workstation panels':'Focus canvas'} aria-pressed={focusMode} title={focusMode?'Restore the equipment library, inspector and console':'Expand the floor-plan workspace'} onClick={onToggleFocus}><Icon name="floorplan" size={18}/><span className="focus-label">{focusMode?'Restore panels':'Focus canvas'}</span></button>
   <span className="tb-sep"/>
   <div className="toolgroup" role="toolbar" aria-label="Editing tools">{(['select','pan','room','wall','door','window','cable','measure','test'] as Mode[]).map(modeButton)}</div>
   <span className="tb-sep"/>
   <button className="tool-btn" aria-label="Undo" title="Undo" onClick={w.undo} disabled={!w.canUndo||w.blocked}><Icon name="undo" size={19}/></button>
   <button className="tool-btn" aria-label="Redo" title="Redo" onClick={w.redo} disabled={!w.canRedo||w.blocked}><Icon name="redo" size={19}/></button>
   <button className="tool-btn danger-tool" aria-label="Delete selected" title="Delete selected" onClick={w.removeSelection} disabled={w.blocked||!w.selected||w.selected.kind==='target'}><Icon name="trash" size={19}/></button>
   <span className="tb-sep"/>
   <label className="compact-check"><input checked={snap} onChange={e=>setSnap(e.target.checked)} type="checkbox"/> Snap to grid</label>
   <label className="compact-check"><input type="checkbox" checked={w.project.night} disabled={w.blocked} onChange={e=>w.commit({...w.project,night:e.currentTarget.checked})}/> Night</label>
   <label className="compact-check"><input type="checkbox" checked={w.project.mainsOn} disabled={w.blocked} onChange={e=>w.commit({...w.project,mainsOn:e.currentTarget.checked})}/> AC power</label>
   <span className="toolbar-spacer"/>
   <button className={`tool-btn text-btn ${showOpts?'active':''}`} aria-expanded={showOpts} onClick={()=>setShowOpts(v=>!v)}><Icon name="grid" size={18}/><span>Layers &amp; tools</span><Icon name="chevron" size={14}/></button>
  </div>
  {showOpts&&<div className="canvas-options">
   {!hasFloors(wb.project)&&<div className="editor-mode-row"><span>Floors</span><FloorBar w={wb}/></div>}
   <div className="editor-mode-row annotator"><span>Site markers</span>{(['gate','entrance','label'] as Mode[]).map(modeButton)}<span className="editor-muted">References, not alarm devices</span></div>
   <div className="editor-mode-row property-options"><label className="compact-field">Template <select value={template} onChange={e=>setTemplate(e.target.value as PropertyTemplate)} disabled={w.blocked}>{kinds.map(k=><option key={k} value={k}>{k[0].toUpperCase()+k.slice(1)}</option>)}</select></label><button onClick={applyTemplate} disabled={w.blocked}>Apply layout</button>
   {(['grid','rooms','walls','site','targets','coverage','zones','alarm','access','power','image'] as LayerName[]).map(k=><label key={k} className="compact-check"><input type="checkbox" checked={layers[k]} onChange={()=>toggle(k)}/>{k}</label>)}
   {w.mode==='test'&&<label className="compact-field">Motion strength <select value={intensity} onChange={e=>setIntensity(Number(e.target.value))}><option value={25}>Weak</option><option value={50}>Moderate</option><option value={75}>Strong</option><option value={100}>Very strong</option></select></label>}
   <label className="compact-field keyboard-location">Navigate elements
    <select aria-label="Select a device, room or wall by keyboard" value={w.selected&&['device','room','wall'].includes(w.selected.kind)?`${w.selected.kind}:${w.selected.id}`:''} onChange={e=>{
     const value=e.currentTarget.value,split=value.indexOf(':');
     if(split!==-1)w.setSelected({kind:value.slice(0,split) as 'device'|'room'|'wall',id:value.slice(split+1)});
     else w.setSelected(null);
    }}><option value="">Choose an element…</option><optgroup label="Installed devices">{w.project.devices.map(d=><option key={d.id} value={`device:${d.id}`}>{d.name}</option>)}</optgroup>
     <optgroup label="Rooms">{w.project.rooms.map(r=><option key={r.id} value={`room:${r.id}`}>{r.name}</option>)}</optgroup>
     <optgroup label="Walls and openings">{w.project.walls.map((wall,index)=><option key={wall.id} value={`wall:${wall.id}`}>{wall.kind} {index+1}</option>)}</optgroup>
    </select></label>
   {w.placing&&<button disabled={w.blocked||view!=='floor'} title="Keyboard alternative to dragging or clicking the canvas" onClick={()=>w.install(w.placing!,{x:Math.round(center.x/10)*10,y:Math.round(center.y/10)*10})}>Place at view center</button>}
   {view==='floor'&&<><button disabled={w.blocked} onClick={()=>w.addRoom({x:center.x-75,y:center.y-55},{x:center.x+75,y:center.y+55})}>Add room at center</button>
    <button disabled={w.blocked} onClick={()=>w.addWall({x:center.x-75,y:center.y},{x:center.x+75,y:center.y})}>Add wall at center</button></>}
   {w.project.floorplanImage&&<button onClick={()=>w.setSelected({kind:'reference',id:'floorplan'})} className={w.selected?.kind==='reference'?'active':''}>Image settings</button>}
   </div>
  </div>}
  {hasFloors(wb.project)&&<FloorBar w={wb}/>}
  <div className="canvas-body" onDragOver={e=>{if(view==='floor')e.preventDefault();}} onDrop={onDrop}>
   <svg ref={svg} viewBox={viewBox} role="application" aria-label="Professional floor plan. Use Navigate elements to select equipment without a mouse and arrow keys to reposition; use zoom and Fit buttons." onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={e=>{gesture.current=null;setPreview(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}>
    <defs><pattern id="sl-grid-s" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0L0 0 0 10" fill="none" stroke="#23405b" strokeWidth=".45"/></pattern><pattern id="sl-grid-l" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0L0 0 0 100" fill="none" stroke="#456078" strokeWidth=".8"/></pattern></defs>
    <rect x="-2000" y="-2000" width="5000" height="5000" fill="#0b2035"/>
    {layers.grid&&view==='floor'&&<g pointerEvents="none"><rect x="0" y="0" width="1000" height="650" fill="url(#sl-grid-s)"/><rect x="0" y="0" width="1000" height="650" fill="url(#sl-grid-l)"/></g>}
    {view==='floor'?<>
     {w.project.floorplanImage&&layers.image&&<g data-reference="floorplan"><image pointerEvents="none" href={w.project.floorplanImage} x={(w.project.floorplanSettings?.x??0)+(active?.kind==='move'&&active.entity==='reference'?dx:0)} y={(w.project.floorplanSettings?.y??0)+(active?.kind==='move'&&active.entity==='reference'?dy:0)} width={w.project.floorplanSettings?.width??1000} height={w.project.floorplanSettings?.height??650} opacity={w.project.floorplanSettings?.opacity??0.36} preserveAspectRatio="none"/>{!w.project.floorplanSettings?.locked&&<rect data-reference="floorplan" x={w.project.floorplanSettings?.x??0} y={w.project.floorplanSettings?.y??0} width={w.project.floorplanSettings?.width??1000} height={w.project.floorplanSettings?.height??650} fill="transparent" stroke={w.selected?.kind==='reference'?'#20deb8':'none'} strokeDasharray="6 5"/>}</g>}
     {layers.rooms&&w.project.rooms.map(room=>{
      const delta=offset('move',room.id),r=active?.kind==='resize-room'&&active.id===room.id?{...room,w:Math.max(20,room.w+dx),h:Math.max(20,room.h+dy)}:{...room,x:room.x+delta.x,y:room.y+delta.y};
      return <g data-room={room.id} key={room.id}><rect x={r.x} y={r.y} width={r.w} height={r.h} fill={w.selected?.kind==='room'&&w.selected.id===room.id?'rgba(24,152,158,.18)':'rgba(17,65,91,.27)'} stroke={w.selected?.id===room.id?'#29e1c5':'#476f87'} strokeWidth={w.selected?.id===room.id?2.5:1} strokeDasharray="6 4"/><text pointerEvents="none" x={r.x+9} y={r.y+20} fontSize="14" fill="#a5c9d7">{room.name.slice(0,32)}</text>
       {w.selected?.kind==='room'&&w.selected.id===room.id&&<rect data-room={room.id} data-room-handle="resize" x={r.x+r.w-7} y={r.y+r.h-7} width="14" height="14" fill="#23d8c0" stroke="#fff" strokeWidth="1.5"/>}
      </g>;
     })}
     {layers.walls&&w.project.walls.map(wall=>{
      const v=previewWall(wall),selected=w.selected?.kind==='wall'&&w.selected.id===wall.id;
      const mid={x:(v.x1+v.x2)/2,y:(v.y1+v.y2)/2};
      return <g key={wall.id} data-wall={wall.id}><line x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2} stroke="transparent" strokeWidth="18"/>
       <line pointerEvents="none" x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2} stroke={selected?'#22edcd':wall.kind==='wall'?'#d0dee9':wall.kind==='door'?'#efa65e':'#6cc9f5'} strokeWidth={wall.kind==='wall'?5:3} strokeDasharray={wall.kind==='window'?'5 4':undefined}/>
       {wall.kind==='door'&&<g pointerEvents="none"><circle cx={v.x1} cy={v.y1} r="4" fill="#efa65e"/><circle cx={v.x2} cy={v.y2} r="3" fill="none" stroke="#efa65e"/><text x={mid.x+4} y={mid.y-8} fill="#f3b777" fontSize="11">DOOR</text></g>}
       {wall.kind==='window'&&<text pointerEvents="none" x={mid.x+4} y={mid.y-7} fill="#76cafa" fontSize="11">WINDOW</text>}
       {selected&&<g><circle data-wall={wall.id} data-wall-handle="start" cx={v.x1} cy={v.y1} r="9" fill="#20d8be" stroke="#fff" strokeWidth="2"/><circle data-wall={wall.id} data-wall-handle="end" cx={v.x2} cy={v.y2} r="9" fill="#20d8be" stroke="#fff" strokeWidth="2"/></g>}
      </g>;
     })}
     {layers.coverage&&w.project.devices.filter(isCamera).map(d=>{
      const delta=offset('move',d.id),moving={...d,x:d.x+delta.x,y:d.y+delta.y};
      const status=w.result.devices[d.id],polygon=delta.x||delta.y?coveragePolygon(moving,w.project.walls,w.project.night,45):(cameraPolygonCache.get(d.id)||[]);
      return <polygon key={d.id} points={polygon.map(fmt).join(' ')} fill={status?.networkOk?'rgba(23,209,169,.16)':'rgba(231,129,88,.12)'} stroke={status?.networkOk?'#1bae9b':'#b77458'} strokeWidth="1" pointerEvents="none"/>;
     })}
     {layers.zones&&w.project.devices.filter(isCamera).filter(d=>d.id===w.selected?.id).flatMap(d=>(d.motionZones||[]).map(z=><g key={z.id} pointerEvents="none"><rect x={z.x} y={z.y} width={z.w} height={z.h} fill={z.enabled?'rgba(230,178,65,.08)':'rgba(105,110,120,.07)'} stroke={z.enabled?'#efbf62':'#82909a'} strokeWidth="2" strokeDasharray="8 5"/><text x={z.x+5} y={z.y+16} fill="#ffc86d" fontSize="11">{z.name}</text></g>))}
     {layers.alarm&&w.project.devices.filter(d=>profile(d.profileId).kind==='alarm-sensor').filter(d=>['pir','beam'].includes(profile(d.profileId).alarmSensorType||'')).map(d=>{
      const delta=offset('move',d.id),moving={...d,x:d.x+delta.x,y:d.y+delta.y};
      const kind=profile(d.profileId).alarmSensorType;
      if(kind==='beam'){const r=moving.heading*Math.PI/180;return <line key={`zone-${d.id}`} pointerEvents="none" x1={moving.x} y1={moving.y} x2={moving.x+Math.cos(r)*moving.range} y2={moving.y+Math.sin(r)*moving.range} stroke="#c493ff" strokeWidth="9" opacity=".38" strokeDasharray="12 7"/>;}
      return <polygon key={`zone-${d.id}`} pointerEvents="none" points={(delta.x||delta.y?coveragePolygon(moving,w.project.walls,false,36):(alarmPolygonCache.get(d.id)||[])).map(fmt).join(' ')} fill="rgba(181,121,255,.12)" stroke="#9869db" strokeDasharray="7 5" strokeWidth="1.5"/>;
     })}
     {layers.access&&Object.values(w.result.access?.doors||{}).map(door=>{const wall=w.project.walls.find(x=>x.id===door.wallId);if(!wall)return null;const x=(wall.x1+wall.x2)/2,y=(wall.y1+wall.y2)/2;return <g key={`access-door-${wall.id}`} transform={`translate(${x} ${y})`} pointerEvents="none"><circle r="13" fill={door.alarm?'#572132':door.locked?'#244359':'#143f31'} stroke={door.alarm?'#ff747b':door.locked?'#dca36b':'#47dda2'} strokeWidth="2.5"/><text fill="#f1f9ff" fontSize="12" textAnchor="middle" y="5">{door.alarm?'!':door.locked?'⌑':'✓'}</text><text fill="#f0d8ad" fontSize="11" x="17" y="-13">{door.open?'OPEN':door.locked?'LOCKED':'RELEASED'}</text></g>;})}
     {w.project.cables.filter(c=>layers.power||!c.medium?.startsWith('power-')).map(c=>{
      const a=deviceById.get(c.a),b=deviceById.get(c.b);if(!a||!b)return null;
      const deltaA=offset('move',a.id),deltaB=offset('move',b.id);
      const x1=a.x+deltaA.x,y1=a.y+deltaA.y,x2=b.x+deltaB.x,y2=b.y+deltaB.y,up=w.result.cables[c.id]?.up;
      return <g key={c.id} data-cable={c.id}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="16"/><line pointerEvents="none" x1={x1} y1={y1} x2={x2} y2={y2} stroke={up?(mediumOf(c)==='alarm'?'#bd91fb':mediumOf(c)==='access'?'#efc56c':c.medium?.startsWith('power-')?(c.medium==='power-ac'?'#f0d26e':c.medium==='power-dc'?'#ff9465':'#7be7a9'):mediumOf(c)==='coax'?'#f8b85c':'#2fb9ef'):'#ed8b71'} strokeWidth="2.5" strokeDasharray={c.connected?'0':'8 5'}/></g>;
     })}
     {layers.targets&&w.project.targets.map(t=>{const d=offset('move',t.id),covered=coverageById.get(t.id)?.covered;return <g key={t.id} data-target={t.id} transform={`translate(${t.x+d.x} ${t.y+d.y})`}><circle r="13" fill="#17283b" stroke={covered?'#24d7ae':'#f0ae60'} strokeWidth="2"/><circle r="4" fill={covered?'#24d7ae':'#f0ae60'}/><text pointerEvents="none" x="16" y="-12" fontSize="12" fill="#d9e5f0">{t.name}</text></g>;})}
     {layers.site&&(w.project.siteElements||[]).map(m=>{const d=offset('move',m.id);return <g key={m.id} data-site={m.id} transform={`translate(${m.x+d.x} ${m.y+d.y})`}><rect x="-12" y="-12" width="24" height="24" rx="5" fill="#234258" stroke={w.selected?.id===m.id?'#fff':'#f2c16e'} strokeWidth="2"/><text textAnchor="middle" pointerEvents="none" y="5" fontSize="15" fill="#efcc93">{m.kind==='gate'?'▦':m.kind==='entrance'?'⇥':'✎'}</text><text pointerEvents="none" x="17" y="5" fontSize="12" fill="#e2d0b5">{m.label.slice(0,42)}</text></g>;})}
     {w.project.devices.map(d=>{
      const kind=profile(d.profileId).kind,delta=offset('move',d.id),status=w.result.devices[d.id],on=status?.networkOk||(kind!=='camera'&&status?.powered);
      const alarmActive=kind==='alarm-output'&&Object.values(w.result.alarm?.panels||{}).some(panel=>panel.activeOutputs.includes(d.id));
      return <g key={d.id} data-device={d.id} transform={`translate(${d.x+delta.x} ${d.y+delta.y})`} tabIndex={0} role="button" aria-label={`${d.name} ${on?'online':'offline'}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();w.selectOrCable(d.id);}}}>
       <circle r="19" fill="#102d46" stroke={w.selected?.id===d.id?'#fefefe':alarmActive?'#ff6178':on?'#28d8b5':'#f5aa64'} strokeWidth="3"/><text y="6" pointerEvents="none" textAnchor="middle" fill="#ebf9fa" fontSize="18">{kind==='camera'?'◉':kind.startsWith('alarm-')?'⚑':kind.startsWith('access-')?'⌑':kind.startsWith('power-')?'⚡':kind==='switch'?'▤':kind==='router'?'⇆':kind==='ap'?'◌':'▣'}</text><text pointerEvents="none" textAnchor="middle" y="37" fill="#cee4f0" fontSize="12">{d.name.slice(0,25)}</text>
      </g>;
     })}
     {active?.kind==='draw'&&preview&&active.tool==='wall'&&<line x1={active.start.x} y1={active.start.y} x2={preview.x} y2={preview.y} stroke="#22e3c3" strokeWidth="4" strokeDasharray="6 5" pointerEvents="none"/>}
     {active?.kind==='draw'&&preview&&active.tool==='room'&&<rect x={Math.min(active.start.x,preview.x)} y={Math.min(active.start.y,preview.y)} width={Math.abs(active.start.x-preview.x)} height={Math.abs(active.start.y-preview.y)} stroke="#20dfc6" strokeWidth="2.5" strokeDasharray="7 4" fill="#20dfc623" pointerEvents="none"/>}
     {active?.kind==='draw'&&active.tool==='measure'&&preview&&<line x1={active.start.x} y1={active.start.y} x2={preview.x} y2={preview.y} stroke="#e9c572" strokeWidth="2" strokeDasharray="5 3" pointerEvents="none"/>}
     {measure&&<g pointerEvents="none"><line x1={measure.start.x} y1={measure.start.y} x2={measure.end.x} y2={measure.end.y} stroke="#edce83" strokeWidth="2.5"/><circle cx={measure.start.x} cy={measure.start.y} r="4" fill="#e9c572"/><circle cx={measure.end.x} cy={measure.end.y} r="4" fill="#e9c572"/><text x={(measure.start.x+measure.end.x)/2+8} y={(measure.start.y+measure.end.y)/2-8} fill="#fff1b4" fontSize="15">{distanceMeters(measure.start,measure.end,worldScale).toFixed(2)} m</text></g>}
     <g pointerEvents="none"><rect x="0" y="0" width="1000" height="650" fill="none" stroke="#57788d" strokeWidth="1"/><text x="985" y="640" textAnchor="end" fill="#8daebc" fontSize="11">PLAN GRID: {worldScale} units / metre</text><line x1="825" y1="620" x2={825+Math.min(120,worldScale*10)} y2="620" stroke="#d8eaed" strokeWidth="4"/><text x="825" y="607" fontSize="11" fill="#d8eaed">{Math.min(10,120/worldScale).toFixed(1)} m</text></g>
    </>:<>
     <text x="38" y="58" fill="#a7cada" fontSize="22">Network topology · connected equipment graph</text>
     {w.project.cables.filter(c=>c.medium!=='alarm'&&c.medium!=='access'&&!c.medium?.startsWith('power-')).map(c=>{
      const a=deviceById.get(c.a),b=deviceById.get(c.b);if(!a||!b)return null;
      const p1=topologyPosition(a),p2=topologyPosition(b),up=w.result.cables[c.id]?.up;
      return <g key={c.id} data-cable={c.id}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth="22"/><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={up?'#3cc7ee':'#df7479'} strokeWidth="3" pointerEvents="none"/></g>;
     })}
     {Object.values(w.result.network?.wireless||{}).filter(link=>link.connected&&link.apId).map(link=>{
      const a=w.project.devices.find(d=>d.id===link.clientId),b=w.project.devices.find(d=>d.id===link.apId);
      if(!a||!b)return null;const p1=topologyPosition(a),p2=topologyPosition(b);
      return <g key={link.clientId} pointerEvents="none"><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#b8b2ff" strokeWidth="3" strokeDasharray="7 5"/><text x={(p1.x+p2.x)/2} y={(p1.y+p2.y)/2-8} fill="#ded0ff" fontSize="12">Wi-Fi {link.signalPercent}%</text></g>;
     })}
     {w.project.devices.filter(d=>!isAlarm(d)&&!profile(d.profileId).kind.startsWith('power-')).map(d=>{const kind=profile(d.profileId).kind,{x,y}=topologyPosition(d),addr=w.result.network?.addresses[d.id];return <g key={d.id} data-device={d.id} transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-label={`Select network device ${d.name}`} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();w.selectOrCable(d.id);}}}><rect x="-66" y="-36" width="132" height="72" rx="8" fill="#173650" stroke={w.result.devices[d.id]?.networkOk?'#25daba':'#e1aa64'} strokeWidth="2"/><text y="-14" textAnchor="middle" fill="#d0eef3" fontSize="12" pointerEvents="none">{kind==='camera'?(signalOf(d)==='analog'?'ANALOG CAM':'IP CAMERA'):kind==='switch'?'SWITCH':kind==='router'?'ROUTER':kind==='ap'?'Wi-Fi AP':kind==='server'?'SERVER':kind==='dvr'?'DVR':'NVR'}</text><text y="4" textAnchor="middle" fill="#9bbed0" fontSize="11" pointerEvents="none">{d.name.slice(0,19)}</text><text y="22" textAnchor="middle" fill="#6bd8ce" fontSize="10" pointerEvents="none">{addr?.ip?`${addr.ip} · V${addr.vlanId}`:`VLAN ${addr?.vlanId??10}`}</text></g>;})}
    </>}
   </svg>
   <div className="canvas-overlay" role="group" aria-label="Zoom">
    <button onClick={fit} aria-label="Fit" title="Fit to view"><Icon name="floorplan" size={18}/></button>
    <button onClick={()=>zoomTo(zoom*0.8)} aria-label="Zoom out">&minus;</button><span className="zoom-readout">{Math.round(zoom*100)}%</span><button onClick={()=>zoomTo(zoom*1.25)} aria-label="Zoom in">+</button>
   </div>
   <div className={`canvas-hint ${w.mode==='select'&&view==='floor'?'quiet':''}`}>{view==='topology'?'Network topology: select devices or use Cable mode to connect endpoints':w.mode==='door'||w.mode==='window'?'Click a long solid wall to create a genuine opening':w.mode==='measure'?'Drag between two points to measure distance':w.mode==='pan'||spaceDown?'Drag to pan; use the mouse wheel to zoom':w.mode==='room'?'Drag to create a room with four physical walls':w.mode==='wall'?'Drag to draw a visibility-blocking wall':w.mode==='cable'?'Select two devices: IP uses Ethernet/PoE; analog camera + DVR uses coax; alarm sensors use panel wiring; access devices use separate access cable; power uses AC/DC/PV conductors':w.placing?'Click to place equipment':'Select and drag rooms, device icons, endpoints or markers · Resize rooms with the corner handle'}</div>
  </div>
  <div className="canvas-status"><span>ROOMS {w.project.rooms.length}</span><span>WALLS {w.project.walls.filter(r=>r.kind==='wall').length}</span><span>OPENINGS {w.project.walls.filter(r=>r.kind!=='wall').length}</span><span>CAMERAS {w.result.requiredCameras}</span><span>ONLINE {w.result.onlineCameras}</span><span>RECORDING {w.result.recordingCameras}</span><span>ALARM PANELS {Object.keys(w.result.alarm?.panels||{}).length} · SIRENS {w.result.alarm?.activeSirenCount||0}</span><span>ACCESS CONTROLLERS {Object.keys(w.result.access?.controllers||{}).length} · DOOR ALERTS {Object.values(w.result.access?.doors||{}).filter(d=>d.alarm).length}</span><span>LINKS: <b style={{color:'#2fb9ef'}}>Ethernet</b> · <b style={{color:'#f8b85c'}}>Coax</b> · <b style={{color:'#bd91fb'}}>Alarm</b> · <b style={{color:'#efc56c'}}>Access</b> · <b style={{color:'#f0d26e'}}>AC</b> · <b style={{color:'#ff9465'}}>DC</b> · <b style={{color:'#7be7a9'}}>PV</b></span><span>POWER {(w.result.power?.totalLoadW||0).toFixed(0)} W · {(w.result.power?.gridDrawW||0).toFixed(0)} W GRID</span><span>DHCP LEASES {Object.keys(w.result.network?.dhcpLeases||{}).length}</span><span>WI-FI CLIENTS {Object.values(w.result.network?.wireless||{}).filter(w=>w.connected).length}</span><span>TARGETS {w.result.coverage.filter(r=>r.covered).length}/{w.result.coverage.length}</span><span className="good">{w.project.night?'NIGHT':'DAY'} · {w.project.mainsOn?'AC ONLINE':'AC OFF'}</span></div>
 </section>;
}
