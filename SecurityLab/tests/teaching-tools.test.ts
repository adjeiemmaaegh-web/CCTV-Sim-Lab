import {describe,expect,it} from 'vitest';
import type {Project} from '../src/domain/types.js';
import {newProject,exampleProject,scenarioFor,SCENARIOS} from '../src/scenarios/index.js';
import {simulate,triggerMotion,advanceRecording} from '../src/engine/simulator.js';
import {commandAlarm,triggerAlarmStimulus,advanceAlarmTime} from '../src/engine/alarm.js';
import {presentAccessToken} from '../src/engine/access.js';
import {createDevice,profile} from '../src/domain/catalog.js';
import {validateProject,activateProjectExtensions} from '../src/persistence/validation.js';
import {LESSONS,lessonProgress,lessonById} from '../src/tools/lessons.js';
import {generateFaults,applicableFaults,submitGuess,reveal,rng,FAULT_KINDS} from '../src/tools/faultGen.js';
import {recordAudit,summarizeChange,auditStats,MAX_AUDIT} from '../src/tools/audit.js';
import {buildQuote,quoteCsv,quoteHtml,DEFAULT_QUOTE_SETTINGS} from '../src/tools/quote.js';
import {loadPack,exportPack,buildScenario,SAMPLE_PACK_SCENARIO,classSheetCsv,sourceOf} from '../src/tools/scenarioPack.js';
import {evaluateScenario} from '../src/scenarios/evaluation.js';

const lesson=(id:string)=>lessonById(id)!;

describe('guided lessons (feature 8)',()=>{
 it('four lessons exist, each with hints and rationale on every step',()=>{
  expect(LESSONS.length).toBeGreaterThanOrEqual(4);
  for(const l of LESSONS){expect(l.steps.length).toBeGreaterThan(3);for(const s of l.steps){expect(s.hint.length).toBeGreaterThan(5);expect(s.why.length).toBeGreaterThan(5);}}
 });
 it('first-camera: empty project has no progress, finished rig + motion event completes it',()=>{
  const p0=newProject('home4');
  expect(lessonProgress(p0,lesson('first-camera')).completed).toBe(0);
  const s=scenarioFor('home4')!,ex=exampleProject(newProject('home4'));
  const mid=lessonProgress(ex,lesson('first-camera'));
  expect(mid.completed).toBeGreaterThanOrEqual(6);expect(mid.finished).toBe(false); // motion event still missing
  const t=s.targets[0];const done=advanceRecording(triggerMotion({...ex,night:true},{x:t.x,y:t.y}).project,5);
  expect(lessonProgress(done,lesson('first-camera')).finished).toBe(true);
 });
 it('steps are derived from state: removing the NVR un-completes steps',()=>{
  const ex=exampleProject(newProject('home4'));
  const without={...ex,devices:ex.devices.filter(d=>profile(d.profileId).kind!=='nvr')};
  const prog=lessonProgress(without,lesson('first-camera'));
  expect(prog.done[1]).toBe(false);expect(prog.currentIndex).toBeLessThanOrEqual(1);
 });
 it('alarm-basics completes after arming and tripping a sensor',()=>{
  let p=exampleProject(newProject('alarm-install'));
  const panel=p.devices.find(d=>profile(d.profileId).kind==='alarm-panel')!,beam=p.devices.find(d=>d.profileId==='alarm-beam')!;
  p=advanceAlarmTime(commandAlarm(p,panel.id,'away','1234'),60);
  p=advanceAlarmTime(triggerAlarmStimulus(p,'beam',{x:beam.x,y:beam.y-60}).project,5);
  expect(lessonProgress(p,lesson('alarm-basics')).finished).toBe(true);
 });
 it('door-access completes with a granted and a denied credential',()=>{
  let p=exampleProject(newProject('rfid-access'));
  const ctrl=p.devices.find(d=>profile(d.profileId).kind==='access-controller')!,reader=p.devices.find(d=>profile(d.profileId).kind==='access-reader')!;
  p={...p,accessIdentities:[{id:'i1',name:'A',enabled:true,cardToken:'C1',pinToken:'',biometricToken:'',grants:[{controllerId:ctrl.id,days:[0,1,2,3,4,5,6],startMinute:0,endMinute:1440}]}]};
  expect(lessonProgress(p,lesson('door-access')).finished).toBe(false);
  p=presentAccessToken(presentAccessToken(p,ctrl.id,reader.id,'card','C1'),ctrl.id,reader.id,'card','NOPE');
  expect(lessonProgress(p,lesson('door-access')).finished).toBe(true);
 });
 it('vlan-dhcp lesson is not satisfied by a plain single-VLAN CCTV rig',()=>{
  expect(lessonProgress(exampleProject(newProject('home4')),lesson('vlan-dhcp')).finished).toBe(false);
 });
});

