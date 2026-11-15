/** SecurityLab Stage 3: pure 2D property editing primitives (no React/browser dependencies).
 * Units are virtual plan units. Default scale is 10 units per metre.
 * A door or window is an intentionally transparent opening in the coverage engine.
 */
import type {Point,Room,Wall,SiteElement,Project,FloorplanSettings} from '../domain/types.js';
export const PLAN_WIDTH=1000;
export const PLAN_HEIGHT=650;
export const DEFAULT_UNITS_PER_METER=10;
export const GRID_STEP=10;
export const MIN_ROOM_SIZE=20;
export const MIN_WALL_LENGTH=10;
const finite=(n:number)=>Number.isFinite(n);
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export const bounded=(p:Point):Point=>({x:clamp(p.x,0,PLAN_WIDTH),y:clamp(p.y,0,PLAN_HEIGHT)});
export const snapped=(p:Point,enabled=true,step=GRID_STEP):Point=>{
 const safe=bounded(p);
 return !enabled?safe:{x:clamp(Math.round(safe.x/step)*step,0,PLAN_WIDTH),y:clamp(Math.round(safe.y/step)*step,0,PLAN_HEIGHT)};
};
export const scaleOf=(p:Project)=>p.unitsPerMeter??DEFAULT_UNITS_PER_METER;
export const distanceMeters=(a:Point,b:Point,unitsPerMeter=DEFAULT_UNITS_PER_METER)=>distance(a,b)/unitsPerMeter;
export function rectangle(a:Point,b:Point,min=MIN_ROOM_SIZE):Pick<Room,'x'|'y'|'w'|'h'>|null{
 const x=clamp(Math.min(a.x,b.x),0,PLAN_WIDTH),y=clamp(Math.min(a.y,b.y),0,PLAN_HEIGHT);
 const right=clamp(Math.max(a.x,b.x),0,PLAN_WIDTH),bottom=clamp(Math.max(a.y,b.y),0,PLAN_HEIGHT);
 return right-x>=min&&bottom-y>=min?{x,y,w:right-x,h:bottom-y}:null;
}
export function normalizeRoom(room:Room):Room {
 const x=clamp(finite(room.x)?room.x:0,0,PLAN_WIDTH-MIN_ROOM_SIZE);
 const y=clamp(finite(room.y)?room.y:0,0,PLAN_HEIGHT-MIN_ROOM_SIZE);
 return {...room,x,y,w:clamp(finite(room.w)?room.w:MIN_ROOM_SIZE,MIN_ROOM_SIZE,PLAN_WIDTH-x),h:clamp(finite(room.h)?room.h:MIN_ROOM_SIZE,MIN_ROOM_SIZE,PLAN_HEIGHT-y)};
}
export function shiftRoom(room:Room,dx:number,dy:number):Room{
 return {...room,x:clamp(room.x+dx,0,PLAN_WIDTH-room.w),y:clamp(room.y+dy,0,PLAN_HEIGHT-room.h)};
}
export function resizeRoom(room:Room,corner:Point):Room{
 const x1=clamp(corner.x,room.x+MIN_ROOM_SIZE,PLAN_WIDTH),y1=clamp(corner.y,room.y+MIN_ROOM_SIZE,PLAN_HEIGHT);
 return {...room,w:x1-room.x,h:y1-room.y};
}
export function roomEdges(room:Room,ids:()=>string):Wall[]{
 const {x,y,w,h}=room;
 const segments:[[number,number,number,number],[number,number,number,number],[number,number,number,number],[number,number,number,number]]=[
  [x,y,x+w,y],[x+w,y,x+w,y+h],[x+w,y+h,x,y+h],[x,y+h,x,y]
 ];
 return segments.map(([x1,y1,x2,y2])=>({id:ids(),roomId:room.id,kind:'wall',x1,y1,x2,y2}));
}
/** Transform every owned wall/opening with its room, retaining proportional openings. */
export function transformRoomWalls(walls:Wall[],before:Room,after:Room):Wall[]{
 const fx=(x:number)=>after.x+(x-before.x)*(after.w/Math.max(1,before.w));
 const fy=(y:number)=>after.y+(y-before.y)*(after.h/Math.max(1,before.h));
 return walls.map(w=>w.roomId===before.id?{...w,x1:fx(w.x1),x2:fx(w.x2),y1:fy(w.y1),y2:fy(w.y2)}:w);
}
export function shiftWall(w:Wall,delta:Point):Wall {
 const dx=clamp(delta.x,-Math.min(w.x1,w.x2),PLAN_WIDTH-Math.max(w.x1,w.x2));
 const dy=clamp(delta.y,-Math.min(w.y1,w.y2),PLAN_HEIGHT-Math.max(w.y1,w.y2));
 return {...w,roomId:undefined,x1:w.x1+dx,x2:w.x2+dx,y1:w.y1+dy,y2:w.y2+dy};
}
export function wallEndpoint(w:Wall,end:'start'|'end',point:Point):Wall|null{
 const p=bounded(point),other=end==='start'?{x:w.x2,y:w.y2}:{x:w.x1,y:w.y1};
 if(distance(p,other)<MIN_WALL_LENGTH)return null;
 return end==='start'?{...w,roomId:undefined,x1:p.x,y1:p.y}:{...w,roomId:undefined,x2:p.x,y2:p.y};
}
export function nearestOnSegment(point:Point,w:Wall):{point:Point;t:number;distance:number}{
 const vx=w.x2-w.x1,vy=w.y2-w.y1,denom=vx*vx+vy*vy;
 const t=denom===0?0:clamp(((point.x-w.x1)*vx+(point.y-w.y1)*vy)/denom,0,1);
 const closest={x:w.x1+vx*t,y:w.y1+vy*t};
 return {point:closest,t,distance:distance(point,closest)};
}
/** Split a solid wall into solid ends + a real non-occluding opening.
 * This is deliberately geometric, not merely a differently coloured line.
 */
