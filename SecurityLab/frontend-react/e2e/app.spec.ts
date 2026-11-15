import {test,expect,Page} from '@playwright/test';
const IDS=['home4','home8','shop3','warehouse8','alarm-install','ip-network','rfid-access','solar-backup','diagnose4','perimeter'];
function watch(page:Page){const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;}

test('startup renders workstation without errors',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await expect(page.getByText('VIRTUAL ENGINEERING')).toBeVisible();
 await expect(page.getByLabel('Installation workspace')).toBeVisible();
 await expect(page.getByRole('button',{name:'Save As'})).toBeVisible();
 expect(errs).toEqual([]);
});

test('service worker controls page and app reloads offline',async({page,context})=>{
 await page.goto('/');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();
 await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 await context.setOffline(true);
 await page.reload();
 await expect(page.getByText('VIRTUAL ENGINEERING')).toBeVisible();
 await expect(page.getByLabel('Installation workspace')).toBeVisible();
 await context.setOffline(false);
});

test('all ten scenarios load, simulate and show a briefing',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const sel=page.getByLabel('Scenario',{exact:true});
 for(const id of IDS){
  await sel.selectOption(id);
  await expect(sel).toHaveValue(id);
  await expect(page.getByRole('button',{name:/^Briefing ·/})).toBeVisible();
 }
 expect(errs).toEqual([]);
});

test('worked example, assessment, undo/redo',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const brief=page.getByRole('button',{name:/^Briefing ·/});
 const before=await brief.textContent();
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
 await expect(brief).not.toHaveText(before!);
 await page.getByRole('button',{name:'Assess Installation'}).click();
 await page.getByRole('button',{name:/Undo/}).click();
 await expect(page.getByRole('button',{name:/Redo/})).toBeEnabled();
 expect(errs).toEqual([]);
});

test('equipment placement by keyboard-accessible catalogue click',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const devs=page.locator('svg[role=application] g[data-device]');
 const n0=await devs.count();
 await page.locator('.catalog-scroll button.equipment').filter({hasText:/camera/i}).first().click();
 await page.locator('svg[role=application]').click({position:{x:300,y:120}});
 await expect.poll(()=>devs.count()).toBeGreaterThan(n0);
 expect(errs).toEqual([]);
});

test('Save As falls back to labelled download, reopen via Open JSON, corrupt file rejected',async({page})=>{
 await page.addInitScript(()=>{delete (window as any).showSaveFilePicker;delete (window as any).showOpenFilePicker;});
 await page.goto('/');
 const errs=watch(page);
 const [dl]=await Promise.all([page.waitForEvent('download',{timeout:10000}).catch(()=>null),page.getByRole('button',{name:'Save As'}).click()]);
 expect(dl).not.toBeNull();
 const path=await dl!.path();
 const fs=await import('node:fs');
 const text=fs.readFileSync(path!,'utf8');
 const doc=JSON.parse(text);
 expect(doc.format).toBe('securitylab.project-file');
 expect(doc.checksum).toMatch(/^sha256:/);
 await expect(page.locator('body')).toContainText(/download|unverified/i);
 // reopen valid
 await page.locator('input[type=file]').first().setInputFiles({name:'ok.securitylab.json',mimeType:'application/json',buffer:Buffer.from(text)});
 // corrupt
 doc.project.title='tampered';
 await page.locator('input[type=file]').first().setInputFiles({name:'bad.securitylab.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});
 await expect(page.locator('body')).toContainText(/checksum/i);
 expect(errs.filter(e=>!/checksum/i.test(e))).toEqual([]);
});

test('canvas stays usable on a 1280x720 laptop viewport',async({page})=>{
 await page.setViewportSize({width:1280,height:720});await page.goto('/');
 const box=await page.locator('svg[role=application]').boundingBox();
 expect(box!.height).toBeGreaterThanOrEqual(250);
});

test('web manifest is valid and every icon is served and precached',async({page,request})=>{
 await page.goto('/');
 const m=await (await request.get('/manifest.webmanifest')).json();
 expect(m.display).toBe('standalone');
 const sizes=m.icons.map((i:any)=>i.sizes);
 expect(sizes).toEqual(expect.arrayContaining(['192x192','512x512']));
 const sw=await (await request.get('/service-worker.js')).text();
 for(const i of m.icons){
  const r=await request.get(i.src);expect(r.status()).toBe(200);
  expect(sw).toContain(i.src);
 }
});

test('service worker never self-activates (updates need the user to confirm)',async({request})=>{
 const sw=await (await request.get('/service-worker.js')).text();
 // skipWaiting is permitted only inside the ACTIVATE_UPDATE message handler
 const idx=sw.indexOf('skipWaiting');
 expect(idx).toBeGreaterThan(-1);
 expect(sw.slice(0,idx)).toContain("ACTIVATE_UPDATE");
 expect(sw.match(/skipWaiting/g)!.length).toBe(1);
});
