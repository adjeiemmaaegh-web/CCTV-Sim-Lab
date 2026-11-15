import {describe,expect,it} from 'vitest';
import {newProject} from '../src/scenarios/index.js';
import {createDevice} from '../src/domain/catalog.js';
import {simulate} from '../src/engine/simulator.js';
import {reviewProject} from '../src/tools/standards.js';
import {planReportHtml} from '../src/tools/report.js';
import {buildQuote} from '../src/tools/quote.js';

/** Largest allowed project (validation limits: 120 devices, 240 cables, 400 walls). Generous bounds: this guards against accidental O(n^3) regressions, it is not a benchmark. */
function big(){
 let p=newProject('warehouse8');const devs=[...p.devices],cables=[];
 const sw=Array.from({length:6},(_,i)=>{const d=createDevice('switch-managed-16',100+i*120,520,devs);devs.push(d);return d;});
 const nvr=createDevice('nvr-8',900,560,devs);devs.push(nvr);
 for(let i=0;i<100;i++){const c=createDevice('cam-bullet',60+(i%20)*42,80+Math.floor(i/20)*90,devs);c.ip=`192.168.10.${20+(i%200)}`;devs.push(c);
  cables.push({id:`c${i}`,a:sw[i%6].id,b:c.id,medium:'ethernet' as const,connected:true,lengthMeters:20});}
 const walls=Array.from({length:60},(_,i)=>({id:`w${i}`,kind:'wall' as const,x1:40+(i%12)*70,y1:100+Math.floor(i/12)*100,x2:40+(i%12)*70+50,y2:100+Math.floor(i/12)*100+30}));
 return {...p,devices:devs,cables,walls:[...p.walls,...walls]};
}
describe('performance guard',()=>{
 it('simulates a maximum-size project quickly and the tools stay responsive',()=>{
  const p=big();expect(p.devices.length).toBeGreaterThanOrEqual(107);
  const t0=performance.now();for(let i=0;i<5;i++)simulate(p);const sim=(performance.now()-t0)/5;
  const r=simulate(p);
  const t1=performance.now();reviewProject(p,undefined,r);planReportHtml(p,r);buildQuote(p);const tools=performance.now()-t1;
  console.log(`PERF simulate ${sim.toFixed(1)} ms/run, review+report+quote ${tools.toFixed(1)} ms`);
  expect(sim).toBeLessThan(750);expect(tools).toBeLessThan(2500);
 });
});
