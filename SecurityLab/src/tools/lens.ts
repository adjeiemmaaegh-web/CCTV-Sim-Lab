/**
 * Feature 4: lens / pixel-density calculator. Uses the pixels-per-metre (PPM) bands that are commonly
 * taught for CCTV design (detect 25, observe 62, recognise 125, identify 250). Training guidance only;
 * real designs must follow the applicable standard and site survey.
 */
import type {Device} from '../domain/types.js';

export const PPM_BANDS=[
 {id:'detect',label:'Detection',ppm:25},
 {id:'observe',label:'Observation',ppm:62},
 {id:'recognise',label:'Recognition',ppm:125},
 {id:'identify',label:'Identification',ppm:250},
] as const;
export type Band=typeof PPM_BANDS[number]['id'];
export const HORIZONTAL_PIXELS:Record<string,number>={'720p':1280,'1080p':1920,'1440p':2560,'4K':3840};

const rad=(d:number)=>d*Math.PI/180;
/** Scene width (m) covered at a given distance. */
export function sceneWidthM(hfovDeg:number,distanceM:number):number{
 if(!(hfovDeg>0&&hfovDeg<180)||!(distanceM>0))throw new Error('Field of view must be 0-180 degrees and distance positive');
 return 2*distanceM*Math.tan(rad(hfovDeg)/2);
}
export function pixelsPerMetre(horizontalPixels:number,hfovDeg:number,distanceM:number):number{
 if(!(horizontalPixels>0))throw new Error('Horizontal pixels must be positive');
 return horizontalPixels/sceneWidthM(hfovDeg,distanceM);
}
/** Greatest distance at which a band is still met. */
export function maxDistanceForBand(horizontalPixels:number,hfovDeg:number,band:Band):number{
 const ppm=PPM_BANDS.find(b=>b.id===band)!.ppm;
 return horizontalPixels/(2*ppm*Math.tan(rad(hfovDeg)/2));
}
export function bandAt(horizontalPixels:number,hfovDeg:number,distanceM:number):Band|'none'{
 const v=pixelsPerMetre(horizontalPixels,hfovDeg,distanceM);
 let best:Band|'none'='none';
 for(const b of PPM_BANDS)if(v>=b.ppm)best=b.id;
 return best;
}
/** Cameras needed to cover a straight width at the given distance with the given overlap fraction. */
export function camerasForWidth(widthM:number,hfovDeg:number,distanceM:number,overlap=0.1):number{
 if(!(widthM>0))throw new Error('Width must be positive');
 if(overlap<0||overlap>=0.9)throw new Error('Overlap must be 0 to <0.9');
 return Math.ceil(widthM/(sceneWidthM(hfovDeg,distanceM)*(1-overlap))-1e-9); // epsilon: tan() rounding must not add a camera
}
/** Focal length (mm) giving the requested horizontal FOV for a sensor width (mm). */
export function focalLengthMm(sensorWidthMm:number,hfovDeg:number):number{
 return sensorWidthMm/(2*Math.tan(rad(hfovDeg)/2));
}
export function hfovForFocalLength(sensorWidthMm:number,focalMm:number):number{
 return 2*Math.atan(sensorWidthMm/(2*focalMm))*180/Math.PI;
}
/** Suggested mounting-height sanity check: tilt angle to a target at ground distance. */
export function tiltDegrees(mountHeightM:number,groundDistanceM:number,targetHeightM=1.6):number{
 return Math.atan2(mountHeightM-targetHeightM,groundDistanceM)*180/Math.PI;
}
export function analyseCamera(cam:Device,distanceM:number){
 const px=HORIZONTAL_PIXELS[cam.resolution||'1080p']??1920;
 return {horizontalPixels:px,ppm:pixelsPerMetre(px,cam.fov,distanceM),band:bandAt(px,cam.fov,distanceM),
  zones:PPM_BANDS.map(b=>({...b,maxDistanceM:maxDistanceForBand(px,cam.fov,b.id)}))};
}
