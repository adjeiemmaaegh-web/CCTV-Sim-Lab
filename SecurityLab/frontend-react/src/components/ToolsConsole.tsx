import React,{useState} from 'react';
import {t,type Key} from '../../../src/i18n/index.js';
import {useLocale} from './Speak.js';
import type {Workbench} from '../hooks/useWorkbench.js';
import {CliPanel,TracePanel} from './tools/NetworkTools.js';
import {LessonsPanel,FaultGenPanel,InstructorPanel,AuditPanel,QuotePanel,ReportPanel} from './tools/TeachingTools.js';
import {StandardsPanel} from './tools/StandardsPanel.js';
import {CameraViewPanel,LensPanel,CablePanel,StoragePanel,EnvironmentPanel,AnprPanel,ScalePanel} from './tools/EngineeringTools.js';

/** Stage 17 tool registry: add new tools here and they appear as sub-tabs. */
export const TOOLS:{id:string;key:Key;render:(w:Workbench)=>React.ReactNode}[]=[
 {id:'cli',key:'tool.cli' as Key,render:w=><CliPanel w={w}/>},
 {id:'trace',key:'tool.trace' as Key,render:w=><TracePanel w={w}/>},
 {id:'view',key:'tool.view' as Key,render:w=><CameraViewPanel w={w}/>},
 {id:'lens',key:'tool.lens' as Key,render:w=><LensPanel w={w}/>},
 {id:'anpr',key:'tool.anpr' as Key,render:w=><AnprPanel w={w}/>},
 {id:'cable',key:'tool.cable' as Key,render:w=><CablePanel w={w}/>},
 {id:'storage',key:'tool.storage' as Key,render:w=><StoragePanel w={w}/>},
 {id:'scale',key:'tool.scale' as Key,render:w=><ScalePanel w={w}/>},
 {id:'env',key:'tool.env' as Key,render:w=><EnvironmentPanel w={w}/>},
 {id:'review',key:'tool.review' as Key,render:w=><StandardsPanel w={w}/>},
 {id:'lessons',key:'tool.lessons' as Key,render:w=><LessonsPanel w={w}/>},
 {id:'faults',key:'tool.faults' as Key,render:w=><FaultGenPanel w={w}/>},
 {id:'quote',key:'tool.quote' as Key,render:w=><QuotePanel w={w}/>},
 {id:'report',key:'tool.report' as Key,render:w=><ReportPanel w={w}/>},
 {id:'audit',key:'tool.audit' as Key,render:w=><AuditPanel w={w}/>},
 {id:'instructor',key:'tool.instructor' as Key,render:w=><InstructorPanel w={w}/>},
];
export function ToolsConsole({w}:{w:Workbench}){
 useLocale();
 const tool=w.toolId,setTool=w.setToolId;
 const current=TOOLS.find(t=>t.id===tool)||TOOLS[0];
 return <section className="tools-console" aria-label="Engineering tools">
  <div className="tool-tabs" role="tablist" aria-label="Tools">{TOOLS.map(tl=><button key={tl.id} role="tab" aria-selected={tl.id===current.id} className={tl.id===current.id?'active':''} onClick={()=>setTool(tl.id)}>{t(tl.key)}</button>)}</div>
  <div className="tool-body">{current.render(w)}</div>
 </section>;
}
