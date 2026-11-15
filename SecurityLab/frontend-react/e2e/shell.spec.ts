import {test,expect,Page} from '@playwright/test';
import {project,dock,settings} from './helpers.js';
const watch=(page:Page)=>{const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;};

test('shell: left navigation focuses the matching dock tab and plan view',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Sections'});
 await nav.getByRole('button',{name:'Network'}).click();
 await expect(page.getByRole('button',{name:'Network Topology'})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('SIMULATED IPV4 CONNECTIVITY PROBE')).toBeVisible();
 await nav.getByRole('button',{name:'Alarms'}).click();
 await expect(page.getByRole('button',{name:'Floor Plan'})).toHaveAttribute('aria-pressed','true');
 await nav.getByRole('button',{name:'Scenarios'}).click();
 await expect(page.getByLabel('Practical scenario requirements')).toBeVisible();
 await nav.getByRole('button',{name:'Assessment'}).click();
 await nav.getByRole('button',{name:'Equipment'}).click();
 await expect(page.getByLabel('Realtime status')).toBeVisible();
 expect(errs).toEqual([]);
});

test('shell: Project menu opens, is keyboard dismissible and exposes every file action',async({page})=>{
 await page.goto('/');
 const btn=page.getByRole('button',{name:'Project',exact:true});
 await btn.click();
 for(const n of ['New','Open JSON','Save Project','Save As','Export Backup','Checkpoints','Import Copy','Undo','Redo','Load Worked Example','Floor-plan image'])await expect(page.getByRole('menuitem',{name:n,exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('menu',{name:'Project'})).toHaveCount(0);
 await btn.click();await page.mouse.click(5,300);
 await expect(page.getByRole('menu',{name:'Project'})).toHaveCount(0);
});

test('shell: Settings and Help dialogs trap focus and close with Escape',async({page})=>{
 await page.goto('/');
 await settings(page);
 const dlg=page.getByRole('dialog',{name:'Settings'});
 await expect(dlg).toBeVisible();
 for(let i=0;i<8;i++)await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>!!document.activeElement?.closest('[role=dialog]'))).toBe(true);
 await page.keyboard.press('Escape');await expect(dlg).toHaveCount(0);
 await page.getByRole('button',{name:'Help',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Help'})).toContainText('Quick start');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Help'})).toHaveCount(0);
});

test('shell: dock More menu reaches secondary tabs and Console opens the network CLI',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await dock(page,'Recordings');await expect(page.getByText(/Channel matrix/)).toBeVisible();
 await dock(page,'Scenario');await expect(page.getByLabel('Practical scenario requirements')).toBeVisible();
 await dock(page,'Console');await expect(page.getByLabel('CLI command')).toBeVisible();
 await dock(page,'Tools');await expect(page.getByLabel('CLI command')).toHaveCount(0);
 expect(errs).toEqual([]);
});

test('shell: library categories collapse, search opens matching ones, selecting arms placement',async({page})=>{
 await page.goto('/');
 await page.getByLabel('Scenario',{exact:true}).selectOption('alarm-install');
 const lib=page.getByLabel('Equipment library');
 await expect(lib.getByRole('button',{name:/^CCTV Cameras/})).toHaveAttribute('aria-expanded','true');
 await expect(lib.getByRole('button',{name:/^Alarm Devices/})).toHaveAttribute('aria-expanded','false');
 await expect(lib.getByRole('button',{name:/^CCTV Cameras \(0\)/})).toHaveAttribute('aria-expanded','true'); // not part of this scenario's supply list
 await lib.getByLabel('Search equipment').fill('siren');
 await expect(lib.getByRole('button',{name:/^Alarm Devices/})).toHaveAttribute('aria-expanded','true');
 await expect(lib.locator('button.equipment').first()).toContainText(/siren/i);
 await lib.locator('button.equipment').first().click();
 await expect(lib.locator('button.equipment.chosen')).toHaveCount(1);
});

test('shell: device properties show tabs; Coverage edits the camera; close clears the selection',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example');
 await page.locator('svg[role=application] g[data-device]').first().focus();
 await page.keyboard.press('Enter');
 const props=page.getByRole('complementary',{name:'Properties'});
 await expect(props).toContainText('Device Properties');
 await props.getByRole('tab',{name:'Network'}).click();
 await props.getByRole('tab',{name:'Coverage'}).click();
 await props.getByRole('tab',{name:'General'}).click();
 await props.getByRole('button',{name:'Close properties'}).click();
 await expect(props).toContainText('Properties');
 await expect(props.getByRole('tab',{name:'General'})).toHaveCount(0);
 expect(errs).toEqual([]);
});

