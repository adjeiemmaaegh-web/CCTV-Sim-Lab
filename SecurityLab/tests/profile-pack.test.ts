import {describe,expect,it} from 'vitest';
import {newProject,exampleProject} from '../src/scenarios/index.js';
import {PROFILES,createDevice,profile} from '../src/domain/catalog.js';
import {simulate} from '../src/engine/simulator.js';
import {validateProject} from '../src/persistence/validation.js';
import {buildProfile,loadProfilePack,exportProfilePack,SAMPLE_PROFILE,validateSourceUrl,withEmbeddedProfiles,usedPackProfiles,ATTESTATION,packSourceOf} from '../src/tools/profilePack.js';
import {buildQuote} from '../src/tools/quote.js';

const clone=()=>structuredClone(SAMPLE_PROFILE) as any;
const bad=(patch:(p:any)=>void)=>()=>{const p=clone();patch(p);buildProfile(p);};

describe('profile pack validator (feature 20)',()=>{
 it('accepts the sample profile and forces price to zero and a [pack] provenance tag',()=>{
  const p=buildProfile(SAMPLE_PROFILE);
  expect(p.costGhs).toBe(0);expect(p.simulated).toBe(true);expect(p.manufacturerSpec!.sourceTitle.startsWith('[pack]')).toBe(true);expect(p.manufacturerSpec!.priceBasis).toBe('user-quote');
 });
 it('rejects every missing or unsafe field with a specific message',()=>{
  expect(bad(p=>{p.id='home4';})).toThrow(/pack-/);
  expect(bad(p=>{p.id='pack-ab';})).toThrow(/pack-/);
  expect(bad(p=>{p.kind='teleporter';})).toThrow(/kind must be/);
  expect(bad(p=>{p.manufacturer='SecurityLab';})).toThrow(/real maker/);
  expect(bad(p=>{p.powerW=-1;})).toThrow(/powerW/);
  expect(bad(p=>{p.poePorts=3;p.ethernetPorts=1;})).toThrow(/poePorts/);
  expect(bad(p=>{delete p.manufacturerSpec;})).toThrow(/manufacturerSpec/);
  expect(bad(p=>{p.manufacturerSpec.sourceUrl='http://example.com/x';})).toThrow(/https/);
  expect(bad(p=>{p.manufacturerSpec.sourceUrl='https://user:pw@example.com/x';})).toThrow(/credentials/);
  expect(bad(p=>{p.manufacturerSpec.sourceUrl='https://192.168.1.5/x';})).toThrow(/host name/);
  expect(bad(p=>{p.manufacturerSpec.sourceUrl='https://localhost/x';})).toThrow(/host name/);
  expect(bad(p=>{p.manufacturerSpec.documentedAt='yesterday';})).toThrow(/YYYY-MM-DD/);
  expect(bad(p=>{p.manufacturerSpec.documentedAt='2999-01-01';})).toThrow(/future/);
  expect(bad(p=>{p.manufacturerSpec.limitations=[];})).toThrow(/limitations/);
  expect(bad(p=>{p.manufacturerSpec.sourcedFacts=[];})).toThrow(/sourcedFacts/);
  expect(bad(p=>{p.manufacturerSpec.status='certified';})).toThrow(/status/);
  expect(bad(p=>{p.kind='alarm-sensor';})).toThrow(/alarmSensorType/);
  expect(bad(p=>{p.kind='access-reader';})).toThrow(/accessReaderMethod/);
  expect(bad(p=>{p.protocols=new Array(11).fill('x');})).toThrow(/protocols/);
  expect(()=>buildProfile(null)).toThrow();
 });
 it('sourceUrl validator accepts real documentation hosts only',()=>{
  expect(validateSourceUrl('https://www.hikvision.com/en/products/x')).toMatch(/^https:/);
  expect(()=>validateSourceUrl(5)).toThrow();expect(()=>validateSourceUrl('not a url')).toThrow(/valid URL/);
 });
 it('pack must attest it is an educational simulation, is all-or-nothing, and cannot shadow built-ins',()=>{
  const before=PROFILES.length;
  const ok=exportProfilePack([SAMPLE_PROFILE]);
  const noAttest=JSON.stringify({...JSON.parse(ok),attestation:'real'});
  expect(()=>loadProfilePack(noAttest)).toThrow(/attestation/);
  const mixed=exportProfilePack([{...clone(),id:'pack-good-one'},{...clone(),id:'pack-bad-one',powerW:-5}]);
  expect(()=>loadProfilePack(mixed)).toThrow();expect(PROFILES.length).toBe(before);
  expect(()=>loadProfilePack('nope')).toThrow(/JSON/);expect(()=>loadProfilePack('{"format":"x"}')).toThrow(/Not a SecurityLab/);
  expect(()=>loadProfilePack(exportProfilePack([{...clone(),id:'pack-dup-a'},{...clone(),id:'pack-dup-a'}]))).toThrow(/Duplicate/);
  expect(ATTESTATION).toMatch(/not-real-firmware/);
  expect(PROFILES.filter(p=>p.id==='cam-bullet').length).toBe(1);
 });
 it('loaded profile can be placed, simulated, quoted (needs quotation), and embedded in the project',()=>{
  const [prof]=loadProfilePack(exportProfilePack([SAMPLE_PROFILE]));
  expect(profile(prof.id).model).toBe('EX-IPC-100');
  let p=exampleProject(newProject('home4'));
  const dev=createDevice(prof.id,300,300,p.devices);
  p={...p,devices:[...p.devices,dev]};
  expect(()=>simulate(p)).not.toThrow();
  expect(buildQuote(p).warnings.join()).toMatch(/quotation/i);
  expect(usedPackProfiles(p).length).toBe(1);
  const embedded=withEmbeddedProfiles(p);expect(embedded.profilePack!.length).toBe(1);
  expect(withEmbeddedProfiles(embedded)).toBe(embedded);
  const removed=withEmbeddedProfiles({...embedded,devices:embedded.devices.filter(d=>d.id!==dev.id)});expect(removed.profilePack).toBeUndefined();
  // reopening without the pack loaded: unregister, then validate the embedded project
  const idx=PROFILES.findIndex(x=>x.id===prof.id);PROFILES.splice(idx,1);
  expect(()=>profile(prof.id)).toThrow();
  expect(()=>validateProject(structuredClone(embedded))).not.toThrow();
  expect(profile(prof.id).model).toBe('EX-IPC-100');
  expect(packSourceOf(prof.id)).toBeTruthy();
 });
 it('a project referencing an unknown profile without an embedded definition is rejected',()=>{
  let p=exampleProject(newProject('home4'));
  const d={...p.devices[0],profileId:'pack-never-loaded'};
  expect(()=>validateProject({...p,devices:[d,...p.devices.slice(1)]})).toThrow();
  expect(()=>validateProject({...p,profilePack:[{...clone(),id:'pack-broken',powerW:-1}]})).toThrow(/embedded device profile/);
 });
});
