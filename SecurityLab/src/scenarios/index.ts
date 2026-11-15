import {sourceOf} from '../tools/scenarioPack.js';
import type {Cable,Device,Project,ScenarioChallenge,ScenarioState,Wall} from '../domain/types.js';
import {createDevice} from '../domain/catalog.js';
import {plannedPowerCable} from '../engine/power.js';
import {scenarioFor} from './definitions.js';
export {SCENARIOS,scenarioFor} from './definitions.js';

const now=()=>new Date().toISOString();
const wire=(a:Device,b:Device,medium:Cable['medium']='ethernet',connected=true):Cable=>({
 id:`cable-${crypto.randomUUID()}`,a:a.id,b:b.id,medium,connected,
 lengthMeters:Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/10))
});
const stage=(challenges:ScenarioChallenge[]=[]):ScenarioState=>({definitionVersion:1,startedAt:now(),challenges});
function installer(project:Project){
 const devices=[...project.devices],cables=[...project.cables];
 const add=(profileId:string,x:number,y:number):Device=>{const d=createDevice(profileId,x,y,devices);devices.push(d);return d;};
 const connect=(a:Device,b:Device,medium:Cable['medium']='ethernet',connected=true)=>{const c=wire(a,b,medium,connected);cables.push(c);return c;};
 const electrical=(a:Device,b:Device)=>{const path=plannedPowerCable(a,b);if(!path)throw new Error(`No valid virtual electrical connection between ${a.name} and ${b.name}`);const from=devices.find(d=>d.id===path.a)!,to=devices.find(d=>d.id===path.b)!;return connect(from,to,path.medium);};
 return {add,connect,electrical,finish:(changes:Partial<Project>={}):Project=>({...project,devices,cables,...changes})};
}
function cameraPreset(project:Project,faulty=false):Project{
 const s=scenarioFor(project.scenarioId);if(!s)throw new Error('Unknown exercise');
 const rig=installer(project);
 const sw=rig.add(s.minCameras>4?'switch-8':'switch-4',475,510);
 const nvr=rig.add(s.minCameras>4?'nvr-8':'nvr-4',560,545);
 nvr.ip='192.168.10.10';
 const cams:Device[]=[];const wires:Cable[]=[];
 for(let i=0;i<s.minCameras;i++){
  const target=s.targets[i%s.targets.length];const dirs=[[60,15],[-60,18],[-60,-20],[60,-20],[15,70],[-20,-70],[70,20],[-70,15]];
  const [ox,oy]=dirs[i%dirs.length],cam=rig.add(['cam-bullet','cam-turret','cam-dome','cam-bullet'][i%4],Math.max(30,Math.min(910,target.x+ox)),Math.max(30,Math.min(620,target.y+oy)));
  cam.heading=Math.atan2(-oy,-ox)*180/Math.PI;cam.range=215;cam.ip=`192.168.10.${21+i}`;
  cams.push(cam);wires.push(rig.connect(cam,sw));
 }
 rig.connect(sw,nvr);
 const challenges:ScenarioChallenge[]=[];
 if(faulty&&cams.length>=3){
  wires[0].connected=false;
  challenges.push({id:'video-cable',kind:'cable-repair',cableId:wires[0].id,label:'Video path fault',hint:'Trace the physical Ethernet run from the first camera to its PoE switch.'});
  cams[1].ip=cams[2].ip;
  challenges.push({id:'ip-conflict',kind:'ip-conflict',deviceId:cams[1].id,label:'Addressing fault',hint:'Compare IP assignments of the original cameras on the connected subnet.'});
 }
 return rig.finish({scenarioState:stage(challenges)});
}
function alarmPreset(project:Project,brokenBeam=false):Project{
 const rig=installer(project),panel=rig.add('alarm-panel-8',420,435),pir=rig.add('alarm-pir',355,255),keypad=rig.add('alarm-keypad',525,435),siren=rig.add('alarm-siren',700,140);
 const beam=rig.add('alarm-beam',445,155);beam.heading=-90;beam.range=145;beam.alarmDevice={...beam.alarmDevice!,zone:3};
 panel.alarmPanel={...panel.alarmPanel!,zones:panel.alarmPanel!.zones.map(z=>z.number===3?{...z,type:'instant'}:z)};
 rig.connect(panel,pir,'alarm');rig.connect(panel,keypad,'alarm');rig.connect(panel,siren,'alarm');
 const beamWire=rig.connect(panel,beam,'alarm',!brokenBeam);
 const challenges:ScenarioChallenge[]=brokenBeam?[{id:'beam-wire',kind:'alarm-wire-repair',cableId:beamWire.id,label:'Perimeter detector fault',hint:'Inspect the beam-to-panel supervised circuit for a disconnected conductor.'}]:[];
 if(brokenBeam){
  const sw=rig.add('switch-4',260,480),nvr=rig.add('nvr-4',355,505),cam=rig.add('cam-bullet',435,215);
  cam.heading=-90;cam.range=230;cam.ip='192.168.10.21';nvr.ip='192.168.10.10';rig.connect(cam,sw);rig.connect(sw,nvr);
 }
 return rig.finish({scenarioState:stage(challenges)});
}
function accessPreset(project:Project):Project{
 const rig=installer(project),controller=rig.add('access-controller-1',435,430),reader=rig.add('access-reader-card',485,290),lock=rig.add('access-maglock',525,335),exit=rig.add('access-exit-button',555,415);
 const door:Wall|undefined=project.walls.find(w=>w.kind==='door');
 if(door)controller.accessController={...controller.accessController!,doorWallId:door.id};
 [reader,lock,exit].forEach(d=>rig.connect(controller,d,'access'));
 return rig.finish({scenarioState:stage([])});
}
function solarPreset(project:Project):Project{
 const rig=installer(project);
 const grid=rig.add('power-grid',115,535),ups=rig.add('power-ups',220,535),ac=rig.add('power-ac-panel',345,520),solar=rig.add('power-solar',115,605),controller=rig.add('power-controller',225,605),battery=rig.add('power-battery',355,605),inverter=rig.add('power-inverter',475,605);
 rig.electrical(grid,ups);rig.electrical(ups,ac);rig.electrical(solar,controller);rig.electrical(controller,battery);rig.electrical(battery,inverter);rig.electrical(inverter,ac);
 const sw=rig.add('switch-4',550,505),nvr=rig.add('nvr-4',680,515),cam=rig.add('cam-bullet',290,165);
 cam.heading=-90;rig.electrical(ac,sw);rig.electrical(ac,nvr);rig.connect(cam,sw);rig.connect(sw,nvr);
 return rig.finish({scenarioState:stage([]),powerSettings:{mode:'wired',solarPercent:70,virtualMinutes:0}});
}
function starter(project:Project):Project{
 if(project.scenarioId==='perimeter')return alarmPreset(project,true);
 if(project.scenarioId==='alarm-install')return alarmPreset(project);
 if(project.scenarioId==='rfid-access')return accessPreset(project);
 if(project.scenarioId==='solar-backup')return solarPreset(project);
 return cameraPreset(project);
}

