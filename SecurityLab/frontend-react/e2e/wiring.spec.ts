import {test,expect} from '@playwright/test';

/** End-to-end workbench checks; all interfaces and PoE outputs are virtual. */
test('cabling two devices opens safe per-port setup with simulated link evidence',async({page})=>{
 await page.goto('/');
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'IP Bullet • 2MP'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:310,y:180}});
 await page.getByRole('button',{name:/Network Devices/}).click();
 await page.locator('.catalog-scroll button.equipment').filter({hasText:'4-Port PoE+ Switch'}).first().click();
 await page.locator('svg[role=application]').click({position:{x:490,y:240}});
 await page.getByRole('button',{name:'Cable',exact:true}).click();
 const devices=page.locator('svg[role=application] g[data-device]');
 await devices.first().click();await devices.nth(1).click();
 await expect(page.locator('svg[role=application] g[data-cable]')).toHaveCount(1);
 const setup=page.getByRole('region',{name:'Connection setup'});
 await expect(setup).toBeVisible();
 await expect(setup.getByText('CONNECTION SETUP · VIRTUAL ETHERNET')).toBeVisible();
 await expect(setup.getByLabel('End A port')).toHaveValue('1');
 await expect(setup.getByLabel('End B port')).toHaveValue('1');
 await expect(setup).toContainText('Port and power eligibility are checked separately');
 await expect(setup).toContainText('training models');
 await setup.getByLabel('End B port').selectOption('2');
 await expect(setup.getByLabel('End B port')).toHaveValue('2');
 await page.getByRole('button',{name:'Undo',exact:true}).click();
 await expect(setup.getByLabel('End B port')).toHaveValue('1');
});

test('occupied switch ports are nonselectable in connection inspector',async({page})=>{
 await page.goto('/');
 const place=async(name:string,pos:{x:number;y:number})=>{
  await page.locator('.catalog-scroll button.equipment').filter({hasText:name}).first().click();
  await page.locator('svg[role=application]').click({position:pos});
 };
 await place('IP Bullet • 2MP',{x:280,y:160});
 await place('IP Dome • 4MP',{x:390,y:160});
 await page.getByRole('button',{name:/Network Devices/}).click();
 await place('4-Port PoE+ Switch',{x:480,y:280});
 const devs=page.locator('svg[role=application] g[data-device]');
 await page.getByRole('button',{name:'Cable',exact:true}).click();
 await devs.nth(0).click();await devs.nth(2).click();
 await devs.nth(1).click();await devs.nth(2).click();
 const setup=page.getByRole('region',{name:'Connection setup'});
 await expect(setup.getByLabel('End B port')).toHaveValue('2');
 await expect(setup.getByLabel('End B port').locator('option[value="1"]')).toHaveAttribute('disabled','');
 await expect(setup.getByLabel('End B port')).toContainText('PoE out');
});
