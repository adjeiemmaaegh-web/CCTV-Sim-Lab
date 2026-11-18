import React,{useState} from 'react';
import {floorList,floorOf} from '../../../src/tools/floors.js';
import type {Selectable,Workbench} from '../hooks/useWorkbench.js';
type Entity=NonNullable<Selectable>;
export function SceneNavigator({w,hidden,locked,isolated,onHide,onLock,onIsolate,onReset}:{w:Workbench;hidden:Set<string>;locked:Set<string>;isolated:string|null;onHide:(id:string)=>void;onLock:(id:string)=>void;onIsolate:(id:string)=>void;onReset:()=>void}){
 const [query,setQuery]=useState('');
 const entries:{entity:Entity;label:string;floor:number}[]=[
  ...w.project.devices.map(d=>({entity:{kind:'device' as const,id:d.id},label:d.name,floor:floorOf(d)})),
  ...w.project.cables.map(c=>({entity:{kind:'cable' as const,id:c.id},label:`Cable: ${w.project.devices.find(d=>d.id===c.a)?.name} ↔ ${w.project.devices.find(d=>d.id===c.b)?.name}`,floor:floorOf(w.project.devices.find(d=>d.id===c.a)??{})})),
  ...w.project.rooms.map(d=>({entity:{kind:'room' as const,id:d.id},label:d.name,floor:floorOf(d)})),
  ...w.project.walls.map(d=>({entity:{kind:'wall' as const,id:d.id},label:`${d.kind} ${d.id.slice(0,8)}`,floor:floorOf(d)})),
  ...w.project.targets.map(d=>({entity:{kind:'target' as const,id:d.id},label:d.name,floor:floorOf(d)})),
  ...(w.project.siteElements||[]).map(d=>({entity:{kind:'site' as const,id:d.id},label:d.label,floor:floorOf(d)})),
 ];
 return <details className="scene-navigator"><summary>Find and organize components ({entries.length})</summary><label>Search all floors<input aria-label="Search scene components" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Camera, cable, room…"/></label><button onClick={onReset}>Show all and unlock</button><small>Hide, isolate and lock affect canvas editing in this session; simulation and assessment still use every component.</small><div className="scene-results">{floorList(w.project).map(f=>{const matches=entries.filter(e=>e.floor===f.id&&e.label.toLowerCase().includes(query.toLowerCase()));return matches.length>0&&<section key={f.id}><h4>{f.name}</h4>{matches.map(e=><div key={e.entity.kind+e.entity.id} className="scene-row"><button onClick={()=>{w.setFloor(f.id);w.locate(e.entity);}}>{e.label}</button><button aria-label={`Hide ${e.label}`} aria-pressed={hidden.has(e.entity.id)} onClick={()=>onHide(e.entity.id)}>{hidden.has(e.entity.id)?'Show':'Hide'}</button><button aria-label={`Lock ${e.label}`} aria-pressed={locked.has(e.entity.id)} onClick={()=>onLock(e.entity.id)}>{locked.has(e.entity.id)?'Unlock':'Lock'}</button><button aria-label={`Isolate ${e.label}`} aria-pressed={isolated===e.entity.id} onClick={()=>onIsolate(e.entity.id)}>Isolate</button></div>)}</section>;})}{!entries.some(e=>e.label.toLowerCase().includes(query.toLowerCase()))&&<p>No matching components.</p>}</div></details>;
}
