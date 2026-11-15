/**
 * Feature 3: simulated camera-view. A ray-cast "strip" of what a camera sees across its field of view:
 * wall distance per column, visible targets and night/IR dimming. Windows/doors are treated as see-through.
 * This is a schematic training view, not rendered video.
 */
import type {Project,Point} from '../domain/types.js';
import {rayWallDistance,rad,normalizeAngle} from '../engine/geometry.js';
import {effectiveRange,fovOf} from '../engine/cctv.js';
import {adjustDevice} from '../engine/environment.js';

export type ViewColumn={angleDeg:number;distance:number;hitWall:boolean;brightness:number};
export type ViewTarget={id:string;name:string;angleDeg:number;distance:number;visible:boolean;reason?:string};
export type CameraView={cameraId:string;fovDeg:number;rangeUnits:number;night:boolean;infrared:boolean;columns:ViewColumn[];targets:ViewTarget[];notes:string[]};

export function cameraView(project:Project,cameraId:string,columns=64):CameraView{
 const raw=project.devices.find(d=>d.id===cameraId);
 if(!raw)throw new Error('Unknown camera');
 const cam=adjustDevice(project,raw);
 const fov=fovOf(cam),range=effectiveRange(cam,project.night),notes:string[]=[];
 if(project.night&&!cam.infraredEnabled)notes.push('Night with infrared disabled: very short range and dark image.');
 if(project.environment&&project.environment.weather!=='clear')notes.push(`Weather (${project.environment.weather}) reduces visible range.`);
 const cols:ViewColumn[]=[];
 for(let i=0;i<columns;i++){
  const off=-fov/2+fov*(i/Math.max(1,columns-1)),ang=rad(cam.heading+off),dir={x:Math.cos(ang),y:Math.sin(ang)};
  let d=range,hit=false;
  for(const w of project.walls){const t=rayWallDistance(cam,dir,w,range);if(t!==undefined&&t<d){d=t;hit=true;}}
  const base=project.night?(cam.infraredEnabled?0.55:0.15):1;
  cols.push({angleDeg:off,distance:d,hitWall:hit,brightness:Math.max(0.05,base*(1-0.6*d/Math.max(1,range)))});
 }
 const targets:ViewTarget[]=project.targets.map(t=>{
  const dx=t.x-cam.x,dy=t.y-cam.y,dist=Math.hypot(dx,dy),rel=normalizeAngle(Math.atan2(dy,dx)-rad(cam.heading))*180/Math.PI;
  let visible=true,reason:string|undefined;
  if(dist>range){visible=false;reason='Beyond effective range';}
  else if(Math.abs(rel)>fov/2){visible=false;reason='Outside field of view';}
  else{const dir={x:dx/dist,y:dy/dist};
   if(project.walls.some(w=>{const h=rayWallDistance(cam,dir,w,dist);return h!==undefined&&h<dist-0.001;})){visible=false;reason='Blocked by a wall';}}
  return {id:t.id,name:t.name,angleDeg:rel,distance:dist,visible,reason};
 });
 return {cameraId,fovDeg:fov,rangeUnits:range,night:project.night,infrared:!!cam.infraredEnabled,columns:cols,targets,notes};
}
export type {Point};
