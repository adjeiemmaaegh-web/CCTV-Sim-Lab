import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

test('one active CSS entry retains the historic cascade and exposes design tokens',async({page})=>{
 const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/workstation.css',import.meta.url),'utf8');
 expect(main.match(/import '\.\/[^']+\.css';/g)).toEqual(["import './workstation.css';","import './activity-workspace.css';"]);
 expect(css).toContain('=== Legacy foundation ===');
 expect(css).toContain('=== Former UI layer');
 expect(css).toContain('=== Former workspace layer');
 await page.goto('/');
 const values=await page.evaluate(()=>{
  const root=getComputedStyle(document.documentElement);
  return {accent:root.getPropertyValue('--accent').trim(),focus:root.getPropertyValue('--focus').trim(),spacing:root.getPropertyValue('--space-4').trim()};
 });
 expect(values).toEqual({accent:'#5fe3cc',focus:'#ffe18a',spacing:'16px'});
});

test('guide explains training, scenario scoring and a file-based finish',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Show getting started'}).click();
 const guide=page.getByRole('complementary',{name:'Getting started'});
 await expect(guide).toContainText('Pick a challenge');
 await expect(guide).toContainText('Test and repair');
 await expect(guide).toContainText('Assess and save');
 await expect(guide.getByLabel('Choose training challenge')).toBeVisible();
 await guide.getByRole('button',{name:'View challenge brief'}).click();
 const scenario=page.getByRole('region',{name:'Practical scenario requirements'});
 await expect(scenario).toBeVisible();
 await expect(scenario.getByRole('progressbar',{name:'Scenario objectives completed'})).toBeVisible();
 await expect(scenario.getByRole('button',{name:'Troubleshoot installation'})).toBeVisible();
 await scenario.getByRole('button',{name:'Troubleshoot installation'}).click();
 await expect(page.locator('.dock-tabs').getByRole('tab',{name:'Diagnostics'})).toHaveAttribute('aria-selected','true');
});

test('equipment selection reveals edit context and direct placement without overriding existing mode',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Show getting started'}).click();
 await page.getByRole('complementary',{name:'Getting started'}).getByRole('button',{name:'Start designing'}).click();
 await page.locator('.catalog-scroll button.equipment').first().click();
 const tool=page.getByRole('region',{name:'Active workspace tool'});
 await expect(tool).toContainText('Placing equipment');
 await tool.getByRole('button',{name:'Place at view center'}).click();
 const placed=page.locator('svg[role=application] g[data-device]').first();
 await expect(placed).toBeVisible();
 await page.getByRole('button',{name:'Select',exact:true}).click();
 await placed.click();
 await expect(tool).toContainText('Selected:');
 await expect(placed).toHaveAttribute('aria-pressed','true');
 await tool.getByRole('button',{name:'Show properties'}).click();
 await expect(page.getByRole('complementary',{name:'Properties'})).toBeVisible();
});

test('keyboard zoom is reversible, while save/undo shortcuts remain delegated to app',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Show getting started'}).click();
 await page.getByRole('complementary',{name:'Getting started'}).getByRole('button',{name:'Start designing'}).click();
 await page.locator('svg[role=application]').focus();
 await page.evaluate(()=>{(document.activeElement as HTMLElement|null)?.blur?.();});
 const readout=page.locator('.zoom-readout');
 await expect(readout).toHaveText('100%');
 await page.keyboard.press('=');
 await expect(readout).toHaveText('125%');
 await page.keyboard.press('0');
 await expect(readout).toHaveText('100%');
 await page.getByRole('button',{name:'Layers & tools'}).click();
 await expect(page.getByLabel('Select a device, room or wall by keyboard')).toBeVisible();
});

test.describe('dedicated mobile navigation',()=>{
 test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 test('mobile first-use and placement context have no serious/critical WCAG A/AA violations',async({page})=>{
  await page.goto('/');
  const axe=async()=>{
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa']).analyze();
   return result.violations.filter(v=>['serious','critical'].includes(v.impact||'')).map(v=>v.id);
  };
  await expect.poll(axe).toEqual([]);
  await page.getByRole('button',{name:'Show getting started'}).tap();
  await page.getByRole('complementary',{name:'Getting started'}).getByRole('button',{name:'Start designing'}).tap();
  await page.getByRole('navigation',{name:'Mobile workspace navigation'}).getByRole('button',{name:'Devices'}).tap();
  await page.locator('.catalog-scroll button.equipment').first().tap();
  await expect(page.getByRole('region',{name:'Active workspace tool'})).toContainText('Placing equipment');
  await expect.poll(axe).toEqual([]);
 });
 test('switches between the same live panels and maintains a touch-accessible plan',async({page})=>{
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Mobile workspace navigation'});
  await expect(nav).toBeVisible();
  const quick=page.getByRole('toolbar',{name:'Quick touch tools'});
  await expect(quick).toBeVisible();
  await quick.getByRole('button',{name:'Pan tool (mobile)'}).tap();
  await expect(quick.getByRole('button',{name:'Pan tool (mobile)'})).toHaveAttribute('aria-pressed','true');
  await quick.getByRole('button',{name:'Select tool (mobile)'}).tap();
  await nav.getByRole('button',{name:'Devices'}).tap();
  await expect(nav.getByRole('button',{name:'Devices'})).toHaveAttribute('aria-current','true');
  await expect(page.locator('.catalog')).toBeVisible();
  await nav.getByRole('button',{name:'Plan'}).tap();
  await expect(page.locator('svg[role=application]')).toBeVisible();
  await nav.getByRole('button',{name:'Properties'}).tap();
  await expect(page.locator('.inspector')).toBeVisible();
  await nav.getByRole('button',{name:'Simulation'}).tap();
  await expect(page.locator('.console')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
 });
});
