/** Feature 2: hop-by-hop explanation of a simulated reachability test (not real packets). */
import type {Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {probeNetwork} from '../engine/networking.js';
import {networkInputs} from './netinputs.js';

export type TraceStep={stage:'power'|'addressing'|'decision'|'forward'|'route'|'result';device?:string;ok:boolean;detail:string};
export function packetTrace(project:Project,fromId:string,toId:string):{ok:boolean;steps:TraceStep[]}{
 const name=(id:string)=>project.devices.find(d=>d.id===id)?.name||id;
 const steps:TraceStep[]=[];
 const finish=(ok:boolean,reason:string)=>{steps.push({stage:'result',ok,detail:(ok?'REACHABLE — ':'FAILED — ')+reason});return {ok,steps};};
 const {result,up,powered}=networkInputs(project);
 const a=result.network?.addresses[fromId],b=result.network?.addresses[toId];
 for(const id of [fromId,toId])steps.push({stage:'power',device:name(id),ok:powered.has(id),detail:powered.has(id)?'Powered':'No power or disabled'});
 if(!powered.has(fromId)||!powered.has(toId))return finish(false,'Source or target has no power');
 for(const [id,addr] of [[fromId,a],[toId,b]] as const){
  const bad=!addr||addr.source==='unassigned'||!addr.ip;
  steps.push({stage:'addressing',device:name(id),ok:!bad&&!(addr?.faults.length),detail:bad?'No valid IP (static invalid or DHCP lease failed)':`${addr!.ip}/${addr!.mask} VLAN ${addr!.vlanId} (${addr!.source})${addr!.faults.length?' · '+addr!.faults.join('; '):''}`});
 }
 if(!a||!b)return finish(false,'Missing address data');
 const trace=probeNetwork(project,up,powered,fromId,toId);
 const same=a.vlanId===b.vlanId&&a.ip.split('.').slice(0,3).join('.')===b.ip.split('.').slice(0,3).join('.');
 steps.push({stage:'decision',device:name(fromId),ok:true,detail:same?'Destination is on the same subnet and VLAN: send directly (layer 2)':`Destination is on another subnet/VLAN: send to default gateway ${a.gateway||'(none)'}`});
 if(trace.ok){
  trace.devices.forEach((id,i)=>{const k=profile(project.devices.find(d=>d.id===id)!.profileId).kind;
   steps.push({stage:k==='router'?'route':'forward',device:name(id),ok:true,detail:i===0?'Originates frame':i===trace.devices.length-1?'Receives frame':k==='router'?'Routes between VLANs':k==='switch'?'Switches frame':'Forwards frame'});});
  return finish(true,trace.reason);
 }
 return finish(false,trace.reason);
}
