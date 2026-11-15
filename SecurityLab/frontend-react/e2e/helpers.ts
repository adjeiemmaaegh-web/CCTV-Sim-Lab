import type {Page} from '@playwright/test';

/** Open the top-bar Project menu and choose an item (New, Open JSON, Save Project, Save As, Load Worked Example, ...). */
export async function project(page:Page,name:string,tap=false){
 const open=page.getByRole('button',{name:'Project',exact:true});
 await (tap?open.tap():open.click());
 const item=page.getByRole('menuitem',{name});
 await (tap?item.tap():item.click());
}
const PRIMARY=['Realtime','Events','Diagnostics','Power','Access','Console','Tools'];
/** Select a bottom-dock tab; secondary tabs live under More. */
export async function dock(page:Page,name:string,tap=false){
 const act=async(l:ReturnType<Page['locator']>)=>{await (tap?l.tap():l.click());};
 if(PRIMARY.includes(name)){await act(page.locator('.dock-tabs').getByRole('tab').filter({hasText:name}).first());return;}
 await act(page.locator('.dock-more > button'));
 await act(page.getByRole('menuitem',{name,exact:true}));
}
export const settings=async(page:Page)=>{await page.getByRole('button',{name:'Settings',exact:true}).click();};
