import {describe,expect,it} from 'vitest';
import {newProject,exampleProject,scenarioFor} from '../src/scenarios/index.js';
import {simulate,triggerMotion} from '../src/engine/simulator.js';
import {evaluatePower} from '../src/engine/power.js';
import {batteryTemperatureFactor,cameraRangeFactor,pirRangeFactor,applyEnvironment} from '../src/engine/environment.js';
import {validateProject} from '../src/persistence/validation.js';
import {pixelsPerMetre,maxDistanceForBand,bandAt,camerasForWidth,focalLengthMm,hfovForFocalLength,sceneWidthM,tiltDegrees} from '../src/tools/lens.js';
import {cameraView} from '../src/tools/cameraView.js';
import {dcDrop,minimumAwg,poeDelivery,analyseCables} from '../src/tools/cableEng.js';
import {gbPerDay,raidUsableTB,diskFailureOutcome,plan,planFromProject} from '../src/tools/storage.js';
import {profile} from '../src/domain/catalog.js';

describe('lens calculator (feature 4)',()=>{
 it('scene width and PPM match geometry',()=>{
  expect(sceneWidthM(90,10)).toBeCloseTo(20,6);
  expect(pixelsPerMetre(1920,90,10)).toBeCloseTo(96,6);
 });
 it('band distance is the inverse of PPM',()=>{
  const d=maxDistanceForBand(1920,90,'recognise');
  expect(pixelsPerMetre(1920,90,d)).toBeCloseTo(125,6);
  expect(bandAt(1920,90,d*0.99)).toBe('recognise');
  expect(bandAt(1920,90,d*1.2)).toBe('observe');
  expect(bandAt(1920,90,1000)).toBe('none');
 });
 it('camera count, focal length, and tilt',()=>{
  expect(camerasForWidth(60,90,10,0)).toBe(3);
  expect(camerasForWidth(60,90,10,0.5)).toBe(6);
  const f=focalLengthMm(6.4,90);expect(hfovForFocalLength(6.4,f)).toBeCloseTo(90,6);
  expect(tiltDegrees(3,10)).toBeCloseTo(Math.atan2(1.4,10)*180/Math.PI,9);
 });
 it('rejects invalid inputs',()=>{
  expect(()=>sceneWidthM(0,5)).toThrow();expect(()=>sceneWidthM(90,-1)).toThrow();expect(()=>camerasForWidth(10,90,5,0.95)).toThrow();
 });
});

describe('camera view (feature 3)',()=>{
 const base=()=>exampleProject(newProject('home4'));
 it('reports one column per ray and flags visible targets',()=>{
  const p=base();const cam=p.devices.find(d=>profile(d.profileId).kind==='camera')!;
  const v=cameraView(p,cam.id,32);
  expect(v.columns.length).toBe(32);
  expect(v.targets.length).toBe(p.targets.length);
  expect(v.targets.some(t=>t.visible)).toBe(true);
  expect(v.columns.every(c=>c.distance>0&&c.brightness>0)).toBe(true);
 });
 it('night with IR off shrinks range and notes it',()=>{
  const p=base();const cam=p.devices.find(d=>profile(d.profileId).kind==='camera')!;
  const day=cameraView({...p,night:false},cam.id);
  const dark=cameraView({...p,night:true,devices:p.devices.map(d=>d.id===cam.id?{...d,infraredEnabled:false}:d)},cam.id);
  expect(dark.rangeUnits).toBeLessThan(day.rangeUnits);
  expect(dark.notes.join(' ')).toMatch(/infrared disabled/i);
 });
 it('walls block targets',()=>{
  const p=base();const cam=p.devices.find(d=>profile(d.profileId).kind==='camera')!;
  const t={id:'t-x',name:'Behind wall',x:cam.x+60,y:cam.y};
  const wall={id:'w-x',kind:'wall' as const,x1:cam.x+30,y1:cam.y-40,x2:cam.x+30,y2:cam.y+40};
  const v=cameraView({...p,devices:p.devices.map(d=>d.id===cam.id?{...d,heading:0,fov:90,range:300}:d),targets:[t],walls:[...p.walls,wall]},cam.id);
  expect(v.targets[0].visible).toBe(false);expect(v.targets[0].reason).toMatch(/wall/i);
 });
 it('unknown camera throws',()=>{expect(()=>cameraView(base(),'nope')).toThrow();});
});

