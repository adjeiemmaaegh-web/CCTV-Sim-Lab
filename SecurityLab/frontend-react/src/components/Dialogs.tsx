import React,{useEffect,useRef} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {LOCALES,t} from '../../../src/i18n/index.js';
import {LanguageSelect,useLocale} from './Speak.js';
import {Icon} from './icons.js';

function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const prev=document.activeElement as HTMLElement|null;ref.current?.focus();
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();onClose();}
   if(e.key==='Tab'&&ref.current){const f=[...ref.current.querySelectorAll<HTMLElement>('button,select,input,a[href]')].filter(x=>!x.hasAttribute('disabled'));if(!f.length)return;const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}};
  document.addEventListener('keydown',key,true);return()=>{document.removeEventListener('keydown',key,true);prev?.focus?.();};
 },[onClose]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
   <header><h2>{title}</h2><button aria-label="Close" onClick={onClose}><Icon name="close" size={18}/></button></header>
   <div className="modal-body">{children}</div>
  </div></div>;
}

export function SettingsDialog({w,onClose}:{w:Workbench;onClose:()=>void}){
 useLocale();
 return <Modal title="Settings" onClose={onClose}>
  <section><h3>Language</h3><LanguageSelect locales={Object.entries(LOCALES).map(([id,l])=>({id,name:l.name}))}/>
   <p className="editor-muted">Main screens are translated. French needs native-speaker review; other panels are English only.</p></section>
  <section><h3>Saving</h3>
   <label className="checkfield" title="Available only after you have chosen a project file with write access"><span>Autosave to file</span><input type="checkbox" checked={w.autosave} disabled={!w.hasWritableHandle||w.blocked} onChange={e=>w.setAutosave(e.currentTarget.checked)}/></label>
   <p className="editor-muted">Projects are portable JSON files. Nothing is stored on a server; there are no accounts. The only thing kept in this browser is your language choice.</p>
  </section>
  <section><h3>About</h3><p>SecurityLab 0.17 — educational simulation only.</p><p className="editor-muted">Manufacturer profiles are simulated or based on documented references. Not real device firmware, and no manufacturer certification is implied.</p></section>
 </Modal>;
}
export function HelpDialog({onClose}:{onClose:()=>void}){
 return <Modal title="Help" onClose={onClose}>
  <section><h3>Quick start</h3><ol><li>Pick a scenario in the top bar and read the briefing (Scenarios).</li><li>Choose a device in the Equipment Library, then click the floor plan to place it. Use the Cable tool to connect devices.</li><li>Check Realtime and Diagnostics at the bottom. Fix what is red.</li><li>Press Assess Installation. Save with Project &gt; Save As.</li></ol></section>
  <section><h3>Project file safety</h3><p>Keep only one writer for each physical project file. SecurityLab coordinates saves between cooperating windows on the same site and browser profile, but cannot lock another browser, website, desktop editor or OS process.</p><p>If a save is blocked or a project changed externally, use Project &gt; Export Backup first, check that the downloaded draft opens correctly, then reopen the disk file or Save As a new filename. Do not blindly retry an overwrite.</p></section>
  <section><h3>Keyboard</h3><ul><li><kbd>Ctrl</kbd>+<kbd>S</kbd> save, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> save as</li><li><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Ctrl</kbd>+<kbd>Y</kbd> redo</li><li>Arrow keys move the selected item (<kbd>Shift</kbd> = 10 units), <kbd>Delete</kbd> removes it, <kbd>Esc</kbd> cancels</li><li><kbd>+</kbd> / <kbd>-</kbd> zoom; <kbd>0</kbd> fits the plan. Hold <kbd>Space</kbd> and drag or choose Pan to move the view.</li><li>Under Layers &amp; tools, Navigate elements selects a device, room or wall without a pointer. Press Enter on a focused device to select it or finish a cable.</li></ul></section>
  <section><h3>Where things are</h3><ul><li>Project menu: New, Open, Save, Save As, Export, Checkpoints, Import, Undo/Redo, Worked Example, floor-plan image.</li><li>On phones, use the fixed Plan, Devices, Properties and Simulation navigation to jump between engineering panels. Zoom buttons stay available on the canvas.</li><li>Dock tabs: Realtime, Events, Diagnostics, Power, Access, Console (network CLI), Tools, plus More.</li><li>Tools: lenses, cabling, storage, lessons, quotation, reports, instructor mode and more.</li></ul></section>
  <p className="editor-muted">{t('speak.read')}: use the speaker button on lesson steps. Full documentation is in the repository docs folder.</p>
 </Modal>;
}
