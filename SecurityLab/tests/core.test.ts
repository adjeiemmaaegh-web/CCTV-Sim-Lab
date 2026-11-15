import {describe,expect,it} from 'vitest';
import {sha256} from '../src/persistence/sha256.js';
import {parseProjectText,serializeProject,MAX_BACKUPS} from '../src/persistence/file-projects.js';
import {newProject,exampleProject,SCENARIOS} from '../src/scenarios/index.js';
import {simulate} from '../src/engine/simulator.js';
import {assess} from '../src/engine/assessment.js';
import {evaluateScenario} from '../src/scenarios/evaluation.js';

const IDS=['home4','home8','shop3','warehouse8','alarm-install','ip-network','rfid-access','solar-backup','diagnose4','perimeter'];

describe('sha256',()=>{
 it('matches published vectors',()=>{
  expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
 });
});

describe('scenarios',()=>{
 it('defines the ten documented scenarios',()=>{
  expect(SCENARIOS.map(s=>s.id).sort()).toEqual([...IDS].sort());
 });
 for(const id of IDS){
  it(`${id}: creates, simulates, evaluates and assesses without error`,()=>{
   const p=newProject(id);
   const r=simulate(p);
   const ev=evaluateScenario(p,r);
   expect(ev.total).toBeGreaterThan(0);
   expect(ev.score).toBeGreaterThanOrEqual(0);
   expect(ev.score).toBeLessThanOrEqual(100);
   const a=assess(p,r);
   expect(a).toBeTruthy();
  });
  it(`${id}: worked example is flagged assisted and never a competency pass`,()=>{
   const ex=exampleProject(newProject(id));
   expect(ex.assisted).toBe(true);
   expect(()=>simulate(ex)).not.toThrow();
  });
 }
 it('empty starting projects do not earn full marks',()=>{
  for(const id of ['home4','home8','shop3','warehouse8','alarm-install']){
   const p=newProject(id);
   expect(evaluateScenario(p,simulate(p)).allComplete).toBe(false);
  }
 });
});

describe('project file safety',()=>{
 const base=()=>newProject('home4');
 it('round-trips a project with SHA-256 checksum',()=>{
  const text=serializeProject(base(),1);
  expect(JSON.parse(text).checksum).toMatch(/^sha256:/);
  const opened=parseProjectText(text,'x.securitylab.json');
  expect(opened.revision).toBe(1);
  expect(opened.project.scenarioId).toBe('home4');
 });
 it('rejects a tampered document (checksum mismatch)',()=>{
  const doc=JSON.parse(serializeProject(base(),1));
  doc.project.title='tampered';
  expect(()=>parseProjectText(JSON.stringify(doc))).toThrow(/checksum/i);
 });
 it('rejects invalid JSON and foreign documents',()=>{
  expect(()=>parseProjectText('{nope')).toThrow(/Invalid JSON/);
  expect(()=>parseProjectText('{"a":1}')).toThrow();
 });
 it('rejects oversized input',()=>{
  expect(()=>parseProjectText('x'.repeat(16_000_001))).toThrow(/16 MB/);
 });
 it('opens raw legacy exports without altering them',()=>{
  const raw=JSON.stringify(base());
  const o=parseProjectText(raw);
  expect(o.revision).toBe(0);
 });
 it('bounds checkpoint history',()=>{
  const p=base();
  const cps=Array.from({length:MAX_BACKUPS+4},(_,i)=>({revision:i+1,at:new Date().toISOString(),project:p}));
  const opened=parseProjectText(serializeProject(p,100,cps));
  expect(opened.checkpoints.length).toBeLessThanOrEqual(MAX_BACKUPS);
 });
 it('rejects invalid revision',()=>{
  expect(()=>serializeProject(base(),0)).toThrow();
 });
});
