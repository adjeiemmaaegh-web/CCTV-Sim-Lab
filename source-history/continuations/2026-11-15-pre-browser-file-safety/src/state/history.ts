import type {Project,Device,Cable,Room,Wall} from '../domain/types.js';
import {validateProject} from '../persistence/validation.js';

/** Commands are semantic, reversible state transitions; the engine stays framework-free. */
export type ProjectCommand =
 | {type:'replace'; project:Project}
 | {type:'move-device'; id:string; x:number; y:number}
 | {type:'update-device'; id:string; values:Partial<Device>}
 | {type:'remove-device'; id:string}
 | {type:'add-device'; device:Device}
 | {type:'add-cable'; cable:Cable}
 | {type:'remove-cable'; id:string}
 | {type:'add-wall'; wall:Wall}
 | {type:'add-room'; room:Room}
 | {type:'remove-wall'; id:string}
 | {type:'remove-room'; id:string}
 | {type:'set-night'; value:boolean}
 | {type:'set-mains'; value:boolean};

function apply(p:Project,cmd:ProjectCommand):Project{
 switch(cmd.type){
  case 'replace':return cmd.project;
  case 'move-device':return {...p,devices:p.devices.map(d=>d.id===cmd.id?{...d,x:cmd.x,y:cmd.y}:d)};
  case 'update-device':return {...p,devices:p.devices.map(d=>d.id===cmd.id?{...d,...cmd.values,id:d.id}:d)};
  case 'remove-device':return {...p,devices:p.devices.filter(d=>d.id!==cmd.id),cables:p.cables.filter(c=>c.a!==cmd.id&&c.b!==cmd.id)};
  case 'add-device':return {...p,devices:[...p.devices,cmd.device]};
  case 'add-cable':return {...p,cables:[...p.cables,cmd.cable]};
  case 'remove-cable':return {...p,cables:p.cables.filter(c=>c.id!==cmd.id)};
  case 'add-wall':return {...p,walls:[...p.walls,cmd.wall]};
  case 'add-room':return {...p,rooms:[...p.rooms,cmd.room]};
  case 'remove-wall':return {...p,walls:p.walls.filter(w=>w.id!==cmd.id)};
  case 'remove-room':return {...p,rooms:p.rooms.filter(r=>r.id!==cmd.id)};
  case 'set-night':return {...p,night:cmd.value};
  case 'set-mains':return {...p,mainsOn:cmd.value};
 }
}
export class ProjectHistory {
 private present:Project;
 private past:Project[]=[];
 private future:Project[]=[];
 constructor(initial:Project,private readonly limit=60){this.present=validateProject(initial);}
 get snapshot():Project{return structuredClone(this.present);}
 get canUndo():boolean{return this.past.length>0;}
 get canRedo():boolean{return this.future.length>0;}
 get undoCount():number{return this.past.length;}
 reset(p:Project):Project{this.present=validateProject(p);this.past=[];this.future=[];return this.snapshot;}
 dispatch(cmd:ProjectCommand):Project{
  const next=validateProject({...apply(this.present,cmd),updatedAt:new Date().toISOString()});
  if(JSON.stringify(next)===JSON.stringify(this.present))return this.snapshot;
  this.past.push(this.present);if(this.past.length>this.limit)this.past.shift();
  this.present=next;this.future=[];return this.snapshot;
 }
 undo():Project|undefined{
  const previous=this.past.pop();if(!previous)return;
  this.future.push(this.present);this.present=validateProject({...previous,updatedAt:new Date().toISOString()});return this.snapshot;
 }
 redo():Project|undefined{
  const next=this.future.pop();if(!next)return;
  this.past.push(this.present);this.present=validateProject({...next,updatedAt:new Date().toISOString()});return this.snapshot;
 }
}
