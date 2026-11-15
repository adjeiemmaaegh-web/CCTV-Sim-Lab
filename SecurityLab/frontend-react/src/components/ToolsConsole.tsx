import React,{useState} from 'react';
import type {Workbench} from '../hooks/useWorkbench.js';
import {CliPanel,TracePanel} from './tools/NetworkTools.js';
import {LessonsPanel,FaultGenPanel,InstructorPanel,AuditPanel,QuotePanel} from './tools/TeachingTools.js';
import {CameraViewPanel,LensPanel,CablePanel,StoragePanel,EnvironmentPanel} from './tools/EngineeringTools.js';

/** Stage 17 tool registry: add new tools here and they appear as sub-tabs. */
export const TOOLS:{id:string;label:string;render:(w:Workbench)=>React.ReactNode}[]=[
 {id:'cli',label:'Network CLI',render:w=><CliPanel w={w}/>},
 {id:'trace',label:'Packet trace',render:w=><TracePanel w={w}/>},
 {id:'view',label:'Camera view',render:w=><CameraViewPanel w={w}/>},
 {id:'lens',label:'Lens calculator',render:w=><LensPanel w={w}/>},
 {id:'cable',label:'Cabling',render:w=><CablePanel w={w}/>},
 {id:'storage',label:'Storage',render:w=><StoragePanel w={w}/>},
 {id:'env',label:'Environment',render:w=><EnvironmentPanel w={w}/>},
 {id:'lessons',label:'Lessons',render:w=><LessonsPanel w={w}/>},
 {id:'faults',label:'Fault exercise',render:w=><FaultGenPanel w={w}/>},
 {id:'quote',label:'Quotation',render:w=><QuotePanel w={w}/>},
 {id:'audit',label:'Audit trail',render:w=><AuditPanel w={w}/>},
 {id:'instructor',label:'Instructor',render:w=><InstructorPanel w={w}/>},
];
export function ToolsConsole({w}:{w:Workbench}){
 const [tool,setTool]=useState(TOOLS[0].id);
 const current=TOOLS.find(t=>t.id===tool)||TOOLS[0];
 return <section className="tools-console" aria-label="Engineering tools">
  <div className="tool-tabs" role="tablist" aria-label="Tools">{TOOLS.map(t=><button key={t.id} role="tab" aria-selected={t.id===current.id} className={t.id===current.id?'active':''} onClick={()=>setTool(t.id)}>{t.label}</button>)}</div>
  <div className="tool-body">{current.render(w)}</div>
 </section>;
}