describe('seeded fault generator (feature 9)',()=>{
 const base=()=>({...exampleProject(newProject('home8')),night:false});
 it('is deterministic for the same seed and differs across seeds',()=>{
  const a=generateFaults(base(),42,2).diagnosis.applied.map(x=>x.kind),b=generateFaults(base(),42,2).diagnosis.applied.map(x=>x.kind);
  expect(a).toEqual(b);
  const seen=new Set<string>();for(let s=0;s<30;s++)seen.add(generateFaults(base(),s,1).diagnosis.applied[0].kind);
  expect(seen.size).toBeGreaterThan(2);
 });
 it('rng is uniform-ish and reproducible',()=>{
  const r=rng(1),r2=rng(1);const xs=Array.from({length:1000},()=>r());expect(xs).toEqual(Array.from({length:1000},()=>r2()));
  const mean=xs.reduce((a,b)=>a+b,0)/xs.length;expect(mean).toBeGreaterThan(0.45);expect(mean).toBeLessThan(0.55);
  expect(xs.every(x=>x>=0&&x<1)).toBe(true);
 });
 it('injected faults really change the simulation',()=>{
  const p=base(),r0=simulate(p);
  const {project}=generateFaults(p,7,1);
  const r1=simulate(project);
  const worse=r1.onlineCameras<r0.onlineCameras||r1.issues.length>r0.issues.length||r1.recordingCameras<r0.recordingCameras||JSON.stringify(project.devices)!==JSON.stringify(p.devices);
  expect(worse).toBe(true);
 });
 it('rejects bad seeds/counts and fault-free projects',()=>{
  expect(()=>generateFaults(base(),-1)).toThrow();expect(()=>generateFaults(base(),1.5)).toThrow();expect(()=>generateFaults(base(),1,0)).toThrow();expect(()=>generateFaults(base(),1,9)).toThrow();
  expect(()=>generateFaults({...newProject('home4')},1)).toThrow(/no equipment/);
 });
 it('guess scoring and reveal',()=>{
  const {project,diagnosis}=generateFaults(base(),3,2);const truth=diagnosis.applied.map(a=>a.kind) as typeof FAULT_KINDS[number][];
  const wrongKind=FAULT_KINDS.find(k=>!truth.includes(k))!;
  const r=submitGuess(project,[truth[0],wrongKind,truth[0]]);
  expect(r.correct).toEqual([truth[0]]);expect(r.wrong).toEqual([wrongKind]);expect(r.missed).toEqual(truth.slice(1));
  expect(project.diagnosis!.revealed).toBe(false);expect(reveal(r.project).diagnosis!.revealed).toBe(true);
  expect(()=>submitGuess(newProject('home4'),[])).toThrow();
 });
 it('applicableFaults only lists faults that change something',()=>{
  expect(applicableFaults(newProject('home4'))).toEqual([]);expect(applicableFaults(base()).length).toBeGreaterThan(3);
 });
 it('project with a fault exercise validates and round-trips',()=>{
  const {project}=generateFaults(base(),5,2);expect(()=>validateProject(project)).not.toThrow();
  expect(()=>validateProject({...project,diagnosis:{...project.diagnosis,seed:'x'}})).toThrow();
 });
});

