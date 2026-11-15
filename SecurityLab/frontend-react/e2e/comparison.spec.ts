import {test,expect,Page} from '@playwright/test';
import {project} from './helpers.js';

/**
 * An integrated usability regression: a learner creates a small security network,
 * connects it, changes a property, injects a fault and saves/reopens the work.
 * This is NOT evidence of Cisco Packet Tracer performance or physical installations.
 */
const spy=(page:Page)=>{
 const errors:string[]=[];
 page.on('dialog',dialog=>{void dialog.accept();});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 return errors;
};

test('five-step practical workflow: place, connect, configure, diagnose, save and reopen',async({page})=>{
 const errors=spy(page);
 // The origin-private file handle exercises createWritable and readback, not
 // a native Windows/macOS picker. Real OS-disk acceptance is a separate gate.
 await page.addInitScript(()=>{
  (window as any).showSaveFilePicker=async()=>{
   const root=await navigator.storage.getDirectory();
   return root.getFileHandle('benchmark.securitylab.json',{create:true});
  };
  (window as any).showOpenFilePicker=async()=>{
   const root=await navigator.storage.getDirectory();
   return [await root.getFileHandle('benchmark.securitylab.json')];
  };
 });
 await page.goto('/');
 await page.evaluate(async()=>{
  const dir=await navigator.storage.getDirectory();
  try{await dir.removeEntry('benchmark.securitylab.json');}catch{}
 });

 // 1. Place one IP camera and a PoE switch via the visible model catalog.
 const devices=page.locator('svg[role=application] g[data-device]');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'IP Bullet • 2MP'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:310,y:185}});
 await page.getByRole('button',{name:/Network Devices/}).click();
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'4-Port PoE+ Switch'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:490,y:255}});
 await expect(devices).toHaveCount(2);

 // 2. Connect camera and switch. This is a virtual link, not network traffic.
 await page.getByRole('button',{name:'Cable',exact:true}).click();
 await devices.first().click();
 await devices.nth(1).click();
 await expect(page.locator('svg[role=application] g[data-cable]')).toHaveCount(1);

 // 3. Configure the camera through its contextual network properties.
 await page.getByRole('button',{name:'Select',exact:true}).click();
 await devices.first().click();
 const props=page.getByRole('complementary',{name:'Properties'});
 await props.getByRole('tab',{name:'Network'}).click();
 await props.getByLabel('IP Address',{exact:true}).fill('192.168.10.44');
 await expect(props.getByLabel('IP Address',{exact:true})).toHaveValue('192.168.10.44');

 // 4. Inject a simulated wire fault and inspect the resulting diagnosis.
 await page.getByRole('tab',{name:'Diagnostics',exact:true}).click();
 await page.getByLabel('Fault type').selectOption('disconnect');
 await page.getByRole('button',{name:'Inject Fault'}).click();
 await expect(page.locator('.log-lines')).toContainText(/Cable disconnected|No usable Ethernet cable/);

 // 5. Save to a verified browser-origin test double, switch scenario and reopen.
 await project(page,'Save As');
 await expect(page.locator('footer')).toContainText('revision 1');
 const saved=await page.evaluate(async()=>{
  const root=await navigator.storage.getDirectory();
  const handle=await root.getFileHandle('benchmark.securitylab.json');
  return JSON.parse(await (await handle.getFile()).text());
 });
 expect(saved.format).toBe('securitylab.project-file');
 expect(saved.project.devices).toHaveLength(2);
 expect(saved.project.cables).toHaveLength(1);
 expect(saved.project.devices.some((d:{ip?:string})=>d.ip==='192.168.10.44')).toBe(true);
 await page.getByLabel('Scenario',{exact:true}).selectOption('shop3');
 await expect(page.getByLabel('Scenario',{exact:true})).toHaveValue('shop3');
 await project(page,'Open JSON');
 await expect(page.getByLabel('Scenario',{exact:true})).toHaveValue('home4');
 await expect(devices).toHaveCount(2);
 expect(errors).toEqual([]);
});

test('focus canvas cannot silently hide results of a left-rail command or assessment',async({page})=>{
 const errors=spy(page);await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Sections'});
 await page.getByRole('button',{name:'Focus canvas'}).click();
 await expect(page.locator('.catalog')).toBeHidden();

 // These commands are not useful if their panels stay hidden in Focus mode.
 await nav.getByRole('button',{name:'Equipment'}).click();
 await expect(page.locator('.catalog')).toBeVisible();
 await expect(page.locator('.console')).toBeVisible();

 await page.getByRole('button',{name:'Focus canvas'}).click();
 await nav.getByRole('button',{name:'Network'}).click();
 await expect(page.locator('.console')).toBeVisible();
 await expect(page.getByText('SIMULATED IPV4 CONNECTIVITY PROBE')).toBeVisible();
 await expect(page.getByRole('button',{name:'Network Topology'})).toHaveAttribute('aria-pressed','true');

 await page.getByRole('button',{name:'Focus canvas'}).click();
 await page.getByRole('button',{name:'Assess Installation'}).click();
 await expect(page.locator('.console')).toBeVisible();
 await expect(page.locator('.dock-more > button')).toContainText('Assessment');
 expect(errors).toEqual([]);
});

test('cable affordance guides each endpoint and Escape cancels the gesture',async({page})=>{
 const errors=spy(page);await page.goto('/');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'IP Bullet • 2MP'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:300,y:170}});
 await page.getByRole('button',{name:/Network Devices/}).click();
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'4-Port PoE+ Switch'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:480,y:220}});
 await page.getByRole('button',{name:'Cable',exact:true}).click();
 await expect(page.locator('.canvas-hint')).toContainText('click the first device');
 await page.locator('svg[role=application] g[data-device]').first().click();
 await expect(page.locator('.canvas-hint')).toContainText('First cable endpoint selected');
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Select',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.canvas-hint')).not.toContainText('First cable endpoint selected');
 await expect(page.locator('svg[role=application] g[data-cable]')).toHaveCount(0);
 expect(errors).toEqual([]);
});
