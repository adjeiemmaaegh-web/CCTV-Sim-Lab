import {describe,expect,it} from 'vitest';
import type {Project} from '../src/domain/types.js';
import {newProject} from '../src/scenarios/index.js';
import {createDevice} from '../src/domain/catalog.js';
import {simulate} from '../src/engine/simulator.js';
import {runCommand,initialCliState,prompt,type CliState} from '../src/tools/cli.js';
import {packetTrace} from '../src/tools/packetTrace.js';

function lab():Project{
 const p=newProject('ip-network');const devs=[...p.devices];
 const add=(id:string,x:number,y:number)=>{const d=createDevice(id,x,y,devs);devs.push(d);return d;};
 const sw=add('switch-managed-8',470,500),router=add('router-vlan',360,540),nvr=add('nvr-4',560,545),c1=add('cam-bullet',240,200),c2=add('cam-bullet',630,300);
 const wire=(a:string,b:string,aPort:number,bPort:number)=>({id:`w-${a}-${b}`,a,b,aPort,bPort,medium:'ethernet' as const,connected:true,lengthMeters:5});
 const cables=[wire(sw.id,router.id,1,1),wire(sw.id,c1.id,2,1),wire(sw.id,c2.id,3,1),wire(sw.id,nvr.id,4,1)];
 return {...p,devices:devs,cables};
}
function session(p:Project){let project=p,state:CliState=initialCliState();
 return {run(...lines:string[]){const outs:string[]=[];for(const l of lines){const r=runCommand(project,state,l);project=r.project;state=r.state;outs.push(...r.output);}return outs;},get project(){return project;},get state(){return state;}};
}
const nameOf=(p:Project,profileId:string,i=0)=>p.devices.filter(d=>d.profileId===profileId)[i].name;

describe('CLI',()=>{
 it('requires connect, enable and configure before changing anything',()=>{
  const s=session(lab());
  expect(s.run('show vlan')[0]).toMatch(/Not connected/);
  s.run(`connect ${nameOf(s.project,'switch-managed-8')}`);
  expect(s.run('switchport mode trunk')[0]).toMatch(/not available|Enter/);
  expect(s.run('show running-config')[0]).toMatch(/Privileged/);
  s.run('enable','configure terminal');
  expect(s.state.mode).toBe('config');
 });
 it('rejects invalid input without altering the project',()=>{
  const s=session(lab());const before=JSON.stringify(s.project);
  s.run(`connect ${nameOf(s.project,'switch-managed-8')}`,'enable','configure terminal','interface port 2');
  expect(s.run('switchport access vlan 5000')[0]).toMatch(/Invalid/);
  expect(s.run('interface port 99')[0]).toMatch(/Invalid port/);
  expect(JSON.stringify(s.project)).toBe(before);
 });
 it('configures the whole ip-network lab from scratch and routes camera -> NVR across VLANs',()=>{
  const s=session(lab());const p0=s.project;
  const sw=nameOf(p0,'switch-managed-8'),router=nameOf(p0,'router-vlan'),cam1=nameOf(p0,'cam-bullet',0),cam2=nameOf(p0,'cam-bullet',1),nvr=nameOf(p0,'nvr-4');
  // before configuration everything is on VLAN 10 with static 192.168.10.x addresses -> cameras reach NVR on one VLAN
  s.run(`connect ${sw}`,'enable','configure terminal',
   'interface port 1','switchport mode trunk','switchport trunk native vlan 10','switchport trunk allowed vlan 10,20','exit',
   'interface port 2','switchport mode access','switchport access vlan 20','exit',
   'interface port 3','switchport mode access','switchport access vlan 20','exit',
   'interface port 4','switchport mode access','switchport access vlan 10','end','exit','exit');
  s.run(`connect ${router}`,'enable','configure terminal','ip dhcp pool vlan 20 range 192.168.20.100 192.168.20.199 mask 255.255.255.0 gateway 192.168.20.1 dns 1.1.1.1','end','exit','exit');
  s.run(`connect ${cam1}`,'enable','configure terminal','vlan 20','ip address 192.168.20.21 255.255.255.0','ip default-gateway 192.168.20.1','end','exit','exit');
  s.run(`connect ${cam2}`,'enable','configure terminal','vlan 20','ip address dhcp','end','exit','exit');
  const r=simulate(s.project);
  expect(r.network!.addresses[s.project.devices.find(d=>d.name===cam2)!.id].source).toBe('dhcp');
  const out=s.run(`connect ${cam1}`,`ping ${nvr}`);
  expect(out.join('\n')).toMatch(/Reply from .*reachable/);
  expect(out.join('\n')).toMatch(/Routed by/);
 });
 it('show commands reflect configuration',()=>{
  const s=session(lab());
  const out=s.run(`connect ${nameOf(s.project,'router-vlan')}`,'enable','show running-config','show ip route');
  expect(out.join('\n')).toMatch(/interface vlan 10/);
  expect(out.join('\n')).toMatch(/directly connected/);
  expect(prompt(s.project,s.state)).toMatch(/#$/);
 });
 it('ping fails with a reason when the VLAN trunk is missing',()=>{
  const s=session(lab());const p0=s.project;
  const cam1=nameOf(p0,'cam-bullet',0),nvr=nameOf(p0,'nvr-4');
  s.run(`connect ${cam1}`,'enable','configure terminal','vlan 20','ip address 192.168.20.21 255.255.255.0','ip default-gateway 192.168.20.1','end');
  const out=s.run(`ping ${nvr}`).join('\n');
  expect(out).toMatch(/failed/i);
 });
});

describe('packet trace',()=>{
 it('explains a successful routed path hop by hop and a failed one by cause',()=>{
  const s=session(lab());const p0=s.project;
  const id=(n:string)=>s.project.devices.find(d=>d.name===n)!.id;
  const cam1=nameOf(p0,'cam-bullet',0),nvr=nameOf(p0,'nvr-4');
  const same=packetTrace(s.project,id(cam1),id(nvr));
  expect(same.ok).toBe(true);
  expect(same.steps.some(x=>x.stage==='forward')).toBe(true);
  s.run(`connect ${cam1}`,'enable','configure terminal','vlan 20','ip address 192.168.20.21 255.255.255.0','ip default-gateway 192.168.20.1','end');
  const failed=packetTrace(s.project,id(cam1),id(nvr));
  expect(failed.ok).toBe(false);
  expect(failed.steps.at(-1)!.detail).toMatch(/FAILED/);
  expect(failed.steps.some(x=>x.stage==='decision'&&/gateway/.test(x.detail))).toBe(true);
 });
 it('reports unpowered devices',()=>{
  const p=lab();const cam=p.devices.find(d=>d.profileId==='cam-bullet')!,nvr=p.devices.find(d=>d.profileId==='nvr-4')!;
  const noCables={...p,cables:[]};
  const t=packetTrace(noCables,cam.id,nvr.id);
  expect(t.ok).toBe(false);
  expect(t.steps[0].stage).toBe('power');
 });
});
