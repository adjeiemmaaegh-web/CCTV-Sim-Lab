import type {Mode,Workbench} from '../hooks/useWorkbench.js';
export type Activity='design'|'connect'|'simulate'|'troubleshoot'|'assess';
export const ACTIVITIES:{id:Activity;label:string;icon:string;tab:Workbench['tab'];view:'floor'|'topology';tools:Mode[];tabs:Workbench['tab'][]}[]=[
 {id:'design',label:'Design',icon:'floorplan',tab:'scenario',view:'floor',tools:['select','pan','room','wall','door','window','measure'],tabs:['scenario','systems','tools']},
 {id:'connect',label:'Connect',icon:'network',tab:'network',view:'topology',tools:['select','pan','cable','measure'],tabs:['network','power','tools']},
 {id:'simulate',label:'Simulate',icon:'play',tab:'systems',view:'floor',tools:['select','pan','test'],tabs:['systems','events','recordings','alarm','access','power']},
 {id:'troubleshoot',label:'Troubleshoot',icon:'diagnostics',tab:'diagnostics',view:'topology',tools:['select','pan','cable'],tabs:['diagnostics','network','power','tools','events']},
 {id:'assess',label:'Assess',icon:'assessment',tab:'assessment',view:'floor',tools:['select','pan','measure'],tabs:['assessment','scenario','field-review']},
];
export const activityFor=(tab:Workbench['tab']):Activity=>ACTIVITIES.find(a=>a.tab===tab)?.id??(tab==='assessment'||tab==='field-review'?'assess':tab==='events'||tab==='recordings'||tab==='alarm'||tab==='access'?'simulate':'connect');
