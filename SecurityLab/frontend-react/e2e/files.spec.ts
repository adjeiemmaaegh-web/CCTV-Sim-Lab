import {test,expect,Page} from '@playwright/test';
import {project,dock,settings} from './helpers.js';
/* The native picker dialogs cannot be driven headlessly, so showSaveFilePicker/showOpenFilePicker are
   replaced by a TEST DOUBLE that returns genuine FileSystemFileHandles from the browser's origin-private
   file system (real createWritable/getFile/readback). Real OS-disk pickers remain a manual acceptance gate. */
const stub=`
 window.__pick={next:'a.securitylab.json'};
 window.showSaveFilePicker=async()=>{const d=await navigator.storage.getDirectory();return d.getFileHandle(window.__pick.next,{create:true});};
 window.showOpenFilePicker=async()=>{const d=await navigator.storage.getDirectory();return [await d.getFileHandle(window.__pick.next)];};
`;
const read=(page:Page,name:string)=>page.evaluate(async n=>{const d=await navigator.storage.getDirectory();const h=await d.getFileHandle(n);return (await h.getFile()).text();},name);
const write=(page:Page,name:string,text:string)=>page.evaluate(async([n,t])=>{const d=await navigator.storage.getDirectory();const h=await d.getFileHandle(n,{create:true});const w=await h.createWritable();await w.write(t);await w.close();},[name,text]);
const setNext=(page:Page,name:string)=>page.evaluate(n=>{(window as any).__pick.next=n;},name);
async function boot(page:Page){
 page.on('dialog',d=>{void d.accept();});
 await page.addInitScript(stub);await page.goto('/');
 await page.evaluate(async()=>{const d=await navigator.storage.getDirectory();for await(const k of (d as any).keys())await d.removeEntry(k);});
}
const notice=(page:Page)=>page.locator('body');

test('Save As -> Save -> revision increments; file is parseable on disk',async({page})=>{
 await boot(page);
 await project(page,'Save As');
 await expect(notice(page)).toContainText('Saved and read back from a.securitylab.json (revision 1)');
 let doc=JSON.parse(await read(page,'a.securitylab.json'));
 expect(doc.revision).toBe(1);expect(doc.checksum).toMatch(/^sha256:/);
 await page.getByLabel('Night').check();
 await project(page,'Save Project');
 await expect(notice(page)).toContainText('(revision 2)');
 doc=JSON.parse(await read(page,'a.securitylab.json'));
 expect(doc.revision).toBe(2);expect(doc.project.night).toBe(true);expect(doc.checkpoints.length).toBe(1);
});

test('Save As refuses a nonempty existing file and leaves its bytes unchanged',async({page})=>{
 await boot(page);
 await project(page,'Save As');
 await expect(notice(page)).toContainText('revision 1');
 const before=await read(page,'a.securitylab.json');
 await page.getByLabel('Night').check();
 await project(page,'Save As'); // picker returns same, nonempty file
 await expect(notice(page)).toContainText(/nonempty file|cannot be overwritten/i);
 expect(await read(page,'a.securitylab.json')).toBe(before);
});

test('external modification is detected; app does not overwrite newer data',async({page})=>{
 await boot(page);
 await project(page,'Save As');
 await expect(notice(page)).toContainText('revision 1');
 const external=(await read(page,'a.securitylab.json'))+'\n';
 await write(page,'a.securitylab.json',external);
 await page.getByLabel('Night').check();
 await project(page,'Save Project');
 await expect(notice(page)).toContainText(/changed|conflict|external/i);
 expect(await read(page,'a.securitylab.json')).toBe(external);
});

test('Open JSON through native picker reloads a saved project and keeps revision',async({page})=>{
 await boot(page);
 await page.getByLabel('Scenario',{exact:true}).selectOption('shop3');
 await project(page,'Save As');
 await expect(notice(page)).toContainText('revision 1');
 await page.getByLabel('Scenario',{exact:true}).selectOption('home8');
 await project(page,'Open JSON');
 await expect(page.getByLabel('Scenario',{exact:true})).toHaveValue('shop3');
 await expect(page.locator('footer')).toContainText('revision 1');
});

test('corrupted file on disk is rejected on open',async({page})=>{
 await boot(page);
 await project(page,'Save As');
 await expect(notice(page)).toContainText('revision 1');
 const doc=JSON.parse(await read(page,'a.securitylab.json'));doc.project.title='tampered';
 await write(page,'b.securitylab.json',JSON.stringify(doc));await setNext(page,'b.securitylab.json');
 await project(page,'Open JSON');
 await expect(notice(page)).toContainText(/checksum/i);
});