export function insertOpening(w:Wall,at:Point,kind:'door'|'window',openingLength:number,ids:()=>string):{segments:Wall[];openingId:string}|null{
 if(w.kind!=='wall'||!finite(openingLength)||openingLength<8)return null;
 const total=distance({x:w.x1,y:w.y1},{x:w.x2,y:w.y2});
 if(total<openingLength+2*MIN_WALL_LENGTH)return null;
 const p=nearestOnSegment(at,w);
 if(p.distance>22)return null;
 const half=openingLength/(2*total),start=p.t-half,end=p.t+half;
 if(start*total<MIN_WALL_LENGTH||(1-end)*total<MIN_WALL_LENGTH)return null;
 const interp=(t:number)=>({x:w.x1+(w.x2-w.x1)*t,y:w.y1+(w.y2-w.y1)*t});
 const a=interp(start),b=interp(end),openingId=ids();
 return {openingId,segments:[
  {...w,id:ids(),x2:a.x,y2:a.y},
  {...w,id:openingId,kind,x1:a.x,y1:a.y,x2:b.x,y2:b.y},
  {...w,id:ids(),x1:b.x,y1:b.y}
 ]};
}
export function replaceWallWithOpening(walls:Wall[],at:Point,kind:'door'|'window',length:number,ids:()=>string):{walls:Wall[];openingId:string}|null{
 const candidates=walls.filter(w=>w.kind==='wall').map(w=>({w,d:nearestOnSegment(at,w).distance})).sort((a,b)=>a.d-b.d);
 for(const {w,d} of candidates){
  if(d>22)break;
  const result=insertOpening(w,at,kind,length,ids);
  if(result)return {openingId:result.openingId,walls:walls.flatMap(a=>a.id===w.id?result.segments:[a])};
 }
 return null;
}
export function repositionElement<T extends SiteElement>(item:T,point:Point):T{return {...item,...bounded(point)};}
export const DEFAULT_FLOORPLAN:FloorplanSettings={x:0,y:0,width:PLAN_WIDTH,height:PLAN_HEIGHT,opacity:0.36,locked:true};
export function sanitizeFloorplan(raw:FloorplanSettings):FloorplanSettings {
 return {x:clamp(raw.x,-PLAN_WIDTH,PLAN_WIDTH),y:clamp(raw.y,-PLAN_HEIGHT,PLAN_HEIGHT),
  width:clamp(raw.width,20,PLAN_WIDTH*3),height:clamp(raw.height,20,PLAN_HEIGHT*3),opacity:clamp(raw.opacity,0,1),locked:Boolean(raw.locked)};
}
/** Canonicalize axis-aligned edges so shared partitions do not create duplicate
 * invisible blockers. Shared boundaries are detached from either room owner.
 */
