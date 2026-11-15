import {describe,expect,it} from 'vitest';
import {newProject,exampleProject} from '../src/scenarios/index.js';
import {planReportHtml,planSvg} from '../src/tools/report.js';
import {simulate} from '../src/engine/simulator.js';
import {addFloor} from '../src/tools/floors.js';

describe('printable report (feature 17)',()=>{
 it('contains plan, BOM, review and diagnostics; no scripts or external URLs',()=>{
  const p=exampleProject(newProject('home4'));const html=planReportHtml(p,simulate(p),undefined,'2026-01-01T00:00:00Z');
  expect(html).toContain('<svg');expect(html).toContain('Bill of materials');expect(html).toContain('Good-practice review');expect(html).toContain('assisted worked example');
  expect(html).not.toMatch(/<script/i);expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
 });
 it('draws one circle per device and escapes hostile names',()=>{
  const p=exampleProject(newProject('home4'));const evil={...p,title:'<img src=x onerror=alert(1)>',devices:p.devices.map((d,i)=>i===0?{...d,name:'"><script>x</script>'}:d)};
  const svg=planSvg(evil,0,simulate(evil));expect((svg.match(/<circle/g)||[]).length).toBe(p.devices.length);
  const html=planReportHtml(evil);expect(html).not.toContain('<img src=x');expect(html).not.toContain('<script>x');
 });
 it('multi-floor projects get one section per floor',()=>{
  const p=addFloor(exampleProject(newProject('home4')),'Upstairs');
  const html=planReportHtml(p);expect(html).toContain('Ground floor');expect(html).toContain('Upstairs');expect((html.match(/<svg /g)||[]).length).toBe(2);
 });
});
