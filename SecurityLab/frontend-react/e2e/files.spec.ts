import {test,expect,Page} from '@playwright/test';
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
 await page.getByRole('button',{name:'Save As'}).click();
 await expect(notice(page)).toContainText('Saved and read back from a.securitylab.json (revision 1)');
 let doc=JSON.parse(await read(page,'a.securitylab.json'));
 expect(doc.revision).toBe(1);expect(doc.checksum).toMatch(/^sha256:/);
 await page.getByLabel('Night').check();
 await page.getByRole('button',{name:'Save Project'}).click();
 await expect(notice(page)).toContainText('(revision 2)');
 doc=JSON.parse(await read(page,'a.securitylab.json'));
 expect(doc.revision).toBe(2);expect(doc.project.night).toBe(true);expect(doc.checkpoints.length).toBe(1);
});

test('Save As refuses a nonempty existing file and leaves its bytes unchanged',async({page})=>{
 await boot(page);
 await page.getByRole('button',{name:'Save As'}).click();
 await expect(notice(page)).toContainText('revision 1');
 const before=await read(page,'a.securitylab.json');
 await page.getByLabel('Night').check();
 await page.getByRole('button',{name:'Save As'}).click(); // picker returns same, nonempty file
 await expect(notice(page)).toContainText(/nonempty file|cannot be overwritten/i);
 expect(await read(page,'a.securitylab.json')).toBe(before);
});

test('external modification is detected; app does not overwrite newer data',async({page})=>{
 await boot(page);
 await page.getByRole('button',{name:'Save As'}).click();
 await expect(notice(page)).toContainText('revision 1');
 const external=(await read(page,'a.securitylab.json'))+'\n';
 await write(page,'a.securitylab.json',external);
 await page.getByLabel('Night').check();
 await page.getByRole('button',{name:'Save Project'}).click();
 await expect(notice(page)).toContainText(/changed|conflict|external/i);
 expect(await read(page,'a.securitylab.json')).toBe(external);
});

test('Open JSON through native picker reloads a saved project and keeps revision',async({page})=>{
 await boot(page);
 await page.getByLabel('Scenario',{exact:true}).selectOption('shop3');
 await page.getByRole('button',{name:'Save As'}).click();
 await expect(notice(page)).toContainText('revision 1');
 await page.getByLabel('Scenario',{exact:true}).selectOption('home8');
 await page.getByRole('button',{name:'Open JSON'}).click();
 await expect(page.getByLabel('Scenario',{exact:true})).toHaveValue('shop3');
 await expect(page.locator('footer')).toContainText('revision 1');
});

test('corrupted file on disk is rejected on open',async({page})=>{
 await boot(page);
 await page.getByRole('button',{name:'Save As'}).click();
 await expect(notice(page)).toContainText('revision 1');
 const doc=JSON.parse(await read(page,'a.securitylab.json'));doc.project.title='tampered';
 await write(page,'b.securitylab.json',JSON.stringify(doc));await setNext(page,'b.securitylab.json');
 await page.getByRole('button',{name:'Open JSON'}).click();
 await expect(notice(page)).toContainText(/checksum/i);
});
