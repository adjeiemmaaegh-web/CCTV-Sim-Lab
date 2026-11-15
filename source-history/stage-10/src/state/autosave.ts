import type {Project} from '../domain/types.js';
import {ConflictError} from '../persistence/projects.js';
export type SaveState='saved'|'saving'|'unsaved'|'blocked';
export type SaveStatus={id:string;state:SaveState;revision:number;message:string};
export type SaveWriter=(project:Project,expectedRevision:number,writerId:string)=>Promise<number>;
/** One in-flight write per coordinator; coalesces bursts without losing newest edits. */
export class AutoSaveCoordinator{
 private pending=new Map<string,Project>();
 private revisions=new Map<string,number>();
 private errors=new Map<string,Error>();
 private statuses=new Map<string,SaveStatus>();
 private work:Promise<void>|undefined;
 private subscribers=new Set<(status:SaveStatus)=>void>();
 constructor(private write:SaveWriter,readonly writerId:string){ }
 subscribe(fn:(status:SaveStatus)=>void):()=>void{this.subscribers.add(fn);return()=>this.subscribers.delete(fn);}
 private emit(id:string,state:SaveState,message=''){
  const status={id,state,revision:this.revisions.get(id)??0,message};this.statuses.set(id,status);
  for(const fn of this.subscribers)fn(status);
 }
 trackLoaded(id:string,revision:number){if(!Number.isSafeInteger(revision)||revision<0)throw new Error('Invalid loaded revision');this.revisions.set(id,revision);this.errors.delete(id);this.emit(id,'saved');}
 getStatus(id:string):SaveStatus{return this.statuses.get(id)??{id,state:'unsaved',revision:this.revisions.get(id)??0,message:'Not saved'};}
 queue(input:Project):void{
  const id=input.id;
  if(this.errors.has(id))throw this.errors.get(id)!;
  this.pending.set(id,structuredClone(input));this.emit(id,'unsaved','Changes pending save');
  if(!this.work){this.work=Promise.resolve().then(()=>this.drain()).finally(()=>{this.work=undefined;if(this.pending.size)this.start();});}
 }
 private start(){if(!this.work)this.work=Promise.resolve().then(()=>this.drain()).finally(()=>{this.work=undefined;if(this.pending.size)this.start();});}
 private async drain():Promise<void>{
  while(this.pending.size){
   const first=this.pending.entries().next().value as [string,Project];
   const [id,snapshot]=first;this.pending.delete(id);this.emit(id,'saving','Saving locally…');
   try{
    const revision=await this.write(snapshot,this.revisions.get(id)??0,this.writerId);
    this.revisions.set(id,revision);
    if(this.pending.has(id))this.emit(id,'unsaved','More edits pending save');
    else this.emit(id,'saved',`Saved revision ${revision}`);
   }catch(e){
    const error=e instanceof Error?e:new Error(String(e));
    this.errors.set(id,error);
    this.pending.delete(id);
    this.emit(id,'blocked',error instanceof ConflictError?error.message:`Local save failed: ${error.message}. Export your project before leaving.`);
   }
  }
 }
 async flush(id:string):Promise<void>{
  if(this.work)await this.work;
  const error=this.errors.get(id);if(error)throw error;
  if(this.pending.has(id)){this.start();if(this.work)await this.work;}
  const status=this.getStatus(id);
  if(status.state!=='saved')throw new Error(`Project not safely persisted (${status.state})`);
 }
 retry(project:Project):void{this.errors.delete(project.id);this.queue(project);}
 isBlocked(id:string):boolean{return this.errors.has(id);}
 /** Used only for explicit discard/reload after warning; never overwrites a conflicting revision. */
 resetProject(id:string,revision:number){this.pending.delete(id);this.trackLoaded(id,revision);}
}
