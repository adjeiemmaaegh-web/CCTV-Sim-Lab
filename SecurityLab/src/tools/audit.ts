/**
 * Feature 11: audit trail. Every committed change is summarised from the real before/after state (not just the
 * UI's message), stored in the project file, capped and coalesced. Used for replay, time-on-task and shortcut flags.
 */
import type {AuditEntry,Project} from '../domain/types.js';

export const MAX_AUDIT=400;

export function summarizeChange(prev:Project,next:Project):string[]{
 const out:string[]=[];
 const pd=new Map(prev.devices.map(d=>[d.id,d])),nd=new Map(next.devices.map(d=>[d.id,d]));
 const added=next.devices.filter(d=>!pd.has(d.id)),removed=prev.devices.filter(d=>!nd.has(d.id));
 if(added.length)out.push(`added ${added.map(d=>d.name).slice(0,3).join(', ')}${added.length>3?` +${added.length-3}`:''}`);
 if(removed.length)out.push(`removed ${removed.map(d=>d.name).slice(0,3).join(', ')}${removed.length>3?` +${removed.length-3}`:''}`);
 let moved=0,config=0;
 for(const d of next.devices){const o=pd.get(d.id);if(!o)continue;
  if(o.x!==d.x||o.y!==d.y)moved++;
  const a={...o,x:0,y:0,usedGB:0},b={...d,x:0,y:0,usedGB:0};if(JSON.stringify(a)!==JSON.stringify(b))config++;}
 if(moved)out.push(`moved ${moved} device(s)`);
 if(config)out.push(`configured ${config} device(s)`);
 const pc=new Map(prev.cables.map(c=>[c.id,c])),nc=new Map(next.cables.map(c=>[c.id,c]));
 const ca=next.cables.filter(c=>!pc.has(c.id)).length,cr=prev.cables.filter(c=>!nc.has(c.id)).length;
 if(ca)out.push(`added ${ca} cable(s)`);if(cr)out.push(`removed ${cr} cable(s)`);
 if(next.cables.some(c=>{const o=pc.get(c.id);return o&&o.connected!==c.connected;}))out.push('changed cable connection');
 if(prev.night!==next.night)out.push(next.night?'night mode on':'night mode off');
 if(prev.mainsOn!==next.mainsOn)out.push(next.mainsOn?'mains restored':'mains off');
 if(prev.assisted!==next.assisted&&next.assisted)out.push('worked example loaded');
 if(JSON.stringify(prev.environment)!==JSON.stringify(next.environment))out.push('environment changed');
 if(next.diagnosis&&!prev.diagnosis)out.push('generated fault exercise');
 if((next.clips?.length||0)>(prev.clips?.length||0))out.push('recorded motion event');
 if((next.assessments?.length||0)>(prev.assessments?.length||0))out.push('assessment run');
 if((next.accessLog?.length||0)>(prev.accessLog?.length||0))out.push('access event');
 if(next.walls.length!==prev.walls.length||next.rooms.length!==prev.rooms.length)out.push('edited floor plan');
 return out;
}
/** Returns the project with an audit entry appended when something meaningful changed. */
export function recordAudit(prev:Project,next:Project,now=new Date().toISOString()):Project{
 const parts=summarizeChange(prev,next);
 if(!parts.length)return next;
 const summary=parts.join('; '),list=next.audit??prev.audit??[];
 const last=list[list.length-1];
 const entry:AuditEntry={at:now,summary,devices:next.devices.length,cables:next.cables.length};
 // Coalesce rapid repeats of the same summary (e.g. dragging) within 5 seconds.
 const coalesce=last&&last.summary===summary&&Date.parse(now)-Date.parse(last.at)<5000&&/^(moved|configured)/.test(summary);
 const merged=coalesce?[...list.slice(0,-1),{...entry,at:last.at}]:[...list,entry];
 return {...next,audit:merged.slice(-MAX_AUDIT)};
}
export type AuditStats={entries:number;durationMinutes:number;firstDeviceAfterMinutes:number|null;usedWorkedExample:boolean;assessments:number;undoSafe:true;flags:string[]};
export function auditStats(project:Project):AuditStats{
 const a=project.audit||[],flags:string[]=[];
 const t0=a.length?Date.parse(a[0].at):0,t1=a.length?Date.parse(a[a.length-1].at):0;
 const firstDev=a.find(e=>/^added /.test(e.summary)||/; added /.test(e.summary));
 const worked=a.some(e=>/worked example loaded/.test(e.summary));
 if(worked)flags.push('Worked example was loaded: score capped, not an independent attempt');
 if(a.length>=2&&t1-t0<60_000&&project.devices.length>=6)flags.push('Large installation completed in under a minute: check for pasted/loaded work');
 if(a.filter(e=>/assessment run/.test(e.summary)).length>=5)flags.push('Assessment run many times: possible trial and error');
 return {entries:a.length,durationMinutes:a.length?(t1-t0)/60000:0,firstDeviceAfterMinutes:firstDev?(Date.parse(firstDev.at)-t0)/60000:null,usedWorkedExample:worked,assessments:a.filter(e=>/assessment run/.test(e.summary)).length,undoSafe:true,flags};
}
