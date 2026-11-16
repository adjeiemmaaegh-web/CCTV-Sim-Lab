import {test,expect} from '@playwright/test';
import {disposableUpdatePreview} from './update-origin.js';

/**
 * B4-supporting browser test, NOT an installed real-device acceptance pass.
 * Two genuinely different SW versions are served on an isolated loopback origin.
 * The editor must refuse to activate the waiting worker until a verified local
 * project save succeeds. A download-only fallback is NOT a verified file save.
 */
test('waiting PWA update preserves unsaved draft, blocks unverified download, then activates after verified save',async({page})=>{
 test.setTimeout(90_000);
 const origin=await disposableUpdatePreview();
 const errors:string[]=[];
 page.on('pageerror',err=>errors.push(String(err)));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 try{
  // Disallow native picker on first attempt to prove that a download-only
  // fallback cannot authorize an update that would lose the editor draft.
  await page.addInitScript(()=>{delete (window as any).showSaveFilePicker;});
  await page.goto(origin.url);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();
  await expect.poll(()=>page.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const originalCaches=await page.evaluate(async()=> (await caches.keys()).filter(k=>k.startsWith('securitylab-react-')));
  expect(originalCaches).toHaveLength(1);
  await page.getByLabel('Night').check();
  await expect(page.getByRole('status',{name:'Project save status'})).toContainText('Unsaved changes');
  await page.evaluate(()=>{(window as any).__slUpdateSentinel='unsaved-draft-retained';});

  // Publish only a new *test* SW script with a distinct cache identity.
  // No Vercel or deployed production data is touched.
  origin.publishUpdate();
  await page.evaluate(async()=>{
   const registration=await navigator.serviceWorker.getRegistration();
   if(!registration)throw new Error('Service worker registration missing');
   await registration.update();
  });
  const banner=page.locator('#securitylab-update-ready');
  await expect(banner).toContainText('A new SecurityLab build is available');
  await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state??'none')).toBe('installed');
  const button=banner.getByRole('button',{name:'Save & update'});
  await expect(button).toBeEnabled();

  // A waiting worker must never replace the old one just because it installed.
  const before=await page.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration();
   return {active:reg?.active?.state,waiting:reg?.waiting?.state};
  });
  expect(before).toEqual({active:'activated',waiting:'installed'});

  const [download]=await Promise.all([page.waitForEvent('download'),button.click()]);
  expect(download.suggestedFilename()).toMatch(/\.securitylab\.json$/);
  await expect(banner).toContainText('Cannot update until this project is safely saved');
  expect(await page.evaluate(()=>(window as any).__slUpdateSentinel)).toBe('unsaved-draft-retained');
  await expect(page.getByLabel('Night')).toBeChecked();
  await expect.poll(()=>page.evaluate(async()=>(await navigator.serviceWorker.getRegistration())?.waiting?.state??'none')).toBe('installed');

  // A genuine origin-private writable FileSystemFileHandle stands in for a
  // Windows picker in CI. This is a verified browser readback, not an OS picker.
  await page.evaluate(()=>{
   (window as any).showSaveFilePicker=async()=>{
    const root=await navigator.storage.getDirectory();
    return root.getFileHandle('pwa-update-qa.securitylab.json',{create:true});
   };
  });
  const navigation=page.waitForEvent('load',{timeout:25_000});
  await button.click();
  await navigation;
  await expect(page.getByText('SecurityLab',{exact:true}).first()).toBeVisible();
  await expect(page.getByLabel('Installation workspace')).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__slUpdateSentinel??null)).toBeNull();

  // The consenting reload is allowed only after the last draft is durably
  // written and independently parseable by the browser's storage API.
  const state=await page.evaluate(async()=>{
   const handle=await (await navigator.storage.getDirectory()).getFileHandle('pwa-update-qa.securitylab.json');
   const text=await (await handle.getFile()).text();
   const doc=JSON.parse(text);
   return {
    format:doc.format,revision:doc.revision,night:doc.project.night,
    sha256:doc.checksum,caches:(await caches.keys()).filter(k=>k.startsWith('securitylab-react-'))
   };
  });
  expect(state).toMatchObject({format:'securitylab.project-file',revision:1,night:true});
  expect(state.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(state.caches).toContain('securitylab-react-qa-update-v2');
  expect(state.caches).not.toContain(originalCaches[0]);
  expect(errors).toEqual([]);
 }finally{await origin.stop();}
});
