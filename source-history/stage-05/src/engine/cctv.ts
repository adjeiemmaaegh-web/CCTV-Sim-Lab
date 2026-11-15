/**
 * SecurityLab Stage 4 — deterministic CCTV configuration mathematics.
 * All figures describe teaching models, NOT camera optics, real codecs, firmware,
 * radio links, protocol implementations, or legally evidential footage.
 */
import type {Cable,CableMedia,Device,Point,Project,RecordingMode,RecordingSchedule,SignalType} from '../domain/types.js';
import {profile} from '../domain/catalog.js';

const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
export const signalOf=(device:Device):SignalType=>profile(device.profileId).signal||'ip';
export const isCamera=(device:Device)=>profile(device.profileId).kind==='camera';
export const isRecorder=(device:Device)=>['nvr','dvr'].includes(profile(device.profileId).kind);
export const mediumOf=(cable:Cable):CableMedia=>cable.medium||'ethernet';
export const clockOf=(project:Project)=>({day:project.simulationDay??0,minute:project.simulationMinute??720});
export const clockLabel=(project:Project)=>{
 const c=clockOf(project),day=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][c.day]||'Mon';
 return `${day} ${String(Math.floor(c.minute/60)).padStart(2,'0')}:${String(c.minute%60).padStart(2,'0')}`;
};
export const modeOf=(camera:Device):RecordingMode=>!camera.recordingEnabled?'off':camera.recordingMode||'motion';
export const DEFAULT_SCHEDULE:RecordingSchedule={days:[0,1,2,3,4,5,6],startMinute:0,endMinute:1440};
export function scheduleActive(camera:Device,project:Project):boolean {
 const schedule=camera.recordingSchedule||DEFAULT_SCHEDULE;
 const {day,minute}=clockOf(project);
 const {days,startMinute,endMinute}=schedule;
 if(startMinute===endMinute)return false;
 if(startMinute<endMinute)return days.includes(day)&&minute>=startMinute&&minute<endMinute;
 // Overnight window belongs to the start day and continues into the following day.
 return days.includes(day)&&minute>=startMinute || days.includes((day+6)%7)&&minute<endMinute;
}
export function recordingActive(camera:Device,project:Project):boolean {
 const mode=modeOf(camera);
 return mode!=='off'&&(mode!=='scheduled'||scheduleActive(camera,project));
}
const VIDEO_PIXELS:{[key:string]:number}={'720p':1280*720,'1080p':1920*1080,'1440p':2560*1440,'4K':3840*2160};
export function supportedResolution(camera:Device):boolean{
 const px=VIDEO_PIXELS[camera.resolution||'1080p']||VIDEO_PIXELS['1080p'];
 const megapixels=profile(camera.profileId).megapixels||2;
 return px/1_000_000<=megapixels+0.5;
}
/**
 * Configured bitrate represents a reference H264/1080p/20fps target.
 * Resolution, frame rate and codec modify the approximate resulting stream load;
 * profiles impose a hard ceiling. This is not real codec rate control.
 */
export function bitrateOf(camera:Device):number {
 const p=profile(camera.profileId);
 const reference=camera.bitrateMbps??(p.megapixels&&p.megapixels>=8?8:p.megapixels&&p.megapixels>=4?5:3);
 const pixels=VIDEO_PIXELS[camera.resolution||'1080p']||VIDEO_PIXELS['1080p'];
 const sizeFactor=Math.pow(pixels/VIDEO_PIXELS['1080p'],0.68);
 const fpsFactor=Math.pow(clamp(camera.frameRate||20,1,60)/20,0.8);
 const codecFactor=camera.codec==='H265'?0.68:1;
 const result=reference*sizeFactor*fpsFactor*codecFactor;
 return Number.isFinite(result)?clamp(result,0.25,Math.max(0.25,p.maxBitrateMbps||16)):3;
}
export function powerDrawOf(camera:Device,night:boolean):number{
 const draw=profile(camera.profileId).powerW;
 return night&&camera.infraredEnabled!==false?draw*1.2:draw;
}
/** Decimal GB (10^9 bytes), including 1 Mb = 10^6 bits. Protocol/FS overhead is omitted. */
export const gigabytesFor=(bitrateMbps:number,seconds:number)=>bitrateMbps*1_000_000*seconds/8/1_000_000_000;
export function fovOf(cam:Device):number {
 const p=profile(cam.profileId);
 if(!p.isPTZ)return cam.fov;
 const zoom=clamp(cam.opticalZoom||1,1,p.maxZoom||20);
 return clamp(2*Math.atan(Math.tan(clamp(cam.fov,1,170)*Math.PI/360)/zoom)*180/Math.PI,1,170);
}
export function effectiveRange(cam:Device,night:boolean):number {
 const p=profile(cam.profileId);let range=Math.max(0,cam.range);
 if(p.isPTZ)range*=Math.min(3,Math.sqrt(clamp(cam.opticalZoom||1,1,p.maxZoom||20)));
 // A 2D approximation: tilt reduces useful horizontal-plane reach.
 if(p.isPTZ)range*=Math.max(0.35,Math.cos((cam.tiltDegrees||0)*Math.PI/180));
 if(!night)return range;
 if(!cam.infraredEnabled)return range*0.3;
 return Math.min(range,p.irRange??range*0.6);
}
export function insideMotionZone(camera:Device,point:Point):boolean {
 const zones=camera.motionZones||[];
 if(zones.length===0)return true;
 return zones.some(z=>z.enabled&&point.x>=z.x&&point.y>=z.y&&point.x<=z.x+z.w&&point.y<=z.y+z.h);
}
/** Normalized stimulus intensity 0–100 versus user-selected detector sensitivity 0–100. */
export function motionThresholdMet(camera:Device,intensity:number):boolean {
 const sensitivity=clamp(camera.motionSensitivity??50,0,100);
 return intensity>=100-sensitivity;
}
export function recorderBandwidth(device:Device):number{
 const p=profile(device.profileId);
 return Math.max(0,Number.isFinite(device.incomingMbps)?device.incomingMbps!:(p.maxIncomingMbps||32));
}
export function ptzPresetFields(camera:Device,heading:number,opticalZoom:number,tiltDegrees:number):Partial<Device>{
 const p=profile(camera.profileId);
 if(!p.isPTZ)throw new Error('PTZ command requires a PTZ camera profile');
 return {heading:((heading%360)+360)%360,opticalZoom:clamp(opticalZoom,1,p.maxZoom||20),tiltDegrees:clamp(tiltDegrees,-60,60)};
}
