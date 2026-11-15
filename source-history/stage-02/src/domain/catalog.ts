import type {Device,Profile} from './types.js';

// Generic teaching devices. These are NOT real vendor emulations or firmware.
export const PROFILES:Profile[] = [
 {id:'cam-bullet',name:'IP Bullet • 2MP',kind:'camera',manufacturer:'SecurityLab',model:'TRAIN-BULLET-2',powerW:6.5,costGhs:480,ethernetPorts:1,poePorts:0,poeBudgetW:0,maxPortW:0,nvrChannels:0,defaultStorageGB:0,defaultFov:82,defaultRange:230,protocols:['IPv4','simulated video','PoE 802.3af'],simulated:true},
 {id:'cam-dome',name:'IP Dome • 4MP',kind:'camera',manufacturer:'SecurityLab',model:'TRAIN-DOME-4',powerW:9,costGhs:650,ethernetPorts:1,poePorts:0,poeBudgetW:0,maxPortW:0,nvrChannels:0,defaultStorageGB:0,defaultFov:105,defaultRange:205,protocols:['IPv4','simulated video','PoE 802.3af'],simulated:true},
 {id:'cam-turret',name:'IP Turret • 2MP',kind:'camera',manufacturer:'SecurityLab',model:'TRAIN-TURRET-2',powerW:7,costGhs:520,ethernetPorts:1,poePorts:0,poeBudgetW:0,maxPortW:0,nvrChannels:0,defaultStorageGB:0,defaultFov:96,defaultRange:205,protocols:['IPv4','simulated video','PoE 802.3af'],simulated:true},
 {id:'switch-4',name:'4-Port PoE+ Switch',kind:'switch',manufacturer:'SecurityLab',model:'TRAIN-POE-4',powerW:10,costGhs:590,ethernetPorts:5,poePorts:4,poeBudgetW:65,maxPortW:30,nvrChannels:0,defaultStorageGB:0,defaultFov:0,defaultRange:0,protocols:['Ethernet','PoE 802.3af/at'],simulated:true},
 {id:'switch-8',name:'8-Port PoE+ Switch',kind:'switch',manufacturer:'SecurityLab',model:'TRAIN-POE-8',powerW:16,costGhs:1050,ethernetPorts:9,poePorts:8,poeBudgetW:110,maxPortW:30,nvrChannels:0,defaultStorageGB:0,defaultFov:0,defaultRange:0,protocols:['Ethernet','PoE 802.3af/at'],simulated:true},
 {id:'nvr-4',name:'4-Channel NVR',kind:'nvr',manufacturer:'SecurityLab',model:'TRAIN-NVR-4',powerW:18,costGhs:950,ethernetPorts:1,poePorts:0,poeBudgetW:0,maxPortW:0,nvrChannels:4,defaultStorageGB:500,defaultFov:0,defaultRange:0,protocols:['IPv4','simulated recording'],simulated:true},
 {id:'nvr-8',name:'8-Channel NVR',kind:'nvr',manufacturer:'SecurityLab',model:'TRAIN-NVR-8',powerW:24,costGhs:1450,ethernetPorts:1,poePorts:0,poeBudgetW:0,maxPortW:0,nvrChannels:8,defaultStorageGB:1000,defaultFov:0,defaultRange:0,protocols:['IPv4','simulated recording'],simulated:true}
];
export const profile = (id:string):Profile => {const p=PROFILES.find(x=>x.id===id); if (!p) throw new Error(`Unknown training device profile ${id}`); return p;};
export function createDevice(profileId:string,x:number,y:number,existing:Device[]):Device {
 const p=profile(profileId), id=`dev-${crypto.randomUUID()}`, n=existing.filter(d=>d.profileId===profileId).length+1;
 const host=20+existing.length;
 return {id,profileId,name:`${p.name} ${n}`,x,y,heading:0,fov:p.defaultFov,range:p.defaultRange,
  ip:p.kind==='switch'?'':`192.168.10.${host}`,mask:'255.255.255.0',gateway:'192.168.10.1',enabled:true,motionEnabled:true,recordingEnabled:true,
  ...(p.kind==='switch'?{poeBudgetW:p.poeBudgetW}:{}),...(p.kind==='nvr'?{storageGB:p.defaultStorageGB,usedGB:0}:{})};
}
