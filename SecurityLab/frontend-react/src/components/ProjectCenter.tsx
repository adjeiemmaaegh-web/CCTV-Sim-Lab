import React,{useMemo,useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {simulate} from '../../../src/engine/simulator.js';
import {Modal} from './Dialogs.js';
import {ConnectionGuide} from './ConnectionGuide.js';

export function RequestDialog({w}:{w:Workbench}){
 const request=w.dialog!;const [value,setValue]=useState(request.initial??'');
 const close=(answer:string|null)=>{w.setDialog(null);request.resolve(answer);};
 return <Modal title={request.initial===undefined?'Protect unsaved work':'Edit value'} onClose={()=>close(null)}>
  <p>{request.message}</p>{request.initial!==undefined&&<label>New value<input autoFocus value={value} onChange={e=>setValue(e.target.value)} maxLength={40}/></label>}
  <div className="center-actions"><button onClick={()=>close(null)}>Cancel</button><button disabled={request.initial!==undefined&&!value.trim()} onClick={()=>close(request.initial===undefined?'continue':value)}>{request.initial===undefined?'Discard draft and continue':'Apply value'}</button></div>
 </Modal>;
}
export function ProjectCenter({w,onClose}:{w:Workbench;onClose:()=>void}){
 const run=(fn:()=>unknown)=>{try{Promise.resolve(fn()).catch(e=>w.setNotice(String(e)));}catch(e){w.setNotice(String(e));}};
 return <Modal title="Project Center" onClose={onClose}>
  <h3>{w.project.title}</h3><dl className="project-facts"><dt>Project file</dt><dd>{w.fileName}</dd><dt>Save verification</dt><dd><span role="status">{w.saveState==='saved'&&!w.hasUnsavedWork()?`Verified write and read-back · revision ${w.revision}`:w.saveState==='saving'?'Writing file…':w.saveState==='blocked'?'Save blocked — recover your draft below':'Current draft has no verified file save'}</span></dd><dt>Simulation</dt><dd>{w.result.issues.length} modeled issues · assessment {w.assessment.score}/100. Release acceptance requires separate verified checks.</dd></dl>
  <p>Keep a project JSON file before closing. A requested download is not a verified save. Checkpoints embedded in a verified project file can be reopened. Unsaved session edits and replay frames are lost when you close the app.</p>
  <div className="center-actions"><button disabled={w.saveState==='saving'} onClick={()=>run(()=>w.saveCurrent(false))}>Save and verify</button><button disabled={w.saveState==='saving'} onClick={()=>run(()=>w.saveCurrent(true))}>Save As separate file</button><button onClick={w.jsonExport}>Download backup</button><button onClick={()=>{w.openList();onClose();}}>Review checkpoints</button></div>
  <label className="checkfield">Autosave to selected file<input type="checkbox" checked={w.autosave} disabled={!w.hasWritableHandle||w.blocked} onChange={e=>w.setAutosave(e.target.checked)}/></label>
  {w.saveError&&<section role="alert"><h3>Recover the draft</h3><p>{w.saveError}</p><p>Download a backup or Save As before choosing which version to keep. Reload discards this draft after confirmation.</p><div className="center-actions"><button onClick={()=>run(w.retrySave)}>Retry verification</button><button onClick={()=>{w.fork();}}>Fork draft</button><button disabled={!w.hasWritableHandle} onClick={()=>{onClose();run(w.reload);}}>Reload file…</button></div></section>}
 </Modal>;
}
export function ConnectionPreview({w}:{w:Workbench}){
 const pending=w.pendingCable!;
 const project=useMemo(()=>({...pending.baseline,cables:[...pending.baseline.cables,pending.cable]}),[pending]);
 const result=useMemo(()=>simulate(project),[project]);
 const preview={...w,project,result,blocked:true};
 const status=result.cables[pending.cable.id];
 return <Modal title="Review proposed connection" onClose={()=>w.setPendingCable(null)}>
  <p>No cable has been installed. Review the modeled interfaces and configuration warnings first. A training connection with faults can be installed for troubleshooting.</p>
  <p>Estimated run: <strong>{pending.cable.lengthMeters} m</strong> · {status?.up?'Link checks pass':'Configuration needs attention'}</p>
  <svg viewBox="0 0 500 85" role="img" aria-label="Proposed topology route" style={{width:'100%',height:85}}><line x1="75" y1="32" x2="425" y2="32" stroke={status?.up?'#5cddbf':'#ffa176'} strokeWidth="4" strokeDasharray="8 5"/><circle cx="75" cy="32" r="20" fill="#284f68"/><circle cx="425" cy="32" r="20" fill="#284f68"/><text x="75" y="38" textAnchor="middle" fill="#fff">A</text><text x="425" y="38" textAnchor="middle" fill="#fff">B</text><text x="250" y="70" textAnchor="middle" fill="#d8eaf2">{pending.cable.medium} · {pending.cable.lengthMeters} m · P{pending.cable.aPort??'auto'} ↔ P{pending.cable.bPort??'auto'}</text></svg>
  <ConnectionGuide w={preview} cable={pending.cable}/>
  <div className="center-actions"><button onClick={()=>w.setPendingCable(null)}>Cancel connection</button><button disabled={w.blocked} onClick={w.confirmCable}>Install reviewed connection</button></div>
 </Modal>;
}