test('two same-origin editor tabs cannot silently overwrite a stale project revision',async({browser})=>{
 const context=await browser.newContext();
 const first=await context.newPage(),second=await context.newPage();
 try{
  await first.addInitScript(stub);await second.addInitScript(stub);
  await first.goto('/');
  await first.evaluate(async()=>{const d=await navigator.storage.getDirectory();try{await d.removeEntry('a.securitylab.json');}catch{}});
  await second.goto('/');
  await project(first,'Save As');
  await expect(first.locator('body')).toContainText('(revision 1)');
  await project(second,'Open JSON');
  await expect(second.locator('footer')).toContainText('revision 1');
  await first.getByLabel('Night').check();
  await second.getByLabel('Night').check();
  await Promise.all([project(first,'Save Project'),project(second,'Save Project')]);
  await expect.poll(async()=>{
   const texts=await Promise.all([first.locator('body').innerText(),second.locator('body').innerText()]);
   return texts.filter(t=>t.includes('(revision 2)')).length;
  }).toBe(1);
  // React renders the winner's revision before the loser necessarily renders
  // its blocked-save banner. Await that second outcome, not just the first save.
  await expect.poll(async()=>{
   const alerts=await Promise.all([first.getByRole('alert').count(),second.getByRole('alert').count()]);
   return alerts.reduce((a,b)=>a+b,0);
  }).toBe(1);
  const alerts=await Promise.all([first.getByRole('alert').allTextContents(),second.getByRole('alert').allTextContents()]);
  expect(alerts.flat().some(t=>/changed outside this editor|file changed|file-write lock/i.test(t))).toBe(true);
  const saved=JSON.parse(await read(first,'a.securitylab.json'));
  expect(saved.revision).toBe(2);
  expect(saved.project.night).toBe(true);
 }finally{await context.close();}
});

test('a missing exclusive browser lock refuses native writes before changing file contents',async({page})=>{
 await page.addInitScript(stub);
 await page.addInitScript(()=>{Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});});
 await page.goto('/');
 const d=await page.evaluate(async()=>{const fs=await navigator.storage.getDirectory();try{await fs.removeEntry('a.securitylab.json');}catch{}return true;});
 expect(d).toBe(true);
 await project(page,'Save As');
 await expect(page.locator('body')).toContainText('Exclusive browser file-write lock unavailable');
 const text=await read(page,'a.securitylab.json');
 expect(text).toBe('');
});

test('an interrupted staged write preserves the saved file and permits a separate draft backup',async({page})=>{
 await page.addInitScript(`
 window.__failWrites=false;
 window.showSaveFilePicker=async()=>{
  const dir=await navigator.storage.getDirectory();
  const real=await dir.getFileHandle('faulted.securitylab.json',{create:true});
  return {
   name:real.name,
   getFile:()=>real.getFile(),
   queryPermission:async()=> 'granted',
   createWritable:async()=>{
    const writer=await real.createWritable();
    if(!window.__failWrites)return writer;
    return {
     write:async content=>{await writer.write(content);throw new Error('Injected staged-write failure');},
     close:()=>writer.close(),
     abort:()=>writer.abort()
    };
   }
  };
 };
 `);
 await page.goto('/');
 await page.evaluate(async()=>{const dir=await navigator.storage.getDirectory();try{await dir.removeEntry('faulted.securitylab.json');}catch{}});
 await project(page,'Save As');
 await expect(page.locator('body')).toContainText('(revision 1)');
 const before=await read(page,'faulted.securitylab.json');
 await page.getByLabel('Night').check();
 await page.evaluate(()=>(window as any).__failWrites=true);
 await project(page,'Save Project');
 await expect(page.locator('body')).toContainText('Injected staged-write failure');
 expect(await read(page,'faulted.securitylab.json')).toBe(before);
 const [dl]=await Promise.all([page.waitForEvent('download'),project(page,'Export Backup')]);
 const fs=await import('node:fs');
 const exported=JSON.parse(fs.readFileSync((await dl.path())!,'utf8'));
 expect(exported.project.night).toBe(true);
 expect(exported.revision).toBe(1);
 // A recovered fork contains user work and must retain discard/leave-page protection.
 await page.getByRole('button',{name:'Fork draft',exact:true}).click();
 await project(page,'New');
 const protection=page.getByRole('dialog',{name:'Protect unsaved work'});
 await expect(protection).toBeVisible();
 await protection.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByLabel('Night',{exact:true})).toBeChecked();
 const prevented=await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
 expect(prevented).toBe(true);
});


test('autosave cannot start a write while an asynchronous discard confirmation is open',async({page})=>{
 await boot(page);await project(page,'Save As');await expect(notice(page)).toContainText('revision 1');
 await settings(page);await page.getByLabel('Autosave to file').check();await page.keyboard.press('Escape');
 await page.getByLabel('Night',{exact:true}).check();await project(page,'New');
 const protection=page.getByRole('dialog',{name:'Protect unsaved work'});await expect(protection).toBeVisible();await page.waitForTimeout(2200);
 expect(JSON.parse(await read(page,'a.securitylab.json')).revision).toBe(1);
 await protection.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Night',{exact:true})).toBeChecked();
 await project(page,'Save Project');await expect(notice(page)).toContainText('revision 2');expect(JSON.parse(await read(page,'a.securitylab.json')).project.night).toBe(true);
});