test('shell: camera coverage fields live under the Coverage tab and drive the simulation',async({page})=>{
 await page.goto('/');
 await project(page,'Load Worked Example');
 // pick a camera through the keyboard navigator
 await page.getByRole('button',{name:'Layers & tools'}).click();
 const nav=page.getByLabel('Select a device, room or wall by keyboard');
 const cam=(await nav.locator('option').allTextContents()).find(t=>/IP Bullet/.test(t))!;
 await nav.selectOption({label:cam});
 const props=page.getByRole('complementary',{name:'Properties'});
 await props.getByRole('tab',{name:'Coverage'}).click();
 const fov=props.getByLabel('Field of View (°)');
 await expect(fov).toBeVisible();
 await fov.fill('40');
 await props.getByRole('tab',{name:'General'}).click();
 await props.getByRole('tab',{name:'Coverage'}).click();
 await expect(props.getByLabel('Field of View (°)')).toHaveValue('40');
 await props.getByRole('tab',{name:'Network'}).click();
 await expect(props.getByLabel('IP Address')).toBeVisible();
});

test('shell: run control advances the virtual clock for a bounded time and pauses on request',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example');
 const rt=page.getByLabel('Realtime status');
 await expect(rt).toContainText('Time: Mon 12:00');
 await rt.getByRole('button',{name:'Run simulation clock'}).click();
 await expect(rt.getByText(/Running \(\d+\/60 min\)/)).toBeVisible();
 await expect(rt).toContainText(/Time: Mon 12:0[2-9]/,{timeout:8000});
 await rt.getByRole('button',{name:'Pause simulation clock'}).click();
 await expect(rt.getByText('Simulation: Paused')).toBeVisible();
 const frozen=await rt.textContent();
 await page.waitForTimeout(1800);
 expect(await rt.textContent()).toBe(frozen);
 expect(errs).toEqual([]);
});

test('shell: layout holds at common desktop sizes (no horizontal overflow, canvas usable, nothing clipped off-screen)',async({page})=>{
 for(const [w,h] of [[1920,1080],[1672,941],[1440,900],[1366,768],[1280,720]] as const){
  await page.setViewportSize({width:w,height:h});await page.goto('/');
  await page.locator('svg[role=application]').waitFor();
  const m=await page.evaluate(()=>{const r=(s:string)=>document.querySelector(s)!.getBoundingClientRect();const svg=r('svg[role=application]'),top=r('.topbar'),nav=r('.nav-rail'),foot=r('.status-footer');
   return {overflowX:document.documentElement.scrollWidth-document.documentElement.clientWidth,svgH:svg.height,svgW:svg.width,topRight:top.right,navLeft:nav.left,footBottom:foot.bottom,vh:innerHeight,vw:innerWidth};});
  expect(m.overflowX,`${w}x${h} overflow`).toBeLessThanOrEqual(1);
  expect(m.svgH,`${w}x${h} canvas height`).toBeGreaterThanOrEqual(240);
  expect(m.navLeft).toBeGreaterThanOrEqual(0);
  expect(m.footBottom,`${w}x${h} footer visible`).toBeLessThanOrEqual(m.vh+1);
 }
});


test('canvas-first: narrow laptops keep editing toolbar to one row and focus restores panels',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 const errors=watch(page);await page.goto('/');
 const toolbar=await page.locator('.canvas-toolbar').boundingBox();
 const original=await page.locator('.canvas-body').boundingBox();
 expect(toolbar!.height).toBeLessThanOrEqual(80);
 expect(original!.height).toBeGreaterThan(350);
 await page.locator('.catalog-scroll button.equipment').filter({hasText:/IP Bullet/i}).first().click();
 const focus=page.getByRole('button',{name:'Focus canvas'});
 await focus.click();
 await expect(page.getByRole('button',{name:'Restore workstation panels'})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.catalog')).toBeHidden();
 await expect(page.locator('.inspector')).toBeHidden();
 await expect(page.locator('.console')).toBeHidden();
 const expanded=await page.locator('.canvas-body').boundingBox();
 expect(expanded!.width).toBeGreaterThan(800);
 expect(expanded!.height).toBeGreaterThan(500);
 await page.locator('svg[role=application]').click({position:{x:400,y:220}});
 await expect(page.locator('svg[role=application] g[data-device]')).toHaveCount(1);
 await page.getByRole('button',{name:'Restore workstation panels'}).click();
 await expect(page.locator('.catalog')).toBeVisible();
 await expect(page.locator('.inspector')).toBeVisible();
 await expect(page.locator('.console')).toBeVisible();
 await expect(page.locator('.device-summary')).toBeVisible();
 expect(errors).toEqual([]);
});

test('canvas-first: phone shows plan before equipment catalog without a 250px top toolbar',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const m=await page.evaluate(()=>{
  const rect=(s:string)=>document.querySelector(s)!.getBoundingClientRect();
  return {top:rect('.topbar').height,canvasY:rect('.canvas-panel').top,catalogY:rect('.catalog').top,toolbarH:rect('.canvas-toolbar').height,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
 });
 expect(m.top).toBeLessThan(180);
 expect(m.toolbarH).toBeLessThanOrEqual(80);
 expect(m.canvasY).toBeLessThan(340);
 expect(m.catalogY).toBeGreaterThan(m.canvasY);
 expect(m.overflow).toBeLessThanOrEqual(1);
});
