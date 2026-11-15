import type {Device,Point,Wall} from '../domain/types.js';
import {effectiveRange,fovOf} from './cctv.js';
const EPS=1e-8;
export const rad=(deg:number):number=>deg*Math.PI/180;
export const normalizeAngle=(r:number):number=>Math.atan2(Math.sin(r),Math.cos(r));
function cross(a:Point,b:Point):number {return a.x*b.y-a.y*b.x;}
function minus(a:Point,b:Point):Point {return {x:a.x-b.x,y:a.y-b.y};}
/** Intersection from finite ray p + t*d (0<=t<=maxDistance) with finite wall segment. */
export function rayWallDistance(p:Point,d:Point,wall:Wall,maxDistance:number):number|undefined {
 if(wall.kind!=='wall')return undefined;
 const q={x:wall.x1,y:wall.y1}, s={x:wall.x2-wall.x1,y:wall.y2-wall.y1};
 const denom=cross(d,s);
 if(Math.abs(denom)<EPS)return undefined;
 const qmp=minus(q,p),t=cross(qmp,s)/denom,u=cross(qmp,d)/denom;
 if(t>EPS&&t<=maxDistance+EPS&&u>=-EPS&&u<=1+EPS)return t;
 return undefined;
}
export function cameraRange(cam:Device,night:boolean):number {return effectiveRange(cam,night);}
export function visible(cam:Device,point:Point,walls:Wall[],night=false):boolean {
 const dx=point.x-cam.x,dy=point.y-cam.y, dist=Math.hypot(dx,dy),r=cameraRange(cam,night);
 if(dist>r||dist<EPS)return dist<EPS;
 if(Math.abs(normalizeAngle(Math.atan2(dy,dx)-rad(cam.heading)))>rad(fovOf(cam))/2+EPS)return false;
 return !walls.some(w=>{const t=rayWallDistance(cam,{x:dx/dist,y:dy/dist},w,dist);return t!==undefined&&t<dist-0.001;});
}
export function coveragePolygon(cam:Device,walls:Wall[],night=false,samples=32):Point[] {
 const points:Point[]=[{x:cam.x,y:cam.y}];const max=cameraRange(cam,night);
 for(let i=0;i<=samples;i++){
  const angle=rad(cam.heading-fovOf(cam)/2+(fovOf(cam)*i/samples)),d={x:Math.cos(angle),y:Math.sin(angle)};
  let distance=max;
  for(const w of walls){const hit=rayWallDistance(cam,d,w,max);if(hit!==undefined)distance=Math.min(distance,hit);}
  points.push({x:cam.x+d.x*distance,y:cam.y+d.y*distance});
 }
 return points;
}
