import {test,expect,Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const TABS=['Systems','Diagnostics','Network','Events','Recordings','Alarm','Access','Power','Scenario','Assessment','Field-review'];
const watch=(page:Page)=>{const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;};

test('every console tab renders for every scenario without errors',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const ids=await page.getByLabel('Scenario',{exact:true}).locator('option').evaluateAll(o=>o.map(x=>(x as HTMLOptionElement).value));
 expect(ids.length).toBe(15);
 for(const id of ids){
  await page.getByLabel('Scenario',{exact:true}).selectOption(id);
  for(const t of TABS){await page.getByRole('button',{name:t,exact:true}).first().click();}
 }
 expect(errs).toEqual([]);
});

test('topology view, zoom, fit and placement-mode escape work',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.getByRole('button',{name:'Network Topology'}).click();
 await page.getByRole('button',{name:'Floor Plan'}).click();
 await page.getByRole('button',{name:'Zoom in'}).click();
 await expect(page.locator('.zoom-readout')).not.toHaveText('100%');
 await page.getByRole('button',{name:'Fit'}).click();
 await page.locator('.catalog-scroll button.equipment').first().click();
 await page.keyboard.press('Escape');
 expect(errs).toEqual([]);
});

test('worked example: device selectable by keyboard and nudged with arrow keys',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
 const dev=page.locator('svg[role=application] g[data-device]').first();
 const before=await dev.getAttribute('transform');
 await dev.focus();await page.keyboard.press('Enter');
 await page.keyboard.press('Shift+ArrowRight');
 await expect.poll(()=>dev.getAttribute('transform')).not.toBe(before);
 await page.keyboard.press('Control+z');
 await expect.poll(()=>dev.getAttribute('transform')).toBe(before);
 expect(errs).toEqual([]);
});

test('accessibility: no serious or critical axe violations on main workstation',async({page})=>{
 await page.goto('/');
 const res=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
 const bad=res.violations.filter(v=>['serious','critical'].includes(v.impact||''));
 console.log(bad.map(v=>`${v.id} (${v.impact}) x${v.nodes.length}`).join('\n')||'axe: none');
 expect(bad.map(v=>v.id)).toEqual([]);
});

test('pointer: place a device then drag it to a new position; undo restores it',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:/camera/i}).first().click();
 await page.locator('svg[role=application]').click({position:{x:350,y:120}});
 const dev=page.locator('svg[role=application] g[data-device]').first();
 await expect(dev).toHaveCount(1);
 const before=await dev.getAttribute('transform');
 const b=(await dev.boundingBox())!;
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
 await page.mouse.move(b.x+b.width/2+80,b.y+b.height/2+30,{steps:8});await page.mouse.up();
 await expect.poll(()=>dev.getAttribute('transform')).not.toBe(before);
 await page.keyboard.press('Control+z');
 await expect.poll(()=>dev.getAttribute('transform')).toBe(before);
 expect(errs).toEqual([]);
});

test('unsaved edits trigger the browser leave-page warning; a clean project does not',async({page})=>{
 await page.goto('/');
 const clean=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
 await page.getByLabel('Night').check();
 const dirty=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
 expect(dirty).toBe(true);
 expect(clean).toBe(false);
 await page.getByLabel('Night').uncheck();
 const afterUndoByHand=await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;});
 expect(afterUndoByHand).toBe(true); // still unsaved: toggling back is a new edit (updatedAt changed)
});

test('accessibility: every console tab is free of serious/critical axe violations',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Load Worked Example'}).click();
 const found:string[]=[];
 for(const t of TABS){
  await page.getByRole('button',{name:t,exact:true}).first().click();
  const res=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
  for(const v of res.violations.filter(v=>['serious','critical'].includes(v.impact||'')))found.push(`${t}: ${v.id} x${v.nodes.length}`);
 }
 console.log(found.join('\n')||'axe tabs: none');
 expect(found).toEqual([]);
});

test('narrow viewport (tablet 800px) has no horizontal page overflow',async({page})=>{
 await page.setViewportSize({width:800,height:900});await page.goto('/');
 const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(o).toBeLessThanOrEqual(1);
});