describe('cable engineering (feature 5)',()=>{
 it('DC voltage drop follows Ohm law and picks AWG',()=>{
  const d=dcDrop(12,1,50,22);expect(d.dropV).toBeCloseTo(1*2*50*0.053,9);expect(d.ok).toBe(false);
  expect(dcDrop(12,0.5,20,22).ok).toBe(true);
  expect(dcDrop(12,2,100,24).ok).toBe(false);
  const awg=minimumAwg(12,0.5,100)!;expect(awg).toBe(14);expect(dcDrop(12,0.5,100,awg).dropPercent).toBeLessThanOrEqual(10);
  expect(minimumAwg(12,50,500)).toBeNull();
  expect(()=>dcDrop(12,1,10,99)).toThrow();
 });
 it('PoE delivery: short runs fine, 100 m af camera fine, absurd loads fail',()=>{
  const short=poeDelivery(12,10);expect(short.ok).toBe(true);expect(short.pdVolts).toBeGreaterThan(49);
  const r=poeDelivery(12.95,100);expect(r.ok).toBe(true);
  expect(poeDelivery(12.95,150).ok).toBe(false);
  const heavy=poeDelivery(60,100);expect(heavy.ok).toBe(false);
  expect(poeDelivery(0,50).ok).toBe(true);
 });
 it('analyses project cables and flags overlength runs',()=>{
  const p=exampleProject(newProject('home4'));
  const findings=analyseCables(p);expect(findings.length).toBe(p.cables.length);
  const long={...p,cables:p.cables.map((c,i)=>i===0?{...c,lengthMeters:180}:c)};
  const f=analyseCables(long);expect(f[0].ok).toBe(false);expect(f[0].messages.join()).toMatch(/exceeds/);
 });
 it('reports virtual tester faults and blocks an Ethernet link',()=>{
  const p=exampleProject(newProject('home4'));
  const faulty={...p,cables:p.cables.map((c,i)=>i===0?{...c,termination:'split-pair' as const}:c)};
  const finding=analyseCables(faulty)[0];
  expect(finding.ok).toBe(false);expect(finding.messages.join(' ')).toMatch(/split pair/i);
  expect(simulate(faulty).cables[faulty.cables[0].id].reason).toMatch(/wire-map failed/i);
 });
});

describe('storage planner (feature 6)',()=>{
 it('GB/day arithmetic',()=>{expect(gbPerDay(8,1)).toBeCloseTo(86.4,6);expect(gbPerDay(8,0.25)).toBeCloseTo(21.6,6);});
 it('RAID capacity and failure tolerance',()=>{
  expect(raidUsableTB('raid5',4,4)).toBe(12);expect(raidUsableTB('raid6',6,4)).toBe(16);expect(raidUsableTB('raid10',4,4)).toBe(8);expect(raidUsableTB('raid1',2,4)).toBe(4);
  expect(()=>raidUsableTB('raid5',2,4)).toThrow();expect(()=>raidUsableTB('raid10',5,4)).toThrow();
  expect(diskFailureOutcome('raid5',4,0).state).toBe('healthy');
  expect(diskFailureOutcome('raid5',4,1).state).toBe('degraded');
  expect(diskFailureOutcome('raid5',4,2).state).toBe('failed');
  expect(diskFailureOutcome('none',1,1).state).toBe('failed');
  expect(diskFailureOutcome('raid6',6,2).state).toBe('degraded');
 });
 it('plans retention and finds disks needed',()=>{
  const cams=Array.from({length:8},(_,i)=>({name:`C${i}`,bitrateMbps:6,duty:1}));
  const r=plan(cams,30,'raid5',4,4);
  expect(r.gbPerDay).toBeCloseTo(8*gbPerDay(6),6);
  expect(r.ok).toBe(false);expect(r.disksForNeed).toBeGreaterThan(4);
  const r2=plan(cams,7,'raid5',4,4);expect(r2.ok).toBe(true);expect(r2.daysAchievable).toBeGreaterThan(7);
  expect(()=>plan(cams,0,'raid5',4,4)).toThrow();
 });
 it('derives cameras from a project',()=>{
  const p=exampleProject(newProject('home8'));const r=planFromProject(p);
  expect(r.cameras.length).toBe(8);expect(r.gbPerDay).toBeGreaterThan(0);
 });
});

