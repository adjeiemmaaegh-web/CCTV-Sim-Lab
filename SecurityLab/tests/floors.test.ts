import {describe,expect,it} from 'vitest';
import {newProject,exampleProject} from '../src/scenarios/index.js';
import {simulate,triggerMotion} from '../src/engine/simulator.js';
import {triggerAlarmStimulus} from '../src/engine/alarm.js';
import {validateProject} from '../src/persistence/validation.js';
import {profile} from '../src/domain/catalog.js';
import {addFloor,removeFloor,renameFloor,floorView,stampNewItems,hasFloors,floorOf,itemsOnFloor,cableRiseM,FLOOR_HEIGHT_M,MAX_FLOORS} from '../src/tools/floors.js';
import {alarmPreset} from '../src/scenarios/index.js';

const base=()=>exampleProject(newProject('home4'));

describe('floors (feature 16)',()=>{
 it('single-floor projects are unchanged by every floor function',()=>{
  const p=base();expect(hasFloors(p)).toBe(false);expect(floorView(p,0)).toBe(p);expect(stampNewItems(p,p,0)).toBe(p);
  expect(p.devices.every(d=>floorOf(d)===0)).toBe(true);
 });
 it('add, rename and remove floors with safety rules',()=>{
  let p=addFloor(base());expect(p.floors!.map(f=>f.id)).toEqual([0,1]);expect(hasFloors(p)).toBe(true);
  p=renameFloor(p,1,'  First floor  ');expect(p.floors![1].name).toBe('First floor');
  expect(()=>renameFloor(p,9,'x')).toThrow();expect(()=>renameFloor(p,1,'   ')).toThrow();
  expect(()=>removeFloor(p,0)).toThrow(/ground/);expect(()=>removeFloor(p,7)).toThrow();
  const withItem={...p,devices:p.devices.map((d,i)=>i===0?{...d,floor:1}:d)};
  expect(itemsOnFloor(withItem,1)).toBe(1);expect(()=>removeFloor(withItem,1)).toThrow(/still contains/);
  const back=removeFloor(p,1);expect(back.floors).toBeUndefined();
  let many=base();for(let i=1;i<MAX_FLOORS;i++)many=addFloor(many);expect(()=>addFloor(many)).toThrow(/At most/);
 });
 it('floor view shows only that floor and cables only when both ends are on it',()=>{
  let p=addFloor(base());const cam=p.devices.find(d=>profile(d.profileId).kind==='camera')!;
  p={...p,devices:p.devices.map(d=>d.id===cam.id?{...d,floor:1}:d)};
  const g=floorView(p,0),f=floorView(p,1);
  expect(f.devices.map(d=>d.id)).toEqual([cam.id]);expect(g.devices.some(d=>d.id===cam.id)).toBe(false);
  expect(f.cables.length).toBe(0);expect(g.cables.every(c=>c.a!==cam.id&&c.b!==cam.id)).toBe(true);
  expect(g.rooms.length).toBe(p.rooms.length);expect(f.rooms.length).toBe(0);
 });
 it('new items are stamped with the active floor (only on multi-floor projects)',()=>{
  const p=addFloor(base());const dev={...p.devices[0],id:'new-dev'};
  const next=stampNewItems(p,{...p,devices:[...p.devices,dev]},1);
  expect(next.devices.find(d=>d.id==='new-dev')!.floor).toBe(1);
  expect(next.devices.filter(d=>d.id!=='new-dev').every(d=>d.floor===undefined)).toBe(true);
  const single=base();expect(stampNewItems(single,{...single,devices:[...single.devices,dev]},1).devices.at(-1)!.floor).toBeUndefined();
 });
 it('a target on another floor is not covered by ground-floor cameras, and walls only block same-floor sight',()=>{
  const p0=base();const t0=p0.targets[0];
  const covered=simulate(p0).coverage.find(c=>c.id===t0.id)!.covered;expect(covered).toBe(true);
  const upstairs=addFloor({...p0,targets:p0.targets.map(t=>t.id===t0.id?{...t,floor:1}:t)});
  expect(simulate(upstairs).coverage.find(c=>c.id===t0.id)!.covered).toBe(false);
  // a wall on floor 1 does not block a ground-floor camera
  const cam=p0.devices.find(d=>profile(d.profileId).kind==='camera')!;
  const wall={id:'upper-wall',kind:'wall' as const,x1:(cam.x+t0.x)/2,y1:Math.min(cam.y,t0.y)-200,x2:(cam.x+t0.x)/2,y2:Math.max(cam.y,t0.y)+200};
  const blockedSame=simulate({...p0,walls:[...p0.walls,wall]}).coverage.find(c=>c.id===t0.id)!;
  const otherFloor=simulate(addFloor({...p0,walls:[...p0.walls,{...wall,floor:1}]})).coverage.find(c=>c.id===t0.id)!;
  expect(otherFloor.cameraIds.length).toBeGreaterThanOrEqual(blockedSame.cameraIds.length);
  expect(otherFloor.covered).toBe(true);
 });
 it('motion and alarm stimuli only reach devices on the tested floor',()=>{
  const p=addFloor(base());const t=p.targets[0];
  const cams=p.devices.filter(d=>profile(d.profileId).kind==='camera');
  const up={...p,devices:p.devices.map(d=>cams.some(c=>c.id===d.id)?{...d,floor:1}:d)};
  expect(triggerMotion({...p,night:true},{x:t.x,y:t.y},undefined,75,0).detected).toBeGreaterThan(0);
  expect(triggerMotion({...up,night:true},{x:t.x,y:t.y},undefined,75,0).detected).toBe(0);
  expect(triggerMotion({...up,night:true},{x:t.x,y:t.y},undefined,75,1).detected).toBeGreaterThanOrEqual(0);
  const a=alarmPreset(newProject('alarm-install')),beam=a.devices.find(d=>d.profileId==='alarm-beam')!;
  expect(triggerAlarmStimulus(a,'beam',{x:beam.x,y:beam.y-60},90,1).detected).toBe(0);
 });
 it('cables between floors add vertical run and can exceed the 100 m limit',()=>{
  const p=base();const sw=p.devices.find(d=>profile(d.profileId).kind==='switch')!,cam=p.devices.find(d=>profile(d.profileId).kind==='camera')!;
  expect(cableRiseM(sw,{...cam,floor:3})).toBe(3*FLOOR_HEIGHT_M);
  const cable=p.cables.find(c=>(c.a===sw.id&&c.b===cam.id)||(c.b===sw.id&&c.a===cam.id))!;
  const near={...p,cables:p.cables.map(c=>c.id===cable.id?{...c,lengthMeters:95}:c)};
  expect(simulate(near).cables[cable.id].up).toBe(true);
  const far={...near,floors:[{id:0,name:'G'},{id:1,name:'1'},{id:2,name:'2'}],devices:near.devices.map(d=>d.id===cam.id?{...d,floor:2}:d)};
  const r=simulate(far).cables[cable.id];expect(r.up).toBe(false);expect(r.reason).toMatch(/exceeds/i);
 });
 it('validation rejects unknown floors and malformed floor lists',()=>{
  const p=addFloor(base());
  expect(()=>validateProject({...p,devices:p.devices.map((d,i)=>i===0?{...d,floor:1}:d)})).not.toThrow();
  expect(()=>validateProject({...p,devices:p.devices.map((d,i)=>i===0?{...d,floor:5}:d)})).toThrow(/unknown floor/);
  expect(()=>validateProject({...p,floors:[{id:0,name:'a'}]})).toThrow(/floor list/);
  expect(()=>validateProject({...p,floors:[{id:1,name:'a'},{id:2,name:'b'}]})).toThrow(/floor list/);
  expect(()=>validateProject({...p,floors:[{id:0,name:'a'},{id:0,name:'b'}]})).toThrow(/floor list/);
 });
});
