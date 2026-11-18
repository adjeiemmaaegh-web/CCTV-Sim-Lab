import {test,expect} from '@playwright/test';
import {project,dock} from './helpers.js';

test('guided troubleshooting identifies disconnected cable, opens it and updates after repair',async({page})=>{
 await page.goto('/');
 await project(page,'Load Worked Example');
 await dock(page,'Diagnostics');
 const guide=page.getByRole('region',{name:'Guided troubleshooting'});
 await expect(guide).toBeVisible();
 await page.getByLabel('Fault type').selectOption('disconnect');
 await page.getByRole('button',{name:'Inject Fault'}).click();
 const fault=guide.locator('.guided-finding').filter({hasText:'Cable disconnected'}).first();
 await expect(fault).toBeVisible();
 await expect(fault).toContainText('Next investigation:');
 await fault.getByRole('button',{name:'Inspect connection'}).click();
 const inspector=page.getByRole('complementary',{name:'Properties'});
 await expect(inspector.getByRole('region',{name:'Connection setup'})).toBeVisible();
 await inspector.getByLabel('Cable connected').check();
 await expect(guide.locator('.guided-finding').filter({hasText:'Cable disconnected'})).toHaveCount(0);
 await guide.getByRole('button',{name:'Rerun selected check'}).click();
 await expect(guide).toContainText('Original finding cleared');
 await expect(guide).toContainText('simulation');
});

test('diagnostics filters by modeled category and routes learners to network configuration',async({page})=>{
 await page.goto('/');
 await project(page,'Load Worked Example');
 await dock(page,'Diagnostics');
 await page.getByLabel('Fault type').selectOption('ipconflict');
 await page.getByRole('button',{name:'Inject Fault'}).click();
 const guide=page.getByRole('region',{name:'Guided troubleshooting'});
 await guide.getByLabel('Diagnostic category').selectOption('ip');
 const fault=guide.locator('.guided-finding').filter({hasText:/IP|IPv4|VLAN/i}).first();
 await expect(fault).toBeVisible();
 await expect(fault).toContainText('Next investigation');
 await fault.getByRole('button',{name:'Open network view'}).click();
 await expect(page.getByText('SIMULATED IPV4 CONNECTIVITY PROBE')).toBeVisible();
});

test('empty project guidance does not misrepresent success',async({page})=>{
 await page.goto('/');
 await dock(page,'Diagnostics');
 const guide=page.getByRole('region',{name:'Guided troubleshooting'});
 await expect(guide).toContainText('No equipment installed');
 await expect(guide).toContainText('not a physical test');
});


test('diagnostics dock expands only when requested and restores canvas space',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/');
 await dock(page,'Diagnostics');
 const canvas=page.locator('.canvas-body');
 const normal=(await canvas.boundingBox())!.height;
 expect(normal).toBeGreaterThan(300);
 const expand=page.getByRole('button',{name:'Expand diagnostics'});
 await expand.click();
 await expect(page.getByRole('button',{name:'Restore canvas space'})).toHaveAttribute('aria-pressed','true');
 const deep=(await canvas.boundingBox())!.height;
 expect(deep).toBeLessThan(normal-40);
 await page.getByRole('button',{name:'Restore canvas space'}).click();
 expect((await canvas.boundingBox())!.height).toBeGreaterThan(300);
});
