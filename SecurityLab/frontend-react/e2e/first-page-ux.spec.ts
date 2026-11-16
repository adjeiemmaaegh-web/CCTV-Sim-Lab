import {test,expect} from '@playwright/test';

test('first-time guide helps create a project without blocking the floor plan',async({page})=>{
 await page.goto('/');
 const intro=page.getByRole('complementary',{name:'Getting started'});
 await expect(intro).toBeVisible();
 await expect(page.locator('svg[role=application]')).toBeVisible();
 await intro.getByRole('button',{name:'Start designing'}).click();
 await expect(intro).toHaveCount(0);
 await expect(page.locator('.catalog')).toBeVisible();
 await page.getByRole('button',{name:'Show getting started'}).click();
 await expect(intro).toBeVisible();
 await intro.getByRole('button',{name:'Dismiss getting started'}).click();
 await expect(intro).toHaveCount(0);
});

test('panel controls can hide and restore each pane without modifying the project',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 const countBefore=await page.locator('svg[role=application] g[data-device]').count();
 await page.getByRole('button',{name:'Workspace panels'}).click();
 const layout=page.getByRole('group',{name:'Workspace panel controls'});
 await expect(layout).toBeVisible();
 await layout.getByRole('checkbox',{name:'Equipment library'}).uncheck();
 await layout.getByRole('checkbox',{name:'Properties'}).uncheck();
 await layout.getByRole('checkbox',{name:'Simulation console'}).uncheck();
 await expect(page.locator('.catalog')).toBeHidden();
 await expect(page.locator('.inspector')).toBeHidden();
 await expect(page.locator('.console')).toBeHidden();
 const wide=await page.locator('.canvas-body').boundingBox();
 expect(wide!.width).toBeGreaterThan(1000);
 await layout.getByRole('button',{name:'Reset layout'}).click();
 await expect(page.locator('.catalog')).toBeVisible();
 await expect(page.locator('.inspector')).toBeVisible();
 await expect(page.locator('.console')).toBeVisible();
 expect(await page.locator('svg[role=application] g[data-device]').count()).toBe(countBefore);
});

test('panel widths can be adjusted by keyboard and focus canvas remains reversible',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await page.getByRole('button',{name:'Workspace panels'}).click();
 const slider=page.getByRole('slider',{name:'Equipment library width'});
 await slider.focus();
 await page.keyboard.press('ArrowRight');
 await expect(slider).toHaveValue('290');
 await page.getByRole('button',{name:'Focus canvas'}).click();
 await expect(page.locator('.catalog')).toBeHidden();
 await page.getByRole('button',{name:'Restore workstation panels'}).click();
 await expect(page.locator('.catalog')).toBeVisible();
});

test('mobile first screen exposes project status in the compact header',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const status=page.locator('.brand-mobile-state');
 await expect(status).toBeVisible();
 await expect(status).toContainText('Unsaved draft');
 const bounds=await page.locator('.topbar').boundingBox();
 expect(bounds!.height).toBeLessThan(180);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(1);
});

test('empty inspector provides actual room and wiring actions',async({page})=>{
 await page.goto('/');
 const inspector=page.locator('.inspector');
 await expect(inspector).toContainText('Select an element to configure');
 await expect(inspector.getByRole('button',{name:'Connect devices'})).toBeDisabled();
 await inspector.getByRole('button',{name:'Draw a room'}).click();
 await expect(page.getByRole('button',{name:'Room',exact:true})).toHaveAttribute('aria-pressed','true');
});