describe('audit trail (feature 11)',()=>{
 const p0=()=>newProject('home4');
 it('summarises added devices, cables, night, worked example',()=>{
  const a=p0(),dev=createDevice('cam-bullet',100,100,[]);
  expect(summarizeChange(a,{...a,devices:[dev]}).join()).toMatch(/added IP Bullet/);
  expect(summarizeChange(a,{...a,night:true})).toContain('night mode on');
  expect(summarizeChange(a,{...a,assisted:true})).toContain('worked example loaded');
  expect(summarizeChange(a,a)).toEqual([]);
 });
 it('ignores no-op commits, records real ones, coalesces rapid drags, and caps length',()=>{
  const a=p0(),dev=createDevice('cam-bullet',100,100,[]);let p={...a,devices:[dev]};
  expect(recordAudit(a,a)).toBe(a);
  p=recordAudit(a,p,'2026-01-01T00:00:00.000Z');expect(p.audit!.length).toBe(1);
  const m1={...p,devices:[{...dev,x:150}]},m2={...p,devices:[{...dev,x:200}]};
  let q=recordAudit(p,m1,'2026-01-01T00:00:01.000Z');q=recordAudit(q,{...m2,audit:q.audit},'2026-01-01T00:00:02.000Z');
  expect(q.audit!.length).toBe(2);expect(q.audit![1].summary).toMatch(/moved 1/);
  let big=a;for(let i=0;i<MAX_AUDIT+25;i++){big=recordAudit(big,{...big,night:!big.night},new Date(Date.UTC(2026,0,1,0,0,i)).toISOString());}
  expect(big.audit!.length).toBe(MAX_AUDIT);
 });
 it('stats flag worked examples and suspiciously fast large builds',()=>{
  const a=p0();let p=recordAudit(a,{...a,assisted:true},'2026-01-01T00:00:00.000Z');
  const ex=exampleProject(newProject('home8'));p=recordAudit(p,{...p,devices:ex.devices,cables:ex.cables},'2026-01-01T00:00:30.000Z');
  const st=auditStats(p);expect(st.usedWorkedExample).toBe(true);expect(st.flags.length).toBeGreaterThanOrEqual(2);
  expect(auditStats(newProject('home4')).entries).toBe(0);
 });
 it('validation accepts a valid trail and rejects a corrupt one',()=>{
  const a=p0();const p=recordAudit(a,{...a,night:true});
  expect(()=>validateProject(p)).not.toThrow();
  expect(()=>validateProject({...p,audit:[{at:'nope',summary:'x',devices:1,cables:1}]})).toThrow();
 });
});

describe('quotation (feature 12)',()=>{
 it('computes materials, cable, labour, margin and VAT consistently',()=>{
  const p=exampleProject(newProject('home4'));
  const q=buildQuote(p,{...DEFAULT_QUOTE_SETTINGS,marginPercent:10,vatPercent:15});
  const materials=p.devices.reduce((n,d)=>n+profile(d.profileId).costGhs,0);
  expect(q.materials).toBeCloseTo(materials,2);
  expect(q.subtotal).toBeCloseTo(q.materials+q.cableTotal+q.labour,1);
  expect(q.total).toBeCloseTo((q.subtotal+q.margin)*1.15,1);
  expect(q.lines.reduce((n,l)=>n+l.qty,0)).toBe(p.devices.length);
 });
 it('manufacturer models without a quotation are flagged and not priced',()=>{
  const dev=createDevice('vendor-hikvision-ds-2cd2043g2-i-4mm-r1',100,100,[]);const p={...newProject('home4'),devices:[dev]};
  expect(profile('vendor-hikvision-ds-2cd2043g2-i-4mm-r1').manufacturerSpec).toBeTruthy();
  const q=buildQuote(p);expect(q.lines[0].needsQuotation).toBe(true);expect(q.warnings.join()).toMatch(/quotation/i);
  const priced=buildQuote({...p,devices:[{...dev,unitCostGhs:999}]});expect(priced.lines[0].unitCost).toBe(999);expect(priced.warnings.length).toBe(0);
 });
 it('empty project warns; negative rates rejected',()=>{
  expect(buildQuote(newProject('home4')).warnings).toContain('No equipment placed yet');
  expect(()=>buildQuote(newProject('home4'),{...DEFAULT_QUOTE_SETTINGS,marginPercent:-1})).toThrow();
 });
 it('CSV neutralises formula injection and HTML escapes names',()=>{
  const dev={...createDevice('cam-bullet',1,1,[]),name:'=HYPERLINK("x")'};const p={...newProject('home4'),title:'<script>alert(1)</script>',devices:[dev]};
  const q=buildQuote(p);q.lines[0].description='=1+1';
  expect(quoteCsv(q)).toContain("'=1+1");
  expect(quoteHtml(p,q)).not.toContain('<script>alert');
 });
});

