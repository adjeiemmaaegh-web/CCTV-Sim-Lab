import React,{useEffect,useRef,useState} from 'react';
import type {Workbench} from '../../hooks/useWorkbench.js';
import {initialCliState,prompt,runCommand,type CliState} from '../../../../src/tools/cli.js';
import {packetTrace,type TraceStep} from '../../../../src/tools/packetTrace.js';
import {profile} from '../../../../src/domain/catalog.js';

/** Feature 1: educational network CLI. Edits the real project through the same engine the forms use. */
export function CliPanel({w}:{w:Workbench}){
 const [state,setState]=useState<CliState>(initialCliState());
 const [lines,setLines]=useState<string[]>(['SecurityLab educational CLI (subset, not Cisco IOS). Type "help".']);
 const [input,setInput]=useState('');const [history,setHistory]=useState<string[]>([]);const [hi,setHi]=useState(-1);
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView?.({block:'nearest'});},[lines]);
 const submit=()=>{
  const line=input;setInput('');setHi(-1);if(!line.trim())return;
  const p=prompt(w.project,state);
  let r;try{r=runCommand(w.project,state,line);}catch(e){setLines(l=>[...l,`${p} ${line}`,`% Internal error: ${String(e)}`]);return;}
  if(r.project!==w.project){if(!w.commit(r.project,'Network CLI change applied')){setLines(l=>[...l,`${p} ${line}`,'% Change rejected: editing is paused.']);return;}}
  setState(r.state);setHistory(h=>[...h.slice(-49),line]);setLines(l=>[...l.slice(-300),`${p} ${line}`,...r.output]);
 };
 return <section className="tool-panel" aria-label="Network command line">
  <div className="cli-screen" tabIndex={0} role="log" aria-label="CLI output">{lines.map((l,i)=><div key={i}>{l}</div>)}<div ref={end}/></div>
  <form className="cli-input" onSubmit={e=>{e.preventDefault();submit();}}>
   <label><span className="cli-prompt">{prompt(w.project,state)}</span><input aria-label="CLI command" value={input} autoComplete="off" spellCheck={false} disabled={w.blocked}
    onChange={e=>setInput(e.currentTarget.value)}
    onKeyDown={e=>{if(e.key==='ArrowUp'&&history.length){e.preventDefault();const n=Math.min(history.length-1,hi+1);setHi(n);setInput(history[history.length-1-n]);}
     if(e.key==='ArrowDown'){e.preventDefault();const n=hi-1;setHi(n);setInput(n<0?'':history[history.length-1-n]);}}}/></label>
   <button type="submit" disabled={w.blocked}>Run</button>
  </form>
 </section>;
}

/** Feature 2: hop-by-hop explanation of a simulated reachability test. */
export function TracePanel({w}:{w:Workbench}){
 const hosts=w.project.devices.filter(d=>!/^(alarm|access|power)-/.test(profile(d.profileId).kind)&&profile(d.profileId).kind!=='switch'&&profile(d.profileId).signal!=='analog');
 const [from,setFrom]=useState('');const [to,setTo]=useState('');const [steps,setSteps]=useState<TraceStep[]|null>(null);
 const run=()=>{const a=from||hosts[0]?.id,b=to||hosts[1]?.id;if(!a||!b||a===b){w.setNotice('Choose two different network devices');return;}setSteps(packetTrace(w.project,a,b).steps);};
 return <section className="tool-panel" aria-label="Packet trace">
  <div className="tool-row"><label>From <select aria-label="Trace source" value={from} onChange={e=>setFrom(e.currentTarget.value)}><option value="">Choose…</option>{hosts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <label>To <select aria-label="Trace destination" value={to} onChange={e=>setTo(e.currentTarget.value)}><option value="">Choose…</option>{hosts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
   <button onClick={run}>Trace</button></div>
  <p className="editor-muted">Explains the simulation's decision hop by hop. These are not real packets.</p>
  {steps&&<ol className="trace-steps" aria-label="Trace steps">{steps.map((s,i)=><li key={i} className={s.ok?'good':'warning-line'}><b>{s.stage.toUpperCase()}</b>{s.device?` · ${s.device}`:''} — {s.detail}</li>)}</ol>}
 </section>;
}
