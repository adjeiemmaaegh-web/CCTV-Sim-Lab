import {describe,expect,it} from 'vitest';
import {newProject,exampleProject} from '../src/scenarios/index.js';
import {simulate,injectFault} from '../src/engine/simulator.js';
import {guidedDiagnostics} from '../src/tools/diagnostics-guide.js';
import {createDevice} from '../src/domain/catalog.js';

describe('evidence-backed troubleshooting',()=>{
 const rig=()=>exampleProject(newProject('home4'));
 it('shows a factual starting instruction instead of calling an empty project healthy',()=>{
  const p=newProject('home4');const r=guidedDiagnostics(p,simulate(p));
  expect(r).toHaveLength(1);expect(r[0].id).toBe('start');expect(r[0].severity).toBe('info');
 });
 it('identifies the exact disconnected cable and updates after a repair',()=>{
  const p=rig(),broken=injectFault(p,'disconnect').project;
  const cable=broken.cables.find(c=>!c.connected)!;
  const issue=guidedDiagnostics(broken,simulate(broken)).find(x=>x.id==='cable:'+cable.id);
  expect(issue).toBeDefined();expect(issue?.entity).toEqual({kind:'cable',id:cable.id});
  expect(issue?.area).toBe('cable');
  expect(issue?.nextStep).toMatch(/Connected/);
  const fixed={...broken,cables:broken.cables.map(c=>c.id===cable.id?{...c,connected:true}:c)};
  expect(guidedDiagnostics(fixed,simulate(fixed)).some(x=>x.id==='cable:'+cable.id)).toBe(false);
 });
 it('distinguishes duplicate IPv4 addresses from physical PoE problems',()=>{
  const ip=injectFault(rig(),'ipconflict').project;
  const a=guidedDiagnostics(ip,simulate(ip));
  expect(a.some(f=>f.area==='ip'&&/IP|IPv4|addresses|subnet/i.test(f.nextStep))).toBe(true);
  const low=injectFault(rig(),'lowpoe').project;
  const b=guidedDiagnostics(low,simulate(low));
  expect(b.some(f=>f.area==='power'&&/PoE|power/i.test(f.nextStep))).toBe(true);
 });
 it('returns stable bounded findings and does not mutate its project',()=>{
  const p=injectFault(rig(),'storage').project;
  const original=JSON.stringify(p);
  const r=simulate(p),first=guidedDiagnostics(p,r),second=guidedDiagnostics(p,r);
  expect(first).toEqual(second);
  expect(first.length).toBeLessThanOrEqual(24);
  expect(JSON.stringify(p)).toBe(original);
  expect(first.every(x=>x.nextStep.length>20&&x.evidence.length>0)).toBe(true);
 });

 it('distinguishes a non-PoE uplink from a generic port collision',()=>{
  const base=newProject('home4'),sw=createDevice('switch-4',420,360,[]),camera=createDevice('cam-bullet',200,200,[sw]);
  const p={...base,devices:[sw,camera],cables:[{id:'nonpoe',a:camera.id,b:sw.id,aPort:1,bPort:5,connected:true,medium:'ethernet' as const,lengthMeters:20}]};
  const findings=guidedDiagnostics(p,simulate(p));
  const cam=findings.find(f=>f.entity?.kind==='device'&&f.entity.id===camera.id);
  expect(cam?.area).toBe('power');
  expect(cam?.nextStep).toMatch(/PoE|power/i);
 });

});
