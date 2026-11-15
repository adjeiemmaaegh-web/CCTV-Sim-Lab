import React,{useEffect,useRef} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';

/** Keyboard-contained dialog; returning focus to the opener prevents losing place after closing. */
export function CheckpointDialog({w}:{w:Workbench}){
 const dialog=useRef<HTMLElement>(null);
 const close=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  close.current?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();w.setListOpen(false);return;}
   if(event.key!=='Tab'||!dialog.current)return;
   const enabled=Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])'));
   if(!enabled.length)return;
   const first=enabled[0],last=enabled[enabled.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);previous?.focus();};
 // Bind on mount: setListOpen is the React state setter and remains stable.
 },[w.setListOpen]);
 return <div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)w.setListOpen(false);}}>
  <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="checkpoint-title" aria-describedby="checkpoint-description" className="modal">
   <div className="modal-header"><h2 id="checkpoint-title">Embedded project checkpoints</h2><div>
    <button onClick={w.jsonExport}>Export independent backup</button>
    <button ref={close} onClick={()=>w.setListOpen(false)}>Close checkpoints</button>
   </div></div>
   <p id="checkpoint-description">Checkpoints belong to the currently opened project JSON file. They are not stored in a database. Save your project file to retain new revisions.</p>
   {w.backups.length?w.backups.map((b,i)=><div key={`${b.revision}-${i}`} className="saved-project">
    <span>Revision {b.revision} · {b.at}</span>
    <button onClick={()=>{try{w.restoreBackup(i);}catch(error){w.setNotice(`Checkpoint recovery failed: ${String(error)}`);}}}>Restore as new unsaved project</button>
   </div>):<p>No older checkpoints in this file. Create another verified save to preserve a previous revision.</p>}
  </section>
 </div>;
}
