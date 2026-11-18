import {test,expect,Page} from '@playwright/test';
import {project,dock,settings} from './helpers.js';
test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
const watch=(page:Page)=>{const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;};

test('phone layout: no horizontal page overflow and key controls reachable',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
 await expect(page.getByRole('button',{name:'Project',exact:true})).toBeVisible();
 await expect(page.getByLabel('Scenario',{exact:true})).toBeVisible();
 expect(errs).toEqual([]);
});

test('touch: tap a catalogue item then tap the plan to place it; svg ignores page scroll gestures',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const touchAction=await page.locator('svg[role=application]').evaluate(e=>getComputedStyle(e).touchAction);
 expect(touchAction).toBe('none');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:/camera/i}).first().tap();
 await page.locator('svg[role=application]').tap({position:{x:180,y:100}});
 await expect(page.locator('svg[role=application] g[data-device]')).toHaveCount(1);
 expect(errs).toEqual([]);
});

test('touch targets on coarse pointers are at least 40px',async({page})=>{
 await page.goto('/');
 const small=await page.evaluate(()=>[...document.querySelectorAll('.topbar button, .nav-rail button, .dock-tabs > button')].filter(b=>{const r=b.getBoundingClientRect();return r.height>0&&r.width>0&&(r.height<40||r.width<40);}).length);
 expect(small).toBe(0);
 const cards=await page.locator('.rt-cards .stat').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right};}));
 for(const card of cards){expect(card.left).toBeGreaterThanOrEqual(0);expect(card.right).toBeLessThanOrEqual(391);}
});

test('tools open on a phone and the printable report downloads',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example',true);
 await dock(page,'Tools',true);
 await page.getByRole('tab',{name:'Report / PDF'}).tap();
 const [dl]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download report (HTML)'}).tap()]);
 const fs=await import('node:fs');const html=fs.readFileSync((await dl.path())!,'utf8');
 expect(html).toContain('Bill of materials');expect(html).toContain('<svg');
 expect(errs).toEqual([]);
});
