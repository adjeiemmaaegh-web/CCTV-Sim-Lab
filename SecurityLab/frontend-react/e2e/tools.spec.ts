import {test,expect,Page} from '@playwright/test';
const watch=(page:Page)=>{const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;};
const openTool=async(page:Page,name:string)=>{await page.getByRole('button',{name:'Tools',exact:true}).first().click();await page.getByRole('tab',{name}).click();};

test('every tool opens without errors on a worked example',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
 for(const t of ['Network CLI','Packet trace','Camera view','Lens calculator','ANPR','Cabling','Storage','Environment','Good practice','Lessons','Fault exercise','Quotation','Audit trail','Instructor'])await openTool(page,t);
 expect(errs).toEqual([]);
});

test('CLI edits the live project and the change is visible in the form',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
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
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
 await openTool(page,'Environment');
 await page.getByLabel('Weather').selectOption('fog');
 await expect(page.getByText(/Camera range x0\.55/)).toBeVisible();
 expect(errs).toEqual([]);
});

test('storage planner reacts to RAID and failed disks',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Load Worked Example/i}).click();
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
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
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
 await page.locator('input[type=file]').nth(2).setInputFiles({name:'pack.json',mimeType:'application/json',buffer:Buffer.from(pack)});
 await expect(page.getByText(/Loaded 1 custom scenario/)).toBeVisible();
 await page.getByRole('button',{name:'Open',exact:true}).click();
 await expect(page.getByLabel('Scenario',{exact:true})).toHaveValue('custom-e2e-kiosk');
 // a bad pack is rejected and does not register anything
 await page.locator('input[type=file]').nth(2).setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"nope"}')});
 await expect(page.getByText(/Pack rejected/)).toBeVisible();
 expect(errs).toEqual([]);
});

test('good-practice review and ANPR tool respond to inputs',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
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