/** A new scenario is a real blank or incident-seeded project, not a scored demonstration. */
export function newProject(scenarioId='home4'):Project {
 const s=scenarioFor(scenarioId);if(!s)throw new Error('Unknown scenario');const timestamp=now();
 const base:Project={schemaVersion:2,id:crypto.randomUUID(),title:s.title.replace(/^\d+ · /,''),scenarioId:s.id,createdAt:timestamp,updatedAt:timestamp,
  rooms:structuredClone(s.rooms),walls:structuredClone(s.walls),targets:structuredClone(s.targets),devices:[],cables:[],events:[],assessments:[],night:false,mainsOn:true,assisted:false,
  scenarioState:stage(),...(s.id.startsWith('custom-')&&sourceOf(s.id)?{customScenario:structuredClone(sourceOf(s.id)) as unknown as Record<string,unknown>}:{})};
 if(s.baseline==='faulty')return {...cameraPreset(base,true),assisted:false};
 if(s.baseline==='starter')return {...starter(base),assisted:false};
 return base;
}
/** A worked example is explicitly marked assisted and never qualifies for a competency pass. */
export function exampleProject(project:Project,faulty=false):Project {
 const s=scenarioFor(project.scenarioId);if(!s)throw new Error('Unknown scenario');
 const empty={...project,devices:[],cables:[],events:[],clips:[],accessLog:[],assessments:[],scenarioState:stage()};
 const prepared=faulty?cameraPreset(empty,true):s.focus==='alarm'?alarmPreset(empty):s.focus==='access'?accessPreset(empty):s.focus==='power'?solarPreset(empty):s.id==='perimeter'?alarmPreset(empty,true):cameraPreset(empty,s.id==='diagnose4');
 if(!faulty&&['diagnose4','perimeter'].includes(s.id)){
  const repairedCables=prepared.cables.map(c=>prepared.scenarioState?.challenges.some(x=>x.cableId===c.id)?{...c,connected:true}:c);
  const repairTarget=prepared.scenarioState?.challenges.find(c=>c.kind==='ip-conflict')?.deviceId;
  const repairedDevices=prepared.devices.map(d=>d.id===repairTarget?{...d,ip:'192.168.10.199'}:d);
  return {...prepared,cables:repairedCables,devices:repairedDevices,assisted:true,updatedAt:now()};
 }
 return {...prepared,assisted:!faulty,updatedAt:now()};
}
