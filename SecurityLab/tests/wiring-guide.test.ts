import {describe,expect,it} from 'vitest';
import {createDevice} from '../src/domain/catalog.js';
import {newProject} from '../src/scenarios/index.js';
import {ethernetPortChoices,suggestEthernetPorts,usedEthernetPorts,validatePortChange} from '../src/tools/wiring-guide.js';
import type {Cable,Device,Project} from '../src/domain/types.js';

const rig=()=>{
 const project=newProject('home4'),devices:Device[]=[];
 const make=(id:string)=>{const d=createDevice(id,100+devices.length*50,170,devices);devices.push(d);return d;};
 const sw=make('switch-4'),first=make('cam-bullet'),second=make('cam-dome'),nvr=make('nvr-4');
 return {project:{...project,devices} as Project,sw,first,second,nvr};
};
const wire=(a:Device,b:Device,aPort:number,bPort:number):Cable=>({id:'wire-'+a.id.slice(-8)+'-'+b.id.slice(-8),a:a.id,b:b.id,connected:true,medium:'ethernet',lengthMeters:12,aPort,bPort});
describe('guided virtual installation',()=>{
 it('uses modeled PoE outputs for cameras and reserves an uplink for the NVR',()=>{
  const r=rig(),p=r.project;
  const a=suggestEthernetPorts(p,r.first,r.sw);
  expect(a.ok).toBe(true);expect(a.aPort).toBe(1);expect(a.bPort).toBe(1);
  p.cables.push(wire(r.first,r.sw,a.aPort!,a.bPort!));
  const b=suggestEthernetPorts(p,r.second,r.sw);
  expect(b.ok).toBe(true);expect(b.bPort).toBe(2);
  p.cables.push(wire(r.second,r.sw,b.aPort!,b.bPort!));
  const c=suggestEthernetPorts(p,r.sw,r.nvr);
  expect(c.ok).toBe(true);expect(c.aPort).toBe(5);
 });
 it('does not allow a second cable to silently claim a used virtual port',()=>{
  const r=rig(),p=r.project,c=wire(r.first,r.sw,1,1);p.cables=[c];
  expect(validatePortChange(p,c,'b',1)).toBeNull();
  const other=wire(r.second,r.sw,1,2);p.cables.push(other);
  expect(validatePortChange(p,other,'b',1)).toMatch(/already occupied/);
  expect(ethernetPortChoices(p,r.sw.id,other.id,r.second.id).find(x=>x.number===1)?.available).toBe(false);
 });
 it('shows all occupied interfaces and refuses a sixth link on a five-port switch',()=>{
  const r=rig(),p=r.project;
  const others=[r.first,r.second,r.nvr,createDevice('cam-bullet',200,300,p.devices),createDevice('cam-dome',300,300,p.devices)];
  p.devices.push(others[3],others[4]);
  p.cables=others.map((d,i)=>wire(d,r.sw,1,i+1));
  expect(usedEthernetPorts(p,r.sw.id).size).toBe(5);
  const sixth=createDevice('cam-4k',400,300,p.devices);p.devices.push(sixth);
  expect(suggestEthernetPorts(p,sixth,r.sw).reason).toMatch(/No unused virtual Ethernet ports/);
 });
 it('supports legacy automatic cables without rewriting the project data',()=>{
  const r=rig(),p=r.project;
  const existing=wire(r.first,r.sw,1,1);delete existing.bPort;p.cables=[existing];
  const choices=ethernetPortChoices(p,r.sw.id,undefined,r.second.id);
  expect(choices.find(x=>x.number===1)?.usedBy).toBe(existing.id);
  expect(choices.filter(x=>x.available).length).toBe(4);
  expect(existing.bPort).toBeUndefined();
 });
 it('rejects camera-to-camera links with no forwarding equipment',()=>{
  const r=rig();expect(suggestEthernetPorts(r.project,r.first,r.second)).toMatchObject({ok:false});
 });
});
