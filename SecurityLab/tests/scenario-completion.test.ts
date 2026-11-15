import {describe,expect,it} from 'vitest';
import type {Project} from '../src/domain/types.js';
import {newProject,exampleProject,scenarioFor} from '../src/scenarios/index.js';
import {simulate,triggerMotion,advanceRecording} from '../src/engine/simulator.js';
import {commandAlarm,triggerAlarmStimulus,advanceAlarmTime} from '../src/engine/alarm.js';
import {presentAccessToken,requestExit} from '../src/engine/access.js';
import {createDevice,profile} from '../src/domain/catalog.js';
import {evaluateScenario} from '../src/scenarios/evaluation.js';
import {assess} from '../src/engine/assessment.js';

const status=(p:Project)=>{const e=evaluateScenario(p,simulate(p));return {e,missing:e.objectives.filter(o=>!o.complete).map(o=>`${o.id}:${o.measured}/${o.required}`)};};
const kind=(p:Project,k:string)=>p.devices.filter(d=>profile(d.profileId).kind===k);

function cctv(id:string){
 const s=scenarioFor(id)!;let p={...exampleProject(newProject(id)),night:true};
 const t=s.targets[0];
 return advanceRecording(triggerMotion(p,{x:t.x,y:t.y}).project,5);
}
function alarm(id:string){
 let p=exampleProject(newProject(id));
 if(id==='alarm-install'){const panel=kind(p,'alarm-panel')[0];const pir=createDevice('alarm-pir',560,300,p.devices);
  p={...p,devices:[...p.devices,pir],cables:[...p.cables,{id:'extra-pir-wire',a:panel.id,b:pir.id,medium:'alarm',connected:true,lengthMeters:10}]};}
 const panel=kind(p,'alarm-panel')[0],beam=p.devices.find(d=>d.profileId==='alarm-beam')!;
 p=advanceAlarmTime(commandAlarm(p,panel.id,'away','1234'),60);
 p=advanceAlarmTime(triggerAlarmStimulus(p,'beam',{x:beam.x,y:beam.y-60}).project,5);
 if(id==='perimeter'){const cam=p.devices.find(d=>profile(d.profileId).kind==='camera')!;
  p={...p,night:true};p=advanceRecording(triggerMotion(p,{x:cam.x,y:cam.y-70}).project,5);}
 return p;
}

describe('scenarios can be completed through engine actions (assisted rig + learner actions)',()=>{
 for(const id of ['home4','home8','shop3','warehouse8','diagnose4'])
  it(`${id} (CCTV)`,()=>{const {missing}=status(cctv(id));expect(missing).toEqual([]);});
 for(const id of ['alarm-install','perimeter'])
  it(`${id} (alarm)`,()=>{const {missing}=status(alarm(id));expect(missing).toEqual([]);});
});

describe('no free marks',()=>{
 for(const id of ['home4','alarm-install','rfid-access','solar-backup','ip-network'])
  it(`${id}: example rig alone does not complete the scenario`,()=>{expect(status(exampleProject(newProject(id))).e.allComplete).toBe(false);});
});

