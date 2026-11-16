import {describe,it,expect} from 'vitest';
import {PROFILES} from '../src/domain/catalog.js';
import {SCENARIOS,newProject} from '../src/scenarios/index.js';
import {SAMPLE_PROFILE} from '../src/tools/profilePack.js';
import {SAMPLE_PACK_SCENARIO} from '../src/tools/scenarioPack.js';
import {validateProject,activateProjectExtensions} from '../src/persistence/validation.js';
import {serializeProject,parseProjectText} from '../src/persistence/file-projects.js';

const unique=(name:string)=>'pack-integrity-'+name;
const fingerprint=()=>JSON.stringify({profiles:PROFILES,scenarios:SCENARIOS});

describe('untrusted project extension integrity',()=>{
 it('never installs an embedded profile or scenario while validating a rejected project',()=>{
  const before=fingerprint();
  const p=newProject();
  p.profilePack=[{...structuredClone(SAMPLE_PROFILE),id:unique('late-invalid')}];
  p.customScenario={...structuredClone(SAMPLE_PACK_SCENARIO),id:'custom-integrity-late-invalid'};
  // Failure occurs AFTER the embedded definitions have been evaluated.
  const invalid={...p,night:'invalid'};
  expect(()=>validateProject(invalid)).toThrow(/simulation state/);
  expect(fingerprint()).toBe(before);
 });

 it('rejects a bad checksum without changing shared registries',()=>{
  const p=newProject();
  p.profilePack=[{...structuredClone(SAMPLE_PROFILE),id:unique('bad-checksum')}];
  p.customScenario={...structuredClone(SAMPLE_PACK_SCENARIO),id:'custom-integrity-bad-checksum'};
  const before=fingerprint();
  const text=serializeProject(p,1);
  expect(fingerprint()).toBe(before);
  const doc=JSON.parse(text);
  doc.checksum='sha256:'+'0'.repeat(64);
  expect(()=>parseProjectText(JSON.stringify(doc))).toThrow(/checksum/i);
  expect(fingerprint()).toBe(before);
 });

 it('validates a complete file without registering its embedded models until adoption',()=>{
  const p=newProject();
  p.profilePack=[{...structuredClone(SAMPLE_PROFILE),id:unique('accepted')}];
  p.customScenario={...structuredClone(SAMPLE_PACK_SCENARIO),id:'custom-integrity-accepted'};
  const before=fingerprint();
  const parsed=parseProjectText(serializeProject(p,1));
  expect(fingerprint()).toBe(before);
  expect(parsed.project.profilePack?.[0]).toMatchObject({id:unique('accepted')});
  // Acceptance is a separate explicit step. Remove test registrations afterwards.
  try{
   activateProjectExtensions(parsed.project);
   expect(PROFILES.some(x=>x.id===unique('accepted'))).toBe(true);
   expect(SCENARIOS.some(x=>x.id==='custom-integrity-accepted')).toBe(true);
  }finally{
   const pIdx=PROFILES.findIndex(x=>x.id===unique('accepted'));if(pIdx>=0)PROFILES.splice(pIdx,1);
   const sIdx=SCENARIOS.findIndex(x=>x.id==='custom-integrity-accepted');if(sIdx>=0)SCENARIOS.splice(sIdx,1);
  }
  expect(fingerprint()).toBe(before);
 });

 it('rejects duplicate embedded models without registering either copy',()=>{
  const p=newProject();
  const duplicate={...structuredClone(SAMPLE_PROFILE),id:unique('duplicate')};
  p.profilePack=[duplicate,structuredClone(duplicate)];
  const before=fingerprint();
  expect(()=>validateProject(p)).toThrow(/Duplicate embedded device profile/);
  expect(fingerprint()).toBe(before);
 });
});
