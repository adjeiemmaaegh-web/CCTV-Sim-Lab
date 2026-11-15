import type {Cable,Device,Project,Scenario,Wall} from '../domain/types.js';
import {createDevice} from '../domain/catalog.js';
const box=(prefix:string,x:number,y:number,w:number,h:number):Wall[]=>[
 {id:`${prefix}-1`,kind:'wall',x1:x,y1:y,x2:x+w,y2:y},{id:`${prefix}-2`,kind:'wall',x1:x+w,y1:y,x2:x+w,y2:y+h},
 {id:`${prefix}-3`,kind:'wall',x1:x+w,y1:y+h,x2:x,y2:y+h},{id:`${prefix}-4`,kind:'wall',x1:x,y1:y+h,x2:x,y2:y}
];
export const SCENARIOS:Scenario[]=[
 {id:'home4',title:'01 · Four-camera home',description:'Protect the entrance, driveway, garden and side passage with a four-camera PoE/NVR system.',minCameras:4,budgetGhs:5000,baseline:'empty',
  targets:[{id:'gate',name:'Front gate',x:150,y:135,required:true},{id:'drive',name:'Driveway',x:780,y:140,required:true},{id:'garden',name:'Garden',x:720,y:510,required:true},{id:'side',name:'Side passage',x:135,y:500,required:true}],
  rooms:[{id:'living',name:'Living room',x:290,y:225,w:270,h:160},{id:'bed',name:'Bedroom',x:560,y:225,w:160,h:160}],
  walls:box('property',75,65,790,520).filter((_,i)=>i!==0).concat([{id:'p-front-left',kind:'wall',x1:75,y1:65,x2:425,y2:65},{id:'p-front-right',kind:'wall',x1:515,y1:65,x2:865,y2:65},{id:'room-sep',kind:'wall',x1:540,y1:230,x2:540,y2:390}])},
 {id:'shop3',title:'02 · Retail shop CCTV',description:'Secure a shop entrance, cash desk and stockroom under a limited installation budget.',minCameras:3,budgetGhs:4000,baseline:'empty',
  targets:[{id:'entry',name:'Customer entrance',x:185,y:130,required:true},{id:'cash',name:'Cash register',x:620,y:310,required:true},{id:'stock',name:'Stock room',x:730,y:505,required:true}],
  rooms:[{id:'front',name:'Sales floor',x:170,y:145,w:530,h:305},{id:'back',name:'Stock room',x:700,y:405,w:170,h:155}],
  walls:box('shop',85,65,800,515).filter((_,i)=>i!==0).concat([{id:'door-left',kind:'wall',x1:85,y1:65,x2:170,y2:65},{id:'door-right',kind:'wall',x1:255,y1:65,x2:885,y2:65},{id:'stock-sep',kind:'wall',x1:700,y1:410,x2:700,y2:485}])},
 {id:'diagnose4',title:'03 · Diagnose failed CCTV',description:'Repair a pre-installed system with a broken cable and an IP conflict; verify restored video recording.',minCameras:4,budgetGhs:5600,baseline:'faulty',
  targets:[{id:'t1',name:'Loading bay',x:170,y:160,required:true},{id:'t2',name:'Front counter',x:790,y:155,required:true},{id:'t3',name:'Rear storeroom',x:770,y:505,required:true},{id:'t4',name:'Side entrance',x:155,y:505,required:true}],
  rooms:[{id:'work',name:'Workshop',x:270,y:210,w:410,h:230}],
  walls:box('depot',75,70,790,510).filter((_,i)=>i!==0)}
];
export function newProject(scenarioId='home4'):Project {
 const s=SCENARIOS.find(x=>x.id===scenarioId);if(!s)throw new Error('Unknown scenario');const now=new Date().toISOString();
 const base:Project={schemaVersion:1,id:crypto.randomUUID(),title:s.title.replace(/^\d+ · /,''),scenarioId:s.id,createdAt:now,updatedAt:now,
  rooms:structuredClone(s.rooms),walls:structuredClone(s.walls),targets:structuredClone(s.targets),devices:[],cables:[],events:[],assessments:[],night:false,mainsOn:true,assisted:false};
 return s.baseline==='faulty'?exampleProject(base,true):base;
}
export function exampleProject(project:Project,faulty=false):Project {
 const s=SCENARIOS.find(x=>x.id===project.scenarioId)!;
 let devices:Device[]=[];const add=(id:string,x:number,y:number)=>{const d=createDevice(id,x,y,devices);devices.push(d);return d;};
 const sw=add(s.minCameras>4?'switch-8':'switch-4',475,510),nvr=add(s.minCameras>4?'nvr-8':'nvr-4',560,545);
 const cameraPositions=s.targets.map((t,i)=>{
  const offsets=[[60,15],[-60,18],[-60,-20],[60,-20]];const o=offsets[i%offsets.length];
  return {x:t.x+o[0],y:t.y+o[1],heading:Math.atan2(-o[1],-o[0])*180/Math.PI};
 });
 for(let i=0;i<s.minCameras;i++){
  const pos=cameraPositions[i],d=add(['cam-bullet','cam-turret','cam-dome','cam-bullet'][i%4],pos.x,pos.y);
  d.heading=pos.heading;d.ip=`192.168.10.${21+i}`;d.range=210;
 }
 nvr.ip='192.168.10.10';
 const cables:Cable[]=[];const connect=(a:Device,b:Device)=>cables.push({id:`cable-${cables.length+1}`,a:a.id,b:b.id,connected:true,lengthMeters:Math.max(1,Math.round(Math.hypot(a.x-b.x,a.y-b.y)/10))});
 for(const camera of devices.filter(d=>d.id!==nvr.id&&d.id!==sw.id))connect(camera,sw);
 connect(sw,nvr);
 if(faulty){cables[0].connected=false;const cam2=devices.find(d=>d.id===cables[1]?.a);if(cam2)cam2.ip=devices.find(d=>d.id===cables[2]?.a)?.ip||cam2.ip;}
 return {...project,devices,cables,events:[],assessments:[],assisted:!faulty,updatedAt:new Date().toISOString()};
}
