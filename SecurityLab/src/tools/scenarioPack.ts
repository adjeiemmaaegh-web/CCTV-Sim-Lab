/**
 * Feature 10 (instructor mode): author custom scenarios as local JSON "scenario packs", lock the permitted
 * equipment, and export class result sheets. File-based only: no accounts, no cloud. Custom scenarios are always
 * empty-site exercises with ids "custom-*" so they can never replace a built-in scenario.
 */
import type {DeviceKind,Scenario,ScenarioMetric,ScenarioObjective,Target,Wall} from '../domain/types.js';
import {PROFILES} from '../domain/catalog.js';
import {SCENARIOS} from '../scenarios/definitions.js';

export const PACK_FORMAT='securitylab.scenario-pack';
export const MAX_CUSTOM=20;
export const METRICS:ScenarioMetric[]=['camera-count','camera-powered','camera-online','camera-recording','target-coverage','night-coverage','recorded-event','technical-health','within-budget','resolved-challenges','alarm-panel','alarm-sensors','alarm-keypad','alarm-armed','alarm-triggered','alarm-output','alarm-beam','router-ready','dhcp-lease','intervlan-route','access-controller','access-readers','access-lock','access-door','access-granted','access-denied','access-exit','power-wired','solar-generation','battery-ready','backup-outage'];
const KINDS=new Set<string>(PROFILES.map(p=>p.kind));
const FOCUS=['cctv','network','alarm','access','power','mixed'];
const txt=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const num=(v:unknown,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;

export type PackScenario={id:string;title:string;description:string;difficulty:Scenario['difficulty'];focus:Scenario['focus'];instructions:string[];allowedKinds:string[];minCameras:number;budgetGhs:number;siteWidth?:number;siteHeight?:number;targets:{id:string;name:string;x:number;y:number}[];objectives:{id:string;title:string;metric:string;weight:number;minimum?:number;critical?:boolean}[]};
export type ScenarioPack={format:typeof PACK_FORMAT;version:1;scenarios:PackScenario[]};

/** Validate one pack scenario and build a full Scenario. Throws a descriptive Error on any problem. */
export function buildScenario(input:unknown):Scenario{
 const s=input as PackScenario;
 if(!s||typeof s!=='object')throw new Error('Scenario must be an object');
 if(typeof s.id!=='string'||!/^custom-[a-z0-9-]{1,40}$/.test(s.id))throw new Error('Scenario id must look like "custom-my-exercise" (lowercase letters, digits, dashes)');
 if(!txt(s.title,80))throw new Error('Title required (max 80 characters)');
 if(!txt(s.description,600))throw new Error('Description required (max 600 characters)');
 if(!['beginner','intermediate','advanced'].includes(s.difficulty))throw new Error('Difficulty must be beginner, intermediate or advanced');
 if(!FOCUS.includes(s.focus))throw new Error(`Focus must be one of ${FOCUS.join(', ')}`);
 if(!Array.isArray(s.instructions)||s.instructions.length<1||s.instructions.length>12||s.instructions.some(i=>!txt(i,300)))throw new Error('1-12 instructions of up to 300 characters are required');
 if(!Array.isArray(s.allowedKinds)||s.allowedKinds.length<1||s.allowedKinds.length>40||s.allowedKinds.some(k=>!KINDS.has(k)))throw new Error('allowedKinds must list known device kinds');
 if(!num(s.minCameras,0,32)||!Number.isInteger(s.minCameras))throw new Error('minCameras must be a whole number 0-32');
 if(!num(s.budgetGhs,0,10_000_000))throw new Error('budgetGhs must be 0-10,000,000');
 const w=s.siteWidth??860,h=s.siteHeight??560;
 if(!num(w,300,900)||!num(h,300,620))throw new Error('Site size must be 300-900 x 300-620 units');
 if(!Array.isArray(s.targets)||s.targets.length>20||s.targets.some(t=>!t||!txt(t.id,40)||!txt(t.name,60)||!num(t.x,0,1000)||!num(t.y,0,650)))throw new Error('Targets need id, name and x/y inside the plan');
 if(new Set(s.targets.map(t=>t.id)).size!==s.targets.length)throw new Error('Duplicate target id');
 if(!Array.isArray(s.objectives)||s.objectives.length<1||s.objectives.length>16)throw new Error('1-16 objectives are required');
 const ids=new Set<string>();
 for(const o of s.objectives){
  if(!o||!txt(o.id,40)||!txt(o.title,100))throw new Error('Each objective needs an id and title');
  if(ids.has(o.id))throw new Error(`Duplicate objective id ${o.id}`);ids.add(o.id);
  if(!METRICS.includes(o.metric as ScenarioMetric))throw new Error(`Unknown metric "${o.metric}"`);
  if(!num(o.weight,1,100))throw new Error('Objective weight must be 1-100');
  if(o.minimum!==undefined&&!num(o.minimum,0,64))throw new Error('Objective minimum must be 0-64');
 }
 if(s.objectives.some(o=>o.metric==='target-coverage'||o.metric==='night-coverage')&&s.targets.length===0)throw new Error('Coverage objectives need at least one target');
 const x0=60,y0=60,box:Wall[]=[
  {id:'site-north',kind:'wall',x1:x0,y1:y0,x2:x0+w-120,y2:y0},{id:'site-east',kind:'wall',x1:x0+w-120,y1:y0,x2:x0+w-120,y2:y0+h-100},
  {id:'site-south',kind:'wall',x1:x0+w-120,y1:y0+h-100,x2:x0,y2:y0+h-100},{id:'site-west',kind:'wall',x1:x0,y1:y0+h-100,x2:x0,y2:y0}];
 const targets:Target[]=s.targets.map(t=>({id:t.id,name:t.name,x:t.x,y:t.y,required:true}));
 const objectives:ScenarioObjective[]=s.objectives.map(o=>({id:o.id,title:o.title,metric:o.metric as ScenarioMetric,minimum:o.minimum??1,weight:o.weight,critical:o.critical??true}));
 return {id:s.id,version:1,focus:s.focus,difficulty:s.difficulty,title:s.title,description:s.description,instructions:[...s.instructions],starterProfiles:[],allowedKinds:s.allowedKinds as DeviceKind[],minCameras:s.minCameras,budgetGhs:s.budgetGhs,targets,rooms:[],walls:box,baseline:'empty',objectives};
}
/** Register (or replace) a custom scenario in the live scenario list. Returns the scenario. */
export function registerScenario(s:Scenario):Scenario{
 if(!/^custom-/.test(s.id))throw new Error('Only custom-* scenarios can be registered');
 const i=SCENARIOS.findIndex(x=>x.id===s.id);
 if(i>=0){SCENARIOS[i]=s;return s;}
 if(SCENARIOS.filter(x=>x.id.startsWith('custom-')).length>=MAX_CUSTOM)throw new Error(`At most ${MAX_CUSTOM} custom scenarios can be loaded`);
 SCENARIOS.push(s);return s;
}
const SOURCES=new Map<string,PackScenario>();
/** Original pack definition of a registered custom scenario (embedded in projects so they reopen anywhere). */
export const sourceOf=(id:string):PackScenario|undefined=>SOURCES.get(id);
export function registerPackScenario(src:unknown):Scenario{
 const sc=buildScenario(src);registerScenario(sc);SOURCES.set(sc.id,structuredClone(src as PackScenario));return sc;
}
export function loadPack(text:string):Scenario[]{
 if(text.length>2_000_000)throw new Error('Scenario pack too large');
 let doc:unknown;try{doc=JSON.parse(text);}catch{throw new Error('Scenario pack is not valid JSON');}
 const p=doc as ScenarioPack;
 if(!p||p.format!==PACK_FORMAT||p.version!==1||!Array.isArray(p.scenarios)||p.scenarios.length<1||p.scenarios.length>MAX_CUSTOM)throw new Error('Not a SecurityLab scenario pack (format/version/scenarios)');
 const built=p.scenarios.map(buildScenario); // validate everything before registering anything
 if(new Set(built.map(b=>b.id)).size!==built.length)throw new Error('Duplicate scenario id in pack');
 return p.scenarios.map(registerPackScenario);
}
export function exportPack(scenarios:PackScenario[]):string{
 return JSON.stringify({format:PACK_FORMAT,version:1,scenarios},null,2);
}
export const SAMPLE_PACK_SCENARIO:PackScenario={id:'custom-two-camera-shop',title:'Two-camera kiosk',description:'Instructor example: cover the counter and the door with two recorded cameras.',difficulty:'beginner',focus:'cctv',
 instructions:['Install a switch, NVR and two IP cameras.','Cover the counter and the door.','Record one motion event.'],allowedKinds:['camera','switch','nvr'],minCameras:2,budgetGhs:6000,
 targets:[{id:'counter',name:'Counter',x:300,y:250},{id:'door',name:'Door',x:600,y:150}],
 objectives:[{id:'cams',title:'Two cameras',metric:'camera-count',weight:20,minimum:2},{id:'power',title:'Powered',metric:'camera-powered',weight:20,minimum:2},{id:'online',title:'Online',metric:'camera-online',weight:20,minimum:2},{id:'cover',title:'Covered',metric:'target-coverage',weight:25},{id:'evidence',title:'Recorded event',metric:'recorded-event',weight:15}]};

/** Class sheet: one CSV row per submitted project file (latest assessment per project). CSV-injection safe. */
export type SheetRow={student:string;project:string;scenario:string;score:number|'';passed:string;assisted:string;assessments:number};
export function classSheetCsv(rows:SheetRow[]):string{
 const cell=(v:string|number)=>{let s=String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
 const head=['Student','Project','Scenario','Score','Passed','Assisted','Assessments run'];
 return [head,...rows.map(r=>[r.student,r.project,r.scenario,r.score,r.passed,r.assisted,r.assessments])].map(r=>r.map(cell).join(',')).join('\r\n');
}
