import {test,expect} from '@playwright/test';
import {disposableUpdatePreview} from './update-origin.js';
import {project} from './helpers.js';

/**
 * Source-level safety regression: one clean tab may not activate a waiting SW
 * while another same-origin SecurityLab tab still owns unsaved work.
 * This is headless Chromium/OPFS evidence, not Windows 11 installed-PWA QA.
 */
test('one tab cannot activate an update while a second tab has an unsaved draft',async({context})=>{
 test.setTimeout(90_000);
 const origin=await disposableUpdatePreview();
 const a=await context.newPage();
 const b=await context.newPage();
 const errors:string[]=[];
 for(const p of [a,b])p.on('pageerror',e=>errors.push(String(e)));
 try{
  await a.goto(origin.url);
  await a.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await a.reload();
  await expect.poll(()=>a.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);

  await b.goto(origin.url);
  await expect.poll(()=>b.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  // Editor A's pristine blank project needs no file write; B must block a
  // cross-tab update even though A itself has no changes.
  await b.getByLabel('Night').check();
  await expect(b.getByRole('status',{name:'Project save status'})).toContainText('Unsaved changes');
  await b.evaluate(()=>{(window as any).__securitylabBUncommitted=true;});

  origin.publishUpdate();
  await a.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration();
   if(!reg)throw new Error('Missing PWA registration');
   await reg.update();
  });
  const banner=a.locator('#securitylab-update-ready');
  await expect(banner).toContainText('A new SecurityLab build is available');
  await expect.poll(()=>a.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
  const button=banner.getByRole('button',{name:'Save & update'});
  await button.click();
  await expect(banner).toContainText('another open SecurityLab tab', {timeout:10_000});
  await expect.poll(()=>a.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
  await expect(b.getByLabel('Night')).toBeChecked();
  expect(await b.evaluate(()=>(window as any).__securitylabBUncommitted)).toBe(true);

  // A real browser-origin file handle stands in for the OS picker in CI;
  // the resulting SecurityLab file is verified by the normal write/readback.
  await b.evaluate(()=>{
   (window as any).showSaveFilePicker=async()=>{
    const root=await navigator.storage.getDirectory();
    return root.getFileHandle('multitab-unsaved-qa.securitylab.json',{create:true});
   };
  });
  await project(b,'Save As');
  await expect(b.getByRole('status',{name:'Project save status'})).toContainText('Saved');
  const saved=await b.evaluate(async()=>{
   const h=await (await navigator.storage.getDirectory()).getFileHandle('multitab-unsaved-qa.securitylab.json');
   const file=JSON.parse(await (await h.getFile()).text());
   return {night:file.project.night,revision:file.revision,checksum:file.checksum};
  });
  expect(saved).toMatchObject({night:true,revision:1});
  expect(saved.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);

  const aReload=a.waitForEvent('load',{timeout:25_000});
  await button.click();
  await aReload;
  await expect(a.getByText('SecurityLab',{exact:true}).first()).toBeVisible();
  await expect.poll(()=>a.evaluate(async()=>{
   const regs=await navigator.serviceWorker.getRegistration();
   return regs?.waiting===null&&regs?.active?.state==='activated';
  })).toBe(true);
  expect(await b.evaluate(()=>(window as any).__securitylabBUncommitted)).toBe(true);
  expect(errors).toEqual([]);
 }finally{await origin.stop();await a.close();await b.close();}
});
