import {test,expect} from '@playwright/test';

test('learner workflow exposes real placement, wiring, property and diagnostic actions',async({page})=>{
 await page.goto('/');
 const guide=page.getByRole('navigation',{name:'Installation workflow'});
 await expect(guide).toContainText('0/5');
 await guide.getByRole('button',{name:'Place installation step'}).click();
 await expect(page.getByRole('status').last()).toContainText('Step 1');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'IP Bullet • 2MP'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:305,y:180}});
 await expect(guide).toContainText('1/5');
 await page.getByRole('button',{name:/Network Devices/}).click();
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'4-Port PoE+ Switch'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:500,y:260}});
 await guide.getByRole('button',{name:'Connect installation step'}).click();
 await expect(page.getByRole('button',{name:'Cable',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.locator('svg[role=application] g[data-device]').first().click();
 await page.locator('svg[role=application] g[data-device]').nth(1).click();
 await page.getByRole('button',{name:'Install reviewed connection'}).click();
 await expect(guide).toContainText('2/5');
 await guide.getByRole('button',{name:'Configure installation step'}).click();
 await expect(page.getByRole('complementary',{name:'Properties'})).toContainText('Device Properties');
 await expect(page.getByRole('button',{name:'Connect this device'})).toBeVisible();
 await guide.getByRole('button',{name:'Test installation step'}).click();
 await expect(page.locator('.console')).toBeVisible();
 await expect(page.locator('.dock-tabs').getByRole('tab',{name:'Diagnostics'})).toHaveAttribute('aria-selected','true');
});

test('workflow on a maximized canvas reveals requested context and remains usable at 1024px',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/');
 await page.getByRole('button',{name:'Focus canvas'}).click();
 await expect(page.locator('.catalog')).toBeHidden();
 const guide=page.getByRole('navigation',{name:'Installation workflow'});
 await guide.getByRole('button',{name:'Place installation step'}).click();
 await expect(page.locator('.catalog')).toBeVisible();
 await page.getByRole('button',{name:'Focus canvas'}).click();
 await guide.getByRole('button',{name:'Test installation step'}).click();
 await expect(page.locator('.console')).toBeVisible();
 const dims=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,canvas:document.querySelector('.canvas-body')!.getBoundingClientRect().height,toolbar:document.querySelector('.canvas-toolbar')!.getBoundingClientRect().height}));
 expect(dims.overflow).toBeLessThanOrEqual(1);
 expect(dims.toolbar).toBeLessThan(80);
 expect(dims.canvas).toBeGreaterThan(300);
});

test('selected device can directly start an endpoint-specific virtual connection',async({page})=>{
 await page.goto('/');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'IP Bullet • 2MP'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:300,y:180}});
 await page.getByRole('button',{name:/Network Devices/}).click();
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'4-Port PoE+ Switch'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:500,y:250}});
 await page.getByRole('button',{name:'Connect this device'}).click();
 await expect(page.getByRole('button',{name:'Cable',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.canvas-hint')).toContainText('First cable endpoint selected');
 await page.locator('svg[role=application] g[data-device]').first().click();
 await expect(page.getByRole('region',{name:'Connection setup'})).toBeVisible();
});
