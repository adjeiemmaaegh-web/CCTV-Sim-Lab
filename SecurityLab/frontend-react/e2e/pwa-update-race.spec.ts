import {test,expect} from '@playwright/test';
import {disposableUpdatePreview} from './update-origin.js';
import {project} from './helpers.js';

/**
 * Controlled mid-handshake edit: a peer responds SAFE on the first query,
 * then becomes dirty before revalidation. The worker must remain waiting.
 * The test-only worker emits a first-pass marker and widens the gap; no such
 * marker or artificial delay is emitted by the production build.
 */
test('late peer edit after first consent prevents pending update activation',async({context})=>{
 test.setTimeout(90_000);
 const origin=await disposableUpdatePreview({pauseAfterFirstPass:true});
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
  await b.evaluate(()=>{
   (window as any).__slFirstApprovalReceived=false;
   (window as any).__slPeerMarker='peer-tab-not-reloaded';
   navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.type==='SECURITYLAB_QA_FIRST_PASS_DONE')
     (window as any).__slFirstApprovalReceived=true;
   });
  });

  origin.publishUpdate();
  await a.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration();
   if(!reg)throw new Error('Expected registration');
   await reg.update();
  });
  const banner=a.locator('#securitylab-update-ready');
  await expect(banner).toContainText('A new SecurityLab build is available');
  const button=banner.getByRole('button',{name:'Save & update'});
  await expect.poll(()=>a.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');

  // A begins with both editors clean. After *all* peers approve the first
  // query, inject the unsaved edit in B while the worker is paused.
  const click=button.click({noWaitAfter:true});
  await expect.poll(()=>b.evaluate(()=>(window as any).__slFirstApprovalReceived),{timeout:10_000}).toBe(true);
  await b.getByLabel('Night').check();
  await click;
  await expect(b.getByRole('status',{name:'Project save status'})).toContainText('Unsaved changes');
  await expect(banner).toContainText('another open SecurityLab tab',{timeout:15_000});
  await expect.poll(()=>a.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe('installed');
  expect(await b.evaluate(()=>(window as any).__slPeerMarker)).toBe('peer-tab-not-reloaded');
  await expect(b.getByLabel('Night')).toBeChecked();

  // Save B through a real OPFS-backed test handle, retry, and verify the
  // ordinary positive update flow remains functional after revalidation.
  await b.evaluate(()=>{
   (window as any).showSaveFilePicker=async()=>{
    const root=await navigator.storage.getDirectory();
    return root.getFileHandle('late-edit-qa.securitylab.json',{create:true});
   };
  });
  await project(b,'Save As');
  await expect(b.getByRole('status',{name:'Project save status'})).toContainText('Saved');
  const doc=await b.evaluate(async()=>{
   const root=await navigator.storage.getDirectory();
   const handle=await root.getFileHandle('late-edit-qa.securitylab.json');
   return JSON.parse(await (await handle.getFile()).text());
  });
  expect(doc).toMatchObject({format:'securitylab.project-file',revision:1});
  expect(doc.project.night).toBe(true);
  expect(doc.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);

  const load=a.waitForEvent('load',{timeout:25_000});
  await button.click();
  await load;
  await expect(a.getByText('SecurityLab',{exact:true}).first()).toBeVisible();
  await expect.poll(()=>a.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting??'none')).toBe('none');
  expect(await b.evaluate(()=>(window as any).__slPeerMarker)).toBe('peer-tab-not-reloaded');
  expect(errors).toEqual([]);
 }finally{
  await origin.stop();
  await a.close();
  await b.close();
 }
});
