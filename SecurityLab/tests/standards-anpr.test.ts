import {describe,expect,it} from 'vitest';
import {newProject,exampleProject,firePreset,alarmPreset} from '../src/scenarios/index.js';
import {createDevice,profile} from '../src/domain/catalog.js';
import {reviewProject,summarise,DISCLAIMER,RULE_SETS} from '../src/tools/standards.js';
import {anprCheck,pixelsPerMetre} from '../src/tools/lens.js';

describe('standards checklists (feature 14)',()=>{
 it('empty project: rules are not applicable instead of failing',()=>{
  const r=reviewProject(newProject('home4'));
  expect(r.every(x=>x.status!=='fail')).toBe(true);expect(r.some(x=>x.status==='na')).toBe(true);
 });
 it('worked CCTV example yields concrete pass/warn findings with details',()=>{
  const r=reviewProject(exampleProject(newProject('home4')),['cctv']);
  expect(r.length).toBeGreaterThanOrEqual(5);expect(r.every(x=>x.set==='cctv'&&x.detail.length>0)).toBe(true);
  expect(r.find(x=>x.id==='cctv-3')!.status).toBe('warn'); // no UPS in that rig
 });
 it('adding a UPS flips the UPS rule',()=>{
  const p=exampleProject(newProject('home4'));
  const ups=createDevice('power-ups',100,100,p.devices);
  expect(reviewProject({...p,devices:[...p.devices,ups]},['cctv']).find(x=>x.id==='cctv-3')!.status).toBe('pass');
 });
 it('alarm rules catch default PIN and a missing battery',()=>{
  const p=alarmPreset(newProject('alarm-install'));
  let r=reviewProject(p,['alarm']);expect(r.find(x=>x.id==='al-2')!.status).toBe('warn');expect(r.find(x=>x.id==='al-1')!.status).toBe('pass');
  const panel=p.devices.find(d=>profile(d.profileId).kind==='alarm-panel')!;
  const nb={...p,devices:p.devices.map(d=>d.id===panel.id?{...d,alarmPanel:{...d.alarmPanel!,batteryEnabled:false,pin:'8421'}}:d)};
  r=reviewProject(nb,['alarm']);expect(r.find(x=>x.id==='al-4')!.status).toBe('fail');expect(r.find(x=>x.id==='al-2')!.status).toBe('pass');
 });
 it('fire rules require 24-hour zones, coverage, sounder and call point',()=>{
  const p=firePreset(newProject('office-fire'));
  const r=reviewProject(p,['fire']);
  expect(r.find(x=>x.id==='fi-2')!.status).toBe('pass');
  expect(r.find(x=>x.id==='fi-3')!.status).toBe('warn');
  expect(r.find(x=>x.id==='fi-4')!.status).toBe('fail');
  expect(r.find(x=>x.id==='fi-1')!.status).toBe('warn'); // two detectors cannot cover every corner of both rooms
 });
 it('summary counts and disclaimer exist; four sets available',()=>{
  const s=summarise(reviewProject(exampleProject(newProject('home4'))));
  expect(s.pass+s.warn+s.fail+s.na).toBeGreaterThan(5);expect(DISCLAIMER).toMatch(/not a compliance certificate/i);expect(RULE_SETS.length).toBe(4);
 });
 it('rules are not generated for sets that are not selected',()=>{
  expect(reviewProject(exampleProject(newProject('home4')),['network']).every(x=>x.set==='network')).toBe(true);
 });
});

describe('ANPR check (feature 13)',()=>{
 it('passes close, slow, straight-on; fails far, fast or angled',()=>{
  expect(anprCheck(2560,28,10,10,5).ok).toBe(true);
  expect(anprCheck(2560,28,10,20,5).reasons.join()).toMatch(/blur/i); // 20 km/h at 1/1000 s still blurs ~2.8 px
  expect(anprCheck(2560,90,30,20,5).ok).toBe(false);
  expect(anprCheck(2560,28,10,120,5,1/250).reasons.join()).toMatch(/blur/i);
  expect(anprCheck(2560,28,10,20,45).reasons.join()).toMatch(/angle/i);
 });
 it('max distance is consistent with the pixel requirement',()=>{
  const r=anprCheck(2560,28,10,0,0);
  expect(pixelsPerMetre(2560,28,r.maxDistanceM)*0.52).toBeCloseTo(130,3);
  expect(anprCheck(2560,28,r.maxDistanceM*0.98,0,0).ok).toBe(true);expect(anprCheck(2560,28,r.maxDistanceM*1.05,0,0).ok).toBe(false);
 });
 it('rejects invalid inputs; ANPR camera profile exists with a narrow field of view',()=>{
  expect(()=>anprCheck(2560,28,10,-1,0)).toThrow();expect(()=>anprCheck(2560,28,10,10,90)).toThrow();expect(()=>anprCheck(2560,28,10,10,0,0)).toThrow();
  expect(profile('cam-anpr').defaultFov).toBeLessThan(40);
 });
});