function ipNetwork(){
 let p=newProject('ip-network');const s=scenarioFor('ip-network')!;
 const devs=[...p.devices];const add=(id:string,x:number,y:number)=>{const d=createDevice(id,x,y,devs);devs.push(d);return d;};
 const sw=add('switch-managed-8',470,500),router=add('router-vlan',360,540),nvr=add('nvr-4',560,545);
 const c1=add('cam-bullet',s.targets[0].x+40,s.targets[0].y+10),c2=add('cam-bullet',s.targets[1].x-40,s.targets[1].y);
 const port=(n:number,mode:'access'|'trunk',vlan:number)=>({number:n,mode,accessVlan:vlan,nativeVlan:vlan===20&&mode==='trunk'?10:vlan,allowedVlans:mode==='trunk'?[10,20]:[vlan],speedMbps:1000});
 sw.portConfigs=[{...port(1,'trunk',10),nativeVlan:10},port(2,'access',20),port(3,'access',20),port(4,'access',10)];
 nvr.vlanId=10;nvr.ip='192.168.10.10';nvr.gateway='192.168.10.1';
 c1.vlanId=20;c1.ip='192.168.20.21';c1.gateway='192.168.20.1';c1.heading=Math.atan2(-10,-40)*180/Math.PI;c1.range=215;
 c2.vlanId=20;c2.addressMode='dhcp';c2.gateway='192.168.20.1';c2.heading=0;c2.range=215;
 router.dhcpPools=[...router.dhcpPools!,{vlanId:20,start:'192.168.20.100',end:'192.168.20.199',mask:'255.255.255.0',gateway:'192.168.20.1',dns:'1.1.1.1'}];
 const wire=(a:string,b:string,aPort:number,bPort:number)=>({id:`w-${a}-${b}`,a,b,aPort,bPort,medium:'ethernet' as const,connected:true,lengthMeters:5});
 const cables=[wire(sw.id,router.id,1,1),wire(sw.id,c1.id,2,1),wire(sw.id,c2.id,3,1),wire(sw.id,nvr.id,4,1)];
 return {...p,devices:devs,cables};
}
describe('ip-network scenario built from scratch by a learner',()=>{
 it('reaches DHCP lease, inter-VLAN routing, camera recording and a stored event',()=>{
  let p=ipNetwork();
  const s=scenarioFor('ip-network')!;
  const r=simulate(p);
  expect(Object.keys(r.network!.dhcpLeases).length).toBeGreaterThan(0);
  p=advanceRecording(triggerMotion({...p,night:true},{x:s.targets[0].x,y:s.targets[0].y}).project,5);
  const {missing}=status(p);
  expect(missing).toEqual([]);
 });
 it('breaks routing (and loses marks) when the router is removed',()=>{
  const p=ipNetwork();const noRouter={...p,devices:p.devices.filter(d=>d.profileId!=='router-vlan'),cables:p.cables.filter(c=>!c.id.includes(p.devices.find(d=>d.profileId==='router-vlan')!.id))};
  expect(status(noRouter).missing.some(m=>m.startsWith('route:')||m.startsWith('router:'))).toBe(true);
 });
});

function access(){
 let p=exampleProject(newProject('rfid-access'));
 const ctrl=kind(p,'access-controller')[0],reader=kind(p,'access-reader')[0],exit=kind(p,'access-exit')[0];
 const idn={id:'id-1',name:'Trainee A',enabled:true,cardToken:'CARD-A',pinToken:'',biometricToken:'',grants:[{controllerId:ctrl.id,days:[0,1,2,3,4,5,6],startMinute:0,endMinute:1440}]};
 p={...p,accessIdentities:[idn]};
 return {p,ctrl,reader,exit};
}
describe('rfid-access scenario',()=>{
 it('grants a valid card, denies an unknown card, honours request-to-exit',()=>{
  let {p,ctrl,reader,exit}=access();
  p=presentAccessToken(p,ctrl.id,reader.id,'card','CARD-A');
  p=presentAccessToken(p,ctrl.id,reader.id,'card','UNKNOWN');
  p=requestExit(p,ctrl.id,exit.id);
  expect(status(p).missing).toEqual([]);
 });
 it('revoking the identity removes the grant evidence',()=>{
  let {p,ctrl,reader}=access();
  p=presentAccessToken(p,ctrl.id,reader.id,'card','CARD-A');
  p={...p,accessIdentities:p.accessIdentities!.map(i=>({...i,enabled:false}))};
  expect(status(p).missing.some(m=>m.startsWith('grant:'))).toBe(true);
 });
});

describe('solar-backup scenario',()=>{
 it('passes only after a real mains outage on battery with cameras still recording',()=>{
  const base=exampleProject(newProject('solar-backup'));
  expect(status(base).missing).toContain('outage:0/1');
  const outage={...base,mainsOn:false,powerSettings:{mode:'wired' as const,solarPercent:100,virtualMinutes:0}};
  expect(status(outage).missing).toEqual([]);
 });
 it('assessment of a completed assisted example is never a competency pass',()=>{
  const p={...cctv('home4')};
  expect(p.assisted).toBe(true);
  const a=assess(p);
  expect(a.passed).toBe(false);
  expect(a.score).toBeLessThanOrEqual(75);
  // the same work done without assistance passes
  const solo=assess({...p,assisted:false});
  expect(solo.passed).toBe(true);
 });
});
