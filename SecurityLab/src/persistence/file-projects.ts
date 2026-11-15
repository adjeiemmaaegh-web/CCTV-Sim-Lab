import type {Project} from '../domain/types.js';
import {validateProject} from './validation.js';
import {sha256} from './sha256.js';

/**
 * Stage 12, no account/database/cloud: a SecurityLab project is a user-owned JSON file.
 * File System Access API is optional; unsupported browsers use explicit downloads.
 * No persistent file handle, browser data store or user project state is created.
 * 'Saved' is only returned after a verified write/readback to a user-picked file.
 */
export const MAX_FILE_BYTES=16_000_000;
/** Kept for legacy imports; the actual limit is measured in UTF-8 bytes. */
export const MAX_FILE_CHARS=MAX_FILE_BYTES;
export const MAX_BACKUPS=8;
export type Checkpoint={revision:number;at:string;project:Project};
export type OpenedProject={project:Project;revision:number;checkpoints:Checkpoint[];name:string};
export type SaveOutcome={verified:boolean;revision:number;name:string;reason?:string};
export class FileConflictError extends Error {
 constructor(message='The selected project file changed outside this editor. Save As a different file or reopen the newer copy.'){
  super(message);this.name='FileConflictError';
 }
}

/** Fast accidental-corruption indicator, NOT a signature or anti-tamper mechanism. */
export function fingerprint(text:string):string{
 let h=0x811c9dc5;
 for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,0x01000193);}
 return `fnv32:${(h>>>0).toString(16).padStart(8,'0')}`;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const utf8Size=(s:string)=>new Blob([s]).size;
