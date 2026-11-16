import {test,expect} from '@playwright/test';
import {newProject} from '../../src/scenarios/index.js';
import {createDevice} from '../../src/domain/catalog.js';
import type {Device,Wall} from '../../src/domain/types.js';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';

type FrameSampler={active:boolean;previous:number;intervals:number[]};
type SampleWindow=Window&{__slStressFrameSampler?:FrameSampler};

/**
 * Engineering-only stress probe. A CI runner is NOT an 8 GB Windows 11 laptop.
 * This measures frame intervals while interacting with an actual 40-device,
 * 60-wall rendered project, but it cannot pass owner acceptance gate C2.
 */
test('40 devices + 60 walls: render, drag, undo and record browser frame timings',async({page},info)=>{
 test.setTimeout(120_000);
 await page.setViewportSize({width:1280,height:800});
 const seed=newProject('home4');
 const devices:Device[]=[];
 for(let i=0;i<40;i++){
  devices.push(createDevice('cam-bullet',75+(i%8)*108,85+Math.floor(i/8)*112,devices));
 }
 const walls:Wall[]=Array.from({length:60},(_,i)=>{
  const col=i%10,row=Math.floor(i/10),x=35+col*94,y=42+row*98;
  return {id:`stress-wall-${i+1}`,kind:'wall' as const,x1:x,y1:y,x2:x+65,y2:y};
 });
 const project={...seed,title:'Synthetic layout responsiveness probe',devices,walls,rooms:[],cables:[],events:[]};
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('/');
 const tLoad=Date.now();
 await page.locator('input[type=file]').first().setInputFiles({
  name:'synthetic-layout-stress.securitylab.json',
  mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(project))
 });
 const dev=page.locator('svg[role=application] g[data-device]');
 const wall=page.locator('svg[role=application] g[data-wall]');
 await expect(dev).toHaveCount(40);
 await expect(wall).toHaveCount(60);
 const loadToRenderMs=Date.now()-tLoad;
 const original=await dev.first().getAttribute('transform');
 const circle=await dev.first().locator('circle').first().boundingBox();
 expect(circle).not.toBeNull();
 const x=circle!.x+circle!.width/2,y=circle!.y+circle!.height/2;

 await page.evaluate(()=>{
  const sample:FrameSampler={active:true,previous:0,intervals:[]};
  (window as SampleWindow).__slStressFrameSampler=sample;
  const tick=(time:number)=>{
   if(!sample.active)return;
   if(sample.previous)sample.intervals.push(time-sample.previous);
   sample.previous=time;
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 });
 await page.mouse.move(x,y);
 const tDrag=Date.now();
 await page.mouse.down();
 // Move at measured, nonzero intervals so the browser can actually render
 // previews between pointer updates; Playwright event dispatch is not a human.
 for(let i=1;i<=24;i++){
  await page.mouse.move(x+Math.round(72*i/24),y+Math.round(36*i/24));
  await page.waitForTimeout(16);
 }
 await page.mouse.up();
 const dragInteractionMs=Date.now()-tDrag;
 await expect.poll(()=>dev.first().getAttribute('transform'),{timeout:15_000}).not.toBe(original);
 await page.waitForTimeout(100);
 const intervals=await page.evaluate(()=>{
  const sample=(window as SampleWindow).__slStressFrameSampler;
  if(!sample)return [];
  sample.active=false;
  return sample.intervals;
 });
 expect(intervals.length,'RAF should have sampled multiple drag-time browser frames').toBeGreaterThanOrEqual(5);
 const sorted=[...intervals].sort((a,b)=>a-b);
 const percentile=(p:number)=>Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*100)/100;
 await page.keyboard.press('Control+z');
 await expect.poll(()=>dev.first().getAttribute('transform'),{timeout:15_000}).toBe(original);
 await expect(dev).toHaveCount(40);
 await expect(wall).toHaveCount(60);
 const browser=await page.evaluate(()=>({
  userAgent:navigator.userAgent,deviceMemoryGb:(navigator as Navigator&{deviceMemory?:number}).deviceMemory??null,
  logicalProcessors:navigator.hardwareConcurrency,devicePixelRatio,
  viewport:{width:innerWidth,height:innerHeight}
 }));
 const measured={
  note:'Diagnostics from automated browser runner; NOT a physical Windows 11 8 GB performance acceptance result.',
  commit:process.env.GITHUB_SHA??null,environment:process.env.RUNNER_OS??process.platform,
  projectCounts:{devices:40,walls:60},browser,
  loadToRenderMs,dragInteractionMs,
  frameIntervalMs:{count:intervals.length,p50:percentile(.50),p95:percentile(.95),p99:percentile(.99),max:percentile(1)},
  functional:{rendered:true,dragMoved:true,undoRestored:true},errors
 };
 const encoded=JSON.stringify(measured,null,2)+'\n';
 await info.attach('large-layout-frame-diagnostics.json',{body:Buffer.from(encoded),contentType:'application/json'});
 const output=path.resolve('test-results',`large-layout-${info.project.name.replace(/[^a-z0-9-]/gi,'-')}.json`);
 await mkdir(path.dirname(output),{recursive:true});
 await writeFile(output,encoded);
 console.log('LARGE_LAYOUT_STRESS '+JSON.stringify(measured));
 expect(errors).toEqual([]);
});
