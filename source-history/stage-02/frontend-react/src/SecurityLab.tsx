import React,{useEffect,useRef} from 'react';
import {setupOffline} from './offline.js';
import {useWorkbench} from './hooks/useWorkbench.js';
import {TopBar} from './components/TopBar.js';
import {Catalog} from './components/Catalog.js';
import {Canvas} from './components/Canvas.js';
import {Inspector} from './components/Inspector.js';
import {Console} from './components/Console.js';
export function SecurityLab(){
 const w=useWorkbench();const imageFile=useRef<HTMLInputElement>(null);
 const currentWorkbench=useRef(w);currentWorkbench.current=w;
 useEffect(()=>setupOffline(async()=>{
  const active=currentWorkbench.current;
  if(!active.loaded||active.blocked)return false;
  try{await active.flush();return true;}catch(e){active.setNotice(`Unable to update safely: ${String(e)}`);return false;}
 }),[]);
 useEffect(()=>{const check=(e:BeforeUnloadEvent)=>{const current=currentWorkbench.current;if(!current.loaded||current.saveState!=='saved'){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',check);return()=>window.removeEventListener('beforeunload',check);},[]);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{const t=e.target as HTMLElement;if(t?.closest('input,textarea,select'))return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)w.redo();else w.undo();}
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='y'){e.preventDefault();w.redo();}
  if(e.key==='Delete'&&!w.blocked)w.removeSelection();};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[w]);
 const handle=(task:()=>void|Promise<void>)=>{Promise.resolve().then(task).catch(e=>w.setNotice(`Operation failed: ${String(e)}`));};
 return <main className="workstation"><TopBar w={w}/><div className="main-grid"><Catalog w={w}/><Canvas w={w}/><Inspector w={w}/></div>
 <Console w={w}/><footer className="status-footer"><span>SECURITYLAB ENGINE v0.2 · REACT FRONTEND CANDIDATE</span><span className={`save ${w.saveState}`}>{w.saveState==='saved'?`✓ Saved revision ${w.revision}`:w.saveState==='saving'?'◌ Saving':w.saveState==='blocked'?'⚠ Save blocked':'◌ Unsaved edits'}</span><div className="undo-controls"><button onClick={w.undo} disabled={!w.canUndo||w.blocked}>↶ Undo</button><button onClick={w.redo} disabled={!w.canRedo||w.blocked}>↷ Redo</button><button onClick={()=>handle(w.workedExample)} disabled={w.blocked}>Load Worked Example</button><button disabled={w.blocked} onClick={()=>imageFile.current?.click()}>Floor-plan image</button><input hidden type="file" ref={imageFile} accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.currentTarget.files?.[0];if(file)handle(()=>w.imageImport(file));e.currentTarget.value='';}}/></div><span>LOCAL ONLY • SIMULATED DEVICES</span></footer>
 {!w.loaded&&<div role="status" className="loading-banner">Restoring local project and verifying saved revision…</div>}
 {w.notice&&<div className="toast" role="status">{w.notice}<button aria-label="Dismiss notification" onClick={()=>w.setNotice('')}>×</button></div>}
 {w.saveError&&<div role="alert" className="error-banner"><strong>Save protection: </strong>{w.saveError}<div><button onClick={w.jsonExport}>Export draft</button><button onClick={()=>handle(w.retrySave)}>Retry</button><button onClick={w.fork}>Fork as new project</button><button onClick={()=>handle(w.reload)}>Reload saved</button></div></div>}
 {w.listOpen&&<div className="modal-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-label="Open saved projects" className="modal"><div className="modal-header"><h2>Open local project</h2><div><button onClick={()=>handle(w.newBlank)}>New project</button><button onClick={()=>w.setListOpen(false)}>Close</button></div></div>{w.savedList.length?w.savedList.map(p=><div key={p.id} className="saved-project"><span><strong>{p.title}</strong><small>{p.updatedAt}</small></span><div><button onClick={()=>handle(()=>w.openSaved(p.id))}>Open</button><button onClick={()=>handle(()=>w.showBackups(p.id))}>Backups</button><button onClick={()=>{if(confirm(`Delete saved project ${p.title}?`))handle(()=>w.deleteSaved(p.id));}}>Delete</button></div></div>):<p>No saved projects yet.</p>}{w.backupProjectId&&<div className="backups-list"><h3>Revision backups</h3>{w.backups.length?w.backups.map(b=><div key={b.key} className="saved-project"><span>Revision {b.revision} · {b.at}</span><button onClick={()=>handle(()=>w.restoreBackup(b.key))}>Restore as new project</button></div>):<p>No previous revisions saved.</p>}</div>}</section></div>}
 </main>;
}