describe('instructor scenario packs (feature 10)',()=>{
 it('loads the sample pack, creates a project, evaluates, and persists the scenario inside the project',()=>{
  const [sc]=loadPack(exportPack([SAMPLE_PACK_SCENARIO]));
  expect(SCENARIOS.some(s=>s.id===sc.id)).toBe(true);
  const p=newProject(sc.id);
  expect(p.customScenario).toBeTruthy();
  expect(evaluateScenario(p,simulate(p)).allComplete).toBe(false);
  // reopening on a machine without the pack: remove it, then validate the project
  const idx=SCENARIOS.findIndex(s=>s.id===sc.id);SCENARIOS.splice(idx,1);
  expect(sourceOf(sc.id)).toBeTruthy();
  expect(()=>validateProject(structuredClone(p))).not.toThrow();
  expect(SCENARIOS.some(s=>s.id===sc.id)).toBe(false); // pure validation
  activateProjectExtensions(p); // accepting the project activates its scenario
  expect(SCENARIOS.some(s=>s.id===sc.id)).toBe(true);
 });
 it('equipment lock: allowed kinds are enforced by the scenario',()=>{
  const sc=buildScenario(SAMPLE_PACK_SCENARIO);expect(sc.allowedKinds).toEqual(['camera','switch','nvr']);
 });
 it('rejects malformed definitions with specific messages',()=>{
  const bad=(patch:object)=>()=>buildScenario({...SAMPLE_PACK_SCENARIO,...patch});
  expect(bad({id:'home4'})).toThrow(/custom-/);
  expect(bad({title:''})).toThrow(/Title/);
  expect(bad({difficulty:'god'})).toThrow(/Difficulty/);
  expect(bad({focus:'x'})).toThrow(/Focus/);
  expect(bad({allowedKinds:['teleporter']})).toThrow(/device kinds/);
  expect(bad({budgetGhs:-5})).toThrow(/budget/);
  expect(bad({objectives:[{id:'a',title:'t',metric:'nope',weight:5}]})).toThrow(/metric/);
  expect(bad({objectives:[{id:'a',title:'t',metric:'camera-count',weight:5},{id:'a',title:'u',metric:'camera-count',weight:5}]})).toThrow(/Duplicate/);
  expect(bad({targets:[],objectives:[{id:'a',title:'t',metric:'target-coverage',weight:5}]})).toThrow(/target/i);
  expect(bad({siteWidth:50})).toThrow(/Site size/);
  expect(()=>buildScenario(null)).toThrow();
 });
 it('loadPack is all-or-nothing and rejects foreign files',()=>{
  const before=SCENARIOS.length;
  const mixed=exportPack([{...SAMPLE_PACK_SCENARIO,id:'custom-ok-one'},{...SAMPLE_PACK_SCENARIO,id:'custom-bad-one',budgetGhs:-1}]);
  expect(()=>loadPack(mixed)).toThrow();expect(SCENARIOS.length).toBe(before);
  expect(()=>loadPack('not json')).toThrow(/JSON/);expect(()=>loadPack('{"format":"x"}')).toThrow(/Not a SecurityLab/);
 });
 it('built-in scenarios cannot be replaced',()=>{
  expect(()=>loadPack(exportPack([{...SAMPLE_PACK_SCENARIO,id:'home4'}]))).toThrow();
  expect(SCENARIOS.filter(s=>s.id==='home4').length).toBe(1);
 });
 it('class sheet CSV neutralises formula injection',()=>{
  const csv=classSheetCsv([{student:'=cmd|calc',project:'p, "q"',scenario:'home4',score:80,passed:'yes',assisted:'no',assessments:2}]);
  expect(csv).toContain("'=cmd|calc");expect(csv).toContain('"p, ""q"""');expect(csv.split('\r\n').length).toBe(2);
 });
});
