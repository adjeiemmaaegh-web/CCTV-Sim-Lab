import React from 'react';
import {t} from '../../../src/i18n/index.js';
import {useLocale} from './Speak.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import {addFloor,floorList,hasFloors,removeFloor,renameFloor,itemsOnFloor} from '../../../src/tools/floors.js';

/** Feature 16: floor selector. Single-floor projects only show an "Add floor" button. */
export function FloorBar({w}:{w:Workbench}){
 useLocale();
 const label=(f:{id:number;name:string})=>f.id===0&&f.name==='Ground floor'?t('floor.ground'):f.name;
 const list=floorList(w.project),multi=hasFloors(w.project);
 const run=(fn:()=>void)=>{try{fn();}catch(e){w.setNotice(String((e as Error).message));}};
 const current=list.find(f=>f.id===w.floor)||list[0];
 return <div className="floor-bar" role="group" aria-label="Floors">
  {multi&&list.map(f=><button key={f.id} className={f.id===current.id?'active':''} aria-pressed={f.id===current.id} onClick={()=>w.setFloor(f.id)}>{label(f)}</button>)}
  <button disabled={w.blocked} onClick={()=>run(()=>{const next=addFloor(w.project);if(w.commit(next,'Floor added; items you draw or place now belong to the selected floor'))w.setFloor(next.floors![next.floors!.length-1].id);})}>{t('floor.add')}</button>
  {multi&&<button disabled={w.blocked} onClick={()=>{const name=window.prompt('Floor name',current.name);if(name!==null)run(()=>{w.commit(renameFloor(w.project,current.id,name));});}}>{t('floor.rename')}</button>}
  {multi&&current.id!==0&&<button disabled={w.blocked} title={`Removable only when empty (${itemsOnFloor(w.project,current.id)} items)`} onClick={()=>run(()=>{const next=removeFloor(w.project,current.id);if(w.commit(next,'Floor removed'))w.setFloor(0);})}>{t('floor.remove')}</button>}
  {multi&&<span className="editor-muted">Walls, coverage and targets apply per floor. Cables between floors add {3} m per floor.</span>}
 </div>;
}