const validAt=(s:unknown):s is string=>typeof s==='string'&&s.length<60&&Number.isFinite(Date.parse(s));
function parseCheckpoint(x:unknown):Checkpoint{
 if(!object(x)||!Number.isSafeInteger(x.revision)||Number(x.revision)<1||!validAt(x.at))throw new Error('Invalid file revision checkpoint');
 return {revision:Number(x.revision),at:x.at,project:validateProject(x.project)};
}
function payload(project:Project,revision:number,at:string,checkpoints:Checkpoint[],fileVersion:1|2=2){
 return {format:'securitylab.project-file',fileVersion,revision,savedAt:at,project,checkpoints};
}
/** Version 1 used a legacy 32-bit checksum; version 2 upgrades new saves to SHA-256. */
const checksumFor=(body:ReturnType<typeof payload>)=>body.fileVersion===1?fingerprint(JSON.stringify(body)):`sha256:${sha256(JSON.stringify(body))}`;
export function parseProjectText(text:string,name='SecurityLab project'):OpenedProject{
 if(text.length>MAX_FILE_BYTES||utf8Size(text)>MAX_FILE_BYTES)throw new Error('Project exceeds the 16 MB UTF-8 import limit');
 let parsed:unknown;
 try{parsed=JSON.parse(text);}catch{throw new Error('Invalid JSON file');}
 if(!object(parsed))throw new Error('Not a SecurityLab project document');
 if(parsed.format==='securitylab.project-file'){
  if((parsed.fileVersion!==1&&parsed.fileVersion!==2)||!Number.isSafeInteger(parsed.revision)||Number(parsed.revision)<1||
   !validAt(parsed.savedAt)||typeof parsed.checksum!=='string')throw new Error('Unsupported or damaged project file');
  if(!Array.isArray(parsed.checkpoints)||parsed.checkpoints.length>MAX_BACKUPS)throw new Error('Invalid backup history');
  const checkpoints=parsed.checkpoints.map(parseCheckpoint);
  const revision=Number(parsed.revision);
  if(checkpoints.some(c=>c.revision>=revision)||new Set(checkpoints.map(c=>c.revision)).size!==checkpoints.length)throw new Error('Invalid backup revision sequence');
  const project=validateProject(parsed.project);
  const expected=checksumFor(payload(project,revision,parsed.savedAt,checkpoints,parsed.fileVersion as 1|2));
  if(parsed.checksum!==expected)throw new Error('Project checksum mismatch. Do not overwrite this file; try a separate backup.');
  return {project,revision,checkpoints,name};
 }
 // Backward compatible raw Stage 1–11 JSON exports. Opening never alters the source file.
 if('schemaVersion' in parsed)return {project:validateProject(parsed),revision:0,checkpoints:[],name};
 throw new Error('This is not a SecurityLab project export');
}
export function serializeProject(projectInput:Project,revision:number,checkpoints:Checkpoint[]=[]):string{
 const project=validateProject(projectInput);
 if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Invalid file revision');
 const at=new Date().toISOString();
 let retained=checkpoints.slice(-MAX_BACKUPS).map(c=>({revision:c.revision,at:c.at,project:validateProject(c.project)}));
 for(;;){
  const body=payload(project,revision,at,retained);
  const full=JSON.stringify({...body,checksum:checksumFor(body)},null,2);
  if(full.length<=MAX_FILE_BYTES&&utf8Size(full)<=MAX_FILE_BYTES)return full;
  if(retained.length===0)throw new Error('Project too large to save as a SecurityLab file');
  retained=retained.slice(1);
 }
}
export function suggestedFilename(project:Project):string{
 const cleaned=(project.title||'SecurityLab').replace(/[^\p{L}\p{N}._ -]/gu,'').trim().replace(/^[. ]+|[. ]+$/g,'').slice(0,64);
 const title=!cleaned||/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(cleaned)?'SecurityLab':cleaned;
 return `${title}.securitylab.json`;
}
export function downloadText(text:string,filename:string,mime='application/json;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([text],{type:mime}));
 const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
 // This confirms only that a browser download was requested, never that bytes reached disk.
 setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
export function downloadStandalone(project:Project,filename=suggestedFilename(project)){
 downloadText(serializeProject(project,1),filename);
}
export type NativeFileHandle={name:string;getFile():Promise<File>;
 createWritable():Promise<{write(data:string):Promise<void>;close():Promise<void>;abort?():Promise<void>}>;
 queryPermission?(options?:{mode:'readwrite'}):Promise<PermissionState>;
 requestPermission?(options?:{mode:'readwrite'}):Promise<PermissionState>;
};
type FilePickerWindow=Window&{
 showOpenFilePicker?:(options?:unknown)=>Promise<NativeFileHandle[]>;
 showSaveFilePicker?:(options?:unknown)=>Promise<NativeFileHandle>;
};
const pickerOptions={types:[{description:'SecurityLab JSON project',accept:{'application/json':['.json']}}],excludeAcceptAllOption:false};
const picker=()=>window as FilePickerWindow;
export const canOpenNativeFile=()=>typeof picker().showOpenFilePicker==='function';
export const canSaveNativeFile=()=>typeof picker().showSaveFilePicker==='function';
async function readHandle(handle:NativeFileHandle):Promise<string>{
 const file=await handle.getFile();if(file.size>MAX_FILE_BYTES)throw new Error('File exceeds the 16 MB SecurityLab limit');return file.text();
}
export class ProjectFileSession{
 private handle:NativeFileHandle|null=null;
 private originalText:string|null=null;
 private lastSaved:Project|null=null;
 private latestRevision=0;
 private checkpoints:Checkpoint[]=[];
 private fileName='';
 get hasWritableHandle(){return this.handle!==null;}
 get name(){return this.fileName||'Unsaved project';}
 get revision(){return this.latestRevision;}
 get backups():Checkpoint[]{return structuredClone(this.checkpoints);}
 get savedProject(){return this.lastSaved?structuredClone(this.lastSaved):null;}
 detach(){this.handle=null;this.originalText=null;this.lastSaved=null;this.latestRevision=0;this.checkpoints=[];this.fileName='';}
 private ingest(text:string,name:string,handle:NativeFileHandle|null):OpenedProject{
  const parsed=parseProjectText(text,name);
  this.handle=handle;this.originalText=handle?text:null;
  this.lastSaved=parsed.project;this.latestRevision=parsed.revision;this.checkpoints=parsed.checkpoints;this.fileName=name;
  return parsed;
 }
 async openFile(file:File):Promise<OpenedProject>{
  if(file.size>MAX_FILE_BYTES)throw new Error('Project file exceeds 16 MB');
  const text=await file.text();
  return this.ingest(text,file.name,null);
 }
 async openNative():Promise<OpenedProject>{
  if(!canOpenNativeFile())throw new Error('Native file picker unavailable; use Import/Open JSON instead.');
  const handles=await picker().showOpenFilePicker!({...pickerOptions,multiple:false});
  if(!handles.length)throw new Error('No project file selected');
  const handle=handles[0],text=await readHandle(handle);
  return this.ingest(text,handle.name,handle);
 }
 /** Compare before write; this is NOT an atomic filesystem lock across processes. */
 private async writeToHandle(handle:NativeFileHandle,project:Project,forceNew:boolean):Promise<SaveOutcome>{
  // Save As must never silently replace a different existing project. A user
  // can save changes to an already-open project using ordinary Save, where
  // the content is compared against the last confirmed revision.
  const textBefore=await readHandle(handle);
  if(forceNew&&textBefore.length>0)throw new FileConflictError('Save As selected a nonempty file. Choose a new filename; existing project files cannot be overwritten through Save As.');
  if(!forceNew&&this.originalText===null)throw new FileConflictError('Original file content unavailable. Use Save As.');
  // Compare the actual file bytes represented as text; a 32-bit hash collision must never permit overwrites.
  if(!forceNew&&textBefore!==this.originalText)throw new FileConflictError();
  const nextRevision=forceNew?1:this.latestRevision+1;
  const history=forceNew?[]:[...this.checkpoints];
  if(!forceNew&&this.lastSaved){history.push({revision:Math.max(1,this.latestRevision),at:new Date().toISOString(),project:this.lastSaved});}
  const trimmed=history.filter((c,i,a)=>a.findIndex(x=>x.revision===c.revision)===i&&c.revision<nextRevision).slice(-MAX_BACKUPS);
  const content=serializeProject(project,nextRevision,trimmed);
  const writable=await handle.createWritable();
  try{await writable.write(content);await writable.close();}catch(error){try{await writable.abort?.();}catch{}throw error;}
  const after=await readHandle(handle);
  if(after!==content)throw new Error('Save readback mismatch: export a separate copy before continuing.');
  const confirmed=parseProjectText(after,handle.name);
  this.handle=handle;this.originalText=after;this.lastSaved=confirmed.project;
  this.latestRevision=confirmed.revision;this.checkpoints=confirmed.checkpoints;this.fileName=handle.name;
  return {verified:true,revision:confirmed.revision,name:handle.name};
 }
 async save(project:Project,saveAs=false,interactive=true):Promise<SaveOutcome>{
  const validated=validateProject(project);
  if(saveAs||!this.handle){
   if(!interactive)throw new Error('Choose a project file manually before enabling autosave');
   if(canSaveNativeFile()){
    const handle=await picker().showSaveFilePicker!({...pickerOptions,suggestedName:suggestedFilename(validated)});
    return this.writeToHandle(handle,validated,true);
   }
   downloadStandalone(validated);
   return {verified:false,revision:this.latestRevision,name:suggestedFilename(validated),reason:'Download initiated. Browser cannot confirm that the file was saved.'};
  }
  if(!interactive){
   const state=await this.handle.queryPermission?.({mode:'readwrite'});
   if(state!=='granted')throw new Error('File write permission is not available; use Save Project.');
  }else{
   const state=await this.handle.queryPermission?.({mode:'readwrite'});
   if(state==='denied')throw new Error('File write permission denied; use Save As.');
   if(state==='prompt'){
    if(await this.handle.requestPermission?.({mode:'readwrite'})!=='granted')throw new Error('File write permission not granted');
   }
  }
  return this.writeToHandle(this.handle,validated,false);
 }
 async reload(isCurrent:()=>boolean=()=>true):Promise<OpenedProject>{
  if(!this.handle)throw new Error('No file handle. Reopen the JSON project through Open.');
  const handle=this.handle;
  const text=await readHandle(handle);
  // Parsing and caller-session checks happen before changing active file tracking.
  const parsed=parseProjectText(text,handle.name);
  if(this.handle!==handle||!isCurrent())throw new FileConflictError('The working project changed while reloading. Your newer edits were not discarded.');
  return this.ingest(text,handle.name,handle);
 }
 downloadBackup(project:Project){downloadStandalone(project,`${suggestedFilename(project).replace(/\.json$/,'')}.backup.json`);}
}
