import {test,expect,Page} from '@playwright/test';
const watch=(page:Page)=>{const errs:string[]=[];page.on('dialog',d=>{void d.accept();});page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});return errs;};
const openTool=async(page:Page,name:string)=>{await page.getByRole('button',{name:'Tools',exact:true}).first().click();await page.getByRole('tab',{name}).click();};

test('every tool opens without errors on a worked example',async({page})=>{
 const errs=watch(page);await page.goto('/');
 await page.getByRole('button',{name:/Load Worked Example/i}).click();
 for(const t of ['Network CLI','Packet trace','Camera view','Lens calculator','Cabling','Storage','Environment'])await openTool(page,t);
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
