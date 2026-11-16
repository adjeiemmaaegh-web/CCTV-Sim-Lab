import {test,expect,chromium} from '@playwright/test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {disposableStaticPreview} from './offline-origin.js';
import {project} from './helpers.js';

/**
 * Browser-process cold-relaunch regression: an actual persistent Chromium
 * profile is closed, and a new Chromium browser process opens the same profile
 * AFTER the test's HTTP origin has stopped accepting requests.
 *
 * This is useful B3 evidence but NOT an installed PWA app-window launch,
 * a physical network disconnect, an OS reboot, or Windows 11 acceptance.
 */
test('offline shell survives Chromium process exit and new process with the same profile',async()=>{
 test.setTimeout(120_000);
 const profile=await mkdtemp(path.join(tmpdir(),'securitylab-pwa-cold-'));
 const server=await disposableStaticPreview();
 let context:Awaited<ReturnType<typeof chromium.launchPersistentContext>>|null=null;
 const pageErrors:string[]=[];
 try{
  context=await chromium.launchPersistentContext(profile,{
   headless:true,viewport:{width:1280,height:800},acceptDownloads:true
  });
  const first=await context.newPage();
  first.on('pageerror',e=>pageErrors.push('initial: '+String(e)));
  await first.goto(server.url);
  await first.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await first.reload();
  await expect.poll(()=>first.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  const before=await first.evaluate(async()=>{
   const reg=await navigator.serviceWorker.getRegistration();
   const keys=(await caches.keys()).filter(k=>k.startsWith('securitylab-react-'));
   if(keys.length!==1)return {active:reg?.active?.state,cacheCount:keys.length,cachedIndex:false};
   const cache=await caches.open(keys[0]);
   return {active:reg?.active?.state,cacheCount:keys.length,cachedIndex:!!(await cache.match('/index.html'))};
  });
  expect(before).toEqual({active:'activated',cacheCount:1,cachedIndex:true});

  // The first browser process and all its pages are actually closed.
  await context.close();
  context=null;
  // The loopback origin is completely unavailable BEFORE the next process
  // launches, as opposed to simulating offline on an already-open page.
  await server.stop();

  context=await chromium.launchPersistentContext(profile,{
   headless:true,viewport:{width:1280,height:800},acceptDownloads:true
  });
  const reopened=await context.newPage();
  reopened.on('pageerror',e=>pageErrors.push('reopened: '+String(e)));
  const response=await reopened.goto(server.url,{waitUntil:'load',timeout:25_000});
  expect(response,'Cold navigation should be served by the registered offline shell').not.toBeNull();
  expect(response!.status()).toBe(200);
  expect(response!.fromServiceWorker()).toBe(true);
  await expect.poll(()=>reopened.evaluate(()=>Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(reopened.getByText('SecurityLab',{exact:true}).first()).toBeVisible();
  await expect(reopened.getByLabel('Installation workspace')).toBeVisible();

  // These interactions execute after the entire origin is unavailable;
  // an installed icon or a warm same-tab reload would not prove this.
  await project(reopened,'Load Worked Example');
  await expect(reopened.locator('svg[role=application] g[data-device]')).toHaveCount(6);
  await expect(reopened.getByLabel('Realtime status')).toContainText('4 / 4 Recording');
  const [backup]=await Promise.all([
   reopened.waitForEvent('download',{timeout:15_000}),
   project(reopened,'Export Backup')
  ]);
  const backupText=await readFile((await backup.path())!,'utf8');
  const doc=JSON.parse(backupText);
  expect(backup.suggestedFilename()).toMatch(/\.backup\.json$/);
  expect(doc.format).toBe('securitylab.project-file');
  expect(doc.project.devices).toHaveLength(6);
  expect(doc.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(pageErrors).toEqual([]);
  console.log('COLD_RELAUNCH_PROBE '+JSON.stringify({
   result:'PASS',os:process.env.RUNNER_OS??process.platform,
   gitSha:process.env.GITHUB_SHA??null,
   firstSessionCache:before.cacheCount,
   browserContext:'persistent Chromium profile; two separately launched browser processes',
   origin:'local HTTP server stopped before second process launch',
   navigation:{status:response!.status(),fromServiceWorker:response!.fromServiceWorker()},
   offlineWorkedExampleDevices:doc.project.devices.length,
   backupChecksum:doc.checksum.slice(0,7),
   pageErrors:pageErrors.length,
   manualAcceptance:'NOT RUN: physical Wi-Fi-off, installed PWA, 8GB Windows 11'
  }));
 }finally{
  try{await context?.close();}finally{
   await server.stop();
   await rm(profile,{recursive:true,force:true,maxRetries:8,retryDelay:100});
  }
 }
});
