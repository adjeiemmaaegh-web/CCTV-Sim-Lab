/**
 * Feature 16: multiple floors. Additive model: items default to floor 0, so every existing project is unchanged.
 * Walls only block cameras/sensors on the same floor; targets are only covered by same-floor cameras; a cable
 * between floors adds FLOOR_HEIGHT_M of run per floor crossed.
 */
import type {Device,Floor,Project,Wall} from '../domain/types.js';

export const FLOOR_HEIGHT_M=3;
export const MAX_FLOORS=9;
export const floorOf=(x:{floor?:number})=>x.floor??0;
export const hasFloors=(p:Project)=>(p.floors?.length??0)>1;
export const floorList=(p:Project):Floor[]=>p.floors&&p.floors.length?p.floors:[{id:0,name:'Ground floor'}];
export const sameFloor=(a:{floor?:number},b:{floor?:number})=>floorOf(a)===floorOf(b);
export const wallsOnFloor=(walls:Wall[],floor:number)=>walls.filter(w=>floorOf(w)===floor);
export const cableRiseM=(a:Device,b:Device)=>Math.abs(floorOf(a)-floorOf(b))*FLOOR_HEIGHT_M;

export function addFloor(p:Project,name?:string):Project{
 const list=floorList(p);
 if(list.length>=MAX_FLOORS)throw new Error(`At most ${MAX_FLOORS} floors`);
 const id=Math.max(...list.map(f=>f.id))+1;
 return {...p,floors:[...list,{id,name:(name||`Floor ${id}`).trim().slice(0,40)||`Floor ${id}`}]};
}
export function renameFloor(p:Project,id:number,name:string):Project{
 if(!floorList(p).some(f=>f.id===id))throw new Error('Unknown floor');
 const n=name.trim().slice(0,40);if(!n)throw new Error('Floor name required');
 return {...p,floors:floorList(p).map(f=>f.id===id?{...f,name:n}:f)};
}
export function itemsOnFloor(p:Project,id:number):number{
 return p.devices.filter(d=>floorOf(d)===id).length+p.rooms.filter(r=>floorOf(r)===id).length+p.walls.filter(w=>floorOf(w)===id).length+p.targets.filter(t=>floorOf(t)===id).length+(p.siteElements||[]).filter(s=>floorOf(s)===id).length;
}
export function removeFloor(p:Project,id:number):Project{
 if(id===0)throw new Error('The ground floor cannot be removed');
 if(!floorList(p).some(f=>f.id===id))throw new Error('Unknown floor');
 const n=itemsOnFloor(p,id);if(n>0)throw new Error(`Floor still contains ${n} item(s); remove or move them first`);
 const rest=floorList(p).filter(f=>f.id!==id);
 return {...p,floors:rest.length>1?rest:undefined};
}
/** The plan as seen on one floor: only that floor's items; cables only when both ends are on it. */
export function floorView(p:Project,floor:number):Project{
 if(!hasFloors(p))return p;
 const here=new Set(p.devices.filter(d=>floorOf(d)===floor).map(d=>d.id));
 return {...p,devices:p.devices.filter(d=>here.has(d.id)),rooms:p.rooms.filter(r=>floorOf(r)===floor),walls:p.walls.filter(w=>floorOf(w)===floor),
  targets:p.targets.filter(t=>floorOf(t)===floor),siteElements:(p.siteElements||[]).filter(s=>floorOf(s)===floor),
  cables:p.cables.filter(c=>here.has(c.a)&&here.has(c.b)),floorplanImage:floor===0?p.floorplanImage:undefined};
}
/** Give items created since `prev` (by id) the active floor, but only on multi-floor projects. */
export function stampNewItems(prev:Project,next:Project,floor:number):Project{
 if(!hasFloors(next))return next;
 const had=(arr:{id:string}[])=>new Set(arr.map(x=>x.id));
 const d=had(prev.devices),r=had(prev.rooms),w=had(prev.walls),s=had(prev.siteElements||[]);
 const mark=<T extends {id:string;floor?:number}>(items:T[],seen:Set<string>)=>{let ch=false;const out=items.map(i=>{if(!seen.has(i.id)&&i.floor===undefined){ch=true;return {...i,floor};}return i;});return ch?out:items;};
 const devices=mark(next.devices,d),rooms=mark(next.rooms,r),walls=mark(next.walls,w),site=next.siteElements?mark(next.siteElements,s):next.siteElements;
 if(devices===next.devices&&rooms===next.rooms&&walls===next.walls&&site===next.siteElements)return next;
 return {...next,devices,rooms,walls,...(site?{siteElements:site}:{})};
}