describe('environment (feature 7)',()=>{
 it('factor tables are monotone and bounded',()=>{
  expect(batteryTemperatureFactor(25)).toBe(1);expect(batteryTemperatureFactor(-20)).toBe(0.5);
  expect(batteryTemperatureFactor(5)).toBeLessThan(1);expect(batteryTemperatureFactor(5)).toBeGreaterThan(batteryTemperatureFactor(-5));
  expect(batteryTemperatureFactor(45)).toBeLessThan(1);
  expect(cameraRangeFactor({weather:'fog',ambientC:20,glare:false},false,false)).toBeLessThan(cameraRangeFactor({weather:'rain',ambientC:20,glare:false},false,false));
  expect(cameraRangeFactor({weather:'clear',ambientC:20,glare:true},false,false)).toBe(0.85);
  expect(pirRangeFactor({weather:'clear',ambientC:34,glare:false})).toBeLessThan(1);
  expect(pirRangeFactor({weather:'clear',ambientC:20,glare:false})).toBe(1);
 });
 it('fog reduces camera range so a target stops being covered',()=>{
  const p=exampleProject(newProject('home4'));
  const clear=simulate(p).coverage.filter(c=>c.covered).length;
  const fog=simulate({...p,environment:{weather:'fog',ambientC:20,glare:false}}).coverage.filter(c=>c.covered).length;
  expect(fog).toBeLessThanOrEqual(clear);
  const dense=simulate({...p,environment:{weather:'fog',ambientC:20,glare:false},devices:p.devices.map(d=>({...d,range:d.range*0.2}))});
  expect(dense.coverage.filter(c=>c.covered).length).toBeLessThan(clear);
 });
 it('project data is never mutated by environment',()=>{
  const p={...exampleProject(newProject('solar-backup')),environment:{weather:'rain' as const,ambientC:-10,glare:false}};
  const before=JSON.stringify(p);applyEnvironment(p);simulate(p);expect(JSON.stringify(p)).toBe(before);
 });
 it('cold derates battery backup',()=>{
  const base=exampleProject(newProject('solar-backup'));
  const warm=evaluatePower({...base,mainsOn:false,powerSettings:{mode:'wired',solarPercent:0,virtualMinutes:0}});
  const coldProject=applyEnvironment({...base,mainsOn:false,powerSettings:{mode:'wired',solarPercent:0,virtualMinutes:0},environment:{weather:'clear',ambientC:-10,glare:false}});
  const cold=evaluatePower(coldProject);
  expect(cold.estimatedBackupMinutes).toBeLessThan(warm.estimatedBackupMinutes);
 });
 it('motion detection honours environment',()=>{
  const s=scenarioFor('home4')!;const p=exampleProject(newProject('home4'));
  const t=s.targets[0];
  const clear=triggerMotion({...p,night:false},{x:t.x,y:t.y}).detected;
  const tiny=triggerMotion({...p,night:false,environment:{weather:'dust',ambientC:20,glare:true},devices:p.devices.map(d=>({...d,range:d.range*0.05}))},{x:t.x,y:t.y}).detected;
  expect(tiny).toBeLessThan(clear);
 });
 it('validation accepts valid and rejects invalid environment',()=>{
  const p=newProject('home4');
  expect(()=>validateProject({...p,environment:{weather:'fog',ambientC:10,glare:true}})).not.toThrow();
  expect(()=>validateProject({...p,environment:{weather:'lava',ambientC:10,glare:true}})).toThrow();
  expect(()=>validateProject({...p,environment:{weather:'fog',ambientC:900,glare:true}})).toThrow();
 });
});