function canonicalTemplateWalls(edges:Wall[],ids:()=>string):Wall[]{
 type Segment={lo:number;hi:number;owner:string|undefined};
 const grouped=new Map<string,{horizontal:boolean;constant:number;segments:Segment[]}>();
 const other:Wall[]=[];
 for(const wall of edges){
  const horizontal=Math.abs(wall.y1-wall.y2)<0.0001,vertical=Math.abs(wall.x1-wall.x2)<0.0001;
  if(!horizontal&&!vertical){other.push(wall);continue;}
  const constant=horizontal?wall.y1:wall.x1,key=`${horizontal?'h':'v'}:${constant.toFixed(4)}`;
  const lo=Math.min(horizontal?wall.x1:wall.y1,horizontal?wall.x2:wall.y2);
  const hi=Math.max(horizontal?wall.x1:wall.y1,horizontal?wall.x2:wall.y2);
  if(hi-lo<0.001)continue;
  if(!grouped.has(key))grouped.set(key,{horizontal,constant,segments:[]});
  grouped.get(key)!.segments.push({lo,hi,owner:wall.roomId});
 }
 const output:Wall[]=[...other];
 for(const group of grouped.values()){
  const cuts=[...new Set(group.segments.flatMap(s=>[s.lo,s.hi]))].sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){
   const a=cuts[i],b=cuts[i+1];if(b-a<0.001)continue;
   const active=group.segments.filter(s=>s.lo<=(a+b)/2&&s.hi>=(a+b)/2);
   if(!active.length)continue;
   const owner=active.length===1?active[0].owner:undefined;
   output.push({id:ids(),kind:'wall',roomId:owner,
    x1:group.horizontal?a:group.constant,y1:group.horizontal?group.constant:a,
    x2:group.horizontal?b:group.constant,y2:group.horizontal?group.constant:b});
  }
 }
 return output;
}
export type PropertyTemplate='residential'|'apartment'|'retail'|'office'|'warehouse';
/** Small local schematics intentionally use generic spaces, not an assumed country's building code. */
export function propertyTemplate(kind:PropertyTemplate,ids:()=>string):{rooms:Room[];walls:Wall[];elements:SiteElement[]}{
 type Box=[string,number,number,number,number];
 const boxes:Record<PropertyTemplate,Box[]>={
  residential:[['Lounge',190,155,290,190],['Bedroom',480,155,270,190],['Kitchen',190,345,290,160],['Utility',480,345,270,160]],
  apartment:[['Living / Dining',180,160,340,240],['Bedroom 1',520,160,260,150],['Bedroom 2',520,310,260,140],['Corridor',180,400,340,100]],
  retail:[['Sales floor',160,130,500,390],['Stockroom',660,315,170,205],['Cash counter',660,130,170,185]],
  office:[['Reception',160,135,300,175],['Open office',460,135,390,285],['Meeting room',160,310,300,185],['Corridor',460,420,390,75]],
  warehouse:[['Receiving bay',125,145,220,365],['Storage area',345,145,400,365],['Control office',745,145,135,190],['Dispatch',745,335,135,175]]
 };
 const rooms=boxes[kind].map(([name,x,y,w,h])=>({id:ids(),name,x,y,w,h}));
 let walls=canonicalTemplateWalls(rooms.flatMap(r=>roomEdges(r,ids)),ids);
 // Seed usable entrances; students may add or relocate openings.
 const entry:Record<PropertyTemplate,Point[]>={
  residential:[{x:300,y:505},{x:610,y:155}],
  apartment:[{x:330,y:160},{x:650,y:160}],
  retail:[{x:400,y:130},{x:750,y:520}],
  office:[{x:300,y:135},{x:635,y:135}],
  warehouse:[{x:220,y:510},{x:500,y:510},{x:800,y:510}]
 };
 for(const position of entry[kind]){const split=replaceWallWithOpening(walls,position,'door',36,ids);if(split)walls=split.walls;}
 const elements:SiteElement[]=[{id:ids(),kind:'entrance',label:'Main entrance',x:140,y:145},{id:ids(),kind:'gate',label:'Site gate',x:100,y:580}];
 return {rooms,walls,elements};
}
