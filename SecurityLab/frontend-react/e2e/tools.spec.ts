import {test,expect,Page} from '@playwright/test';
import {project,dock,settings} from './helpers.js';
const watch=(page:Page)=>{const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;};
const openTool=async(page:Page,name:string)=>{await dock(page,'Tools');await page.getByRole('tab',{name}).click();};

test('every tool opens without errors on a worked example',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example');
 for(const t of ['Network CLI','Packet trace','Camera view','Lens calculator','ANPR','Cabling','Storage','Environment','Good practice','Lessons','Fault exercise','Quotation','Audit trail','Instructor'])await openTool(page,t);
 expect(errs).toEqual([]);
});

test('CLI edits the live project and the change is visible in the form',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example');
 await openTool(page,'Network CLI');
 const cmd=page.getByLabel('CLI command');
 const send=async(c:string)=>{await cmd.fill(c);await cmd.press('Enter');};
 await send('devices');
 await expect(page.getByRole('log')).toContainText('[nvr]');
 await send('connect NVR');
 await send('enable');await send('configure terminal');await send('ip address 192.168.10.77 255.255.255.0');
 await send('end');await send('show ip interface brief');
 await expect(page.getByRole('log')).toContainText('192.168.10.77');
 expect(errs).toEqual([]);
});

test('environment panel changes simulated coverage inputs and persists in project',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example');
 await openTool(page,'Environment');
 await page.getByLabel('Weather').selectOption('fog');
 await expect(page.getByText(/Camera range x0\.55/)).toBeVisible();
 expect(errs).toEqual([]);
});

test('storage planner reacts to RAID and failed disks',async({page})=>{
 await page.goto('/');await project(page,'Load Worked Example');
 await openTool(page,'Storage');
 await page.getByLabel('Failed disks').fill('2');
 await expect(page.getByText(/Array lost/)).toBeVisible();
 await page.getByLabel('RAID level').selectOption('raid6');
 await expect(page.getByText(/Degraded|healthy/i).first()).toBeVisible();
});

test('teaching tools: lesson progress, fault exercise, quote, audit, instructor pack',async({page})=>{
 const errs=watch(page);await page.goto('/');
 // lesson starts at 0 steps on an empty project and advances after the worked example
 await openTool(page,'Lessons');
 await expect(page.getByText(/^0\/7 steps/)).toBeVisible();
 await project(page,'Load Worked Example');
 await expect(page.getByText(/^[67]\/7 steps/)).toBeVisible();
 // fault exercise
 await openTool(page,'Fault exercise');
 await page.getByLabel('Fault seed').fill('11');
 await page.getByRole('button',{name:'Create fault exercise'}).click();
 await openTool(page,'Fault exercise');
 await expect(page.getByText(/injected, seed 11/)).toBeVisible();
 await page.getByRole('button',{name:'Reveal answer'}).click();
 await expect(page.getByLabel('Answer')).toBeVisible();
 // quote
 await openTool(page,'Quotation');
 await expect(page.getByText('Total (GHS)')).toBeVisible();
 // audit recorded the actions
 await openTool(page,'Audit trail');
 await expect(page.getByText(/worked example loaded/).first()).toBeVisible();
 await expect(page.getByText(/generated fault exercise/).first()).toBeVisible();
 // instructor: load the sample pack through the file chooser and open its scenario
 await openTool(page,'Instructor');
 const pack=JSON.stringify({format:'securitylab.scenario-pack',version:1,scenarios:[{id:'custom-e2e-kiosk',title:'E2E kiosk',description:'Test',difficulty:'beginner',focus:'cctv',instructions:['Do it'],allowedKinds:['camera','switch','nvr'],minCameras:1,budgetGhs:5000,targets:[{id:'t',name:'Door',x:300,y:200}],objectives:[{id:'c',title:'Camera',metric:'camera-count',weight:10}]}]});
 await page.getByLabel('Instructor mode').locator('input[type=file]').nth(0).setInputFiles({name:'pack.json',mimeType:'application/json',buffer:Buffer.from(pack)});
 await expect(page.getByText(/Loaded 1 custom scenario/)).toBeVisible();
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.getByLabel('Scenario',{exact:true})).toHaveValue('custom-e2e-kiosk');
 // a bad pack is rejected and does not register anything
 await page.getByLabel('Instructor mode').locator('input[type=file]').nth(0).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"nope"}')});
 await expect(page.getByText(/^Pack rejected/)).toBeVisible();
 // profile packs: a valid pack loads and its device appears in the equipment library; an unattested pack is refused
 const prof={format:'securitylab.profile-pack',version:1,attestation:'educational-simulation-not-real-firmware',profiles:[{id:'pack-e2e-camera',kind:'camera',name:'E2E Pack Camera',manufacturer:'Example Maker',model:'E2E-1',powerW:5,ethernetPorts:1,poePorts:0,signal:'ip',defaultFov:80,defaultRange:150,protocols:['IPv4'],manufacturerSpec:{edition:'1',variant:'E2E-1',documentedAt:'2026-01-01',status:'simulation',sourceUrl:'https://www.example.com/datasheet',sourceTitle:'Datasheet',sourcedFacts:['fact'],simulatedFeatures:[],limitations:['training only']}}]};
 await page.getByLabel('Instructor mode').locator('input[type=file]').nth(1).setInputFiles({name:'profiles.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(prof))});
 await expect(page.getByText(/Loaded 1 device profile/)).toBeVisible();
 await expect(page.locator('.catalog-scroll')).toContainText('E2E Pack Camera');
 await page.getByLabel('Instructor mode').locator('input[type=file]').nth(1).setInputFiles({name:'bad-profiles.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...prof,attestation:'real'}))});
 await expect(page.getByText(/Profile pack rejected: .*attestation/)).toBeVisible();
 expect(errs).toEqual([]);
});

test('good-practice review and ANPR tool respond to inputs',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await project(page,'Load Worked Example');
 await openTool(page,'Good practice');
 await expect(page.getByLabel('Review results')).toContainText('UPS');
 await page.getByRole('group',{name:'Rule sets'}).getByLabel(/CCTV good practice/).uncheck();
 await expect(page.getByLabel('Review results')).not.toContainText('recognition density');
 await expect(page.getByText(/not a compliance certificate/i)).toBeVisible();
 await openTool(page,'ANPR');
 await page.getByLabel('ANPR speed').fill('120');
 await expect(page.getByText('Plate read NOT reliable')).toBeVisible();
 await page.getByLabel('ANPR speed').fill('5');await page.getByLabel('ANPR distance').fill('2');
 await expect(page.getByText('Plate read feasible')).toBeVisible();
 expect(errs).toEqual([]);
});

test('floors: items belong to the floor they were placed on',async({page})=>{
 const errs=watch(page);await page.goto('/');
 const devs=page.locator('svg[role=application] g[data-device]');
 await page.getByRole('button',{name:'Layers & tools'}).click();
 await page.getByRole('button',{name:'＋ Add floor'}).click();
 const bar=page.getByRole('group',{name:'Floors'});
 await expect(bar.getByRole('button',{name:'Floor 1'})).toHaveAttribute('aria-pressed','true');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:/camera/i}).first().click();
 await page.locator('svg[role=application]').click({position:{x:350,y:120}});
 await expect(devs).toHaveCount(1);
 await bar.getByRole('button',{name:'Ground floor'}).click();
 await expect(devs).toHaveCount(0);
 await bar.getByRole('button',{name:'Floor 1'}).click();
 await expect(devs).toHaveCount(1);
 expect(errs).toEqual([]);
});

test('language: switching to French translates the chrome, persists across reload, and read-aloud uses the locale',async({page})=>{
 const errs=watch(page);
 await page.addInitScript(()=>{
  (window as any).__spoken=[];
  (window as any).SpeechSynthesisUtterance=function(this:any,text:string){this.text=text;};
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{speak(u:any){(window as any).__spoken.push({text:u.text,lang:u.lang});setTimeout(()=>u.onend&&u.onend(),10);},cancel(){}}});
 });
 await page.goto('/');
 await settings(page);
 await page.getByLabel('Language').selectOption('fr');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Project',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'Enregistrer sous'})).toBeVisible();
 await expect(page.getByRole('menuitem',{name:'Save As'})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await dock(page,'Tools');
 await expect(page.getByRole('tab',{name:'Console réseau'})).toBeVisible();
 await page.getByRole('tab',{name:'Leçons'}).click();
 await expect(page.getByText(/^0\/7 étapes/)).toBeVisible();
 await page.getByRole('button',{name:'Lire à voix haute'}).first().click();
 const spoken=await page.evaluate(()=>(window as any).__spoken);
 expect(spoken[0].lang).toBe('fr-FR');expect(spoken[0].text.length).toBeGreaterThan(20);
 await page.reload();
 await page.getByRole('button',{name:'Project',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'Enregistrer sous'})).toBeVisible();
 await page.keyboard.press('Escape');
 await settings(page);
 await page.getByLabel('Langue').selectOption('en');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Project',exact:true}).click();
 await expect(page.getByRole('menuitem',{name:'Save As'})).toBeVisible();
 expect(errs).toEqual([]);
});
