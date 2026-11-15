import {profile} from '../domain/catalog.js';
import type {Project,SimResult} from '../domain/types.js';

export type DiagnosticArea='cable'|'power'|'ip'|'recording'|'coverage'|'alarm'|'access'|'other';
export type GuidedFinding={
 id:string;area:DiagnosticArea;severity:'critical'|'warning'|'info';
 title:string;evidence:string;nextStep:string;
 entity?:{kind:'device'|'cable';id:string};
 route:'diagnostics'|'network'|'recordings'|'power'|'alarm'|'access'|'scenario';
};
const format=(s:string)=>s.length>220?s.slice(0,217)+'...':s;
const remedy=(reason:string):{area:DiagnosticArea;next:string;route:GuidedFinding['route'];critical:boolean}=>{
 if(/disconnected|no usable ethernet cable|no usable coax/i.test(reason))return {area:'cable',next:'Open the affected virtual cable. Check both endpoints, set Connected, and confirm the simulated cable is within its modeled length limit.',route:'diagnostics',critical:true};
 if(/PoE|power|unpowered|battery|voltage|breaker|solar/i.test(reason))return {area:'power',next:'Inspect the power source, modeled output rating, selected PoE socket, shared power budget and device enabled state.',route:'power',critical:true};
 if(/port|assigned to multiple|unavailable interface/i.test(reason))return {area:'cable',next:'Select an unused port at each end of the Ethernet connection. For cameras, check whether the chosen switch port supplies modeled PoE.',route:'diagnostics',critical:true};

 if(/duplicate|IPv4 address|DHCP|subnet|gateway|routing|no forwarding path|lease/i.test(reason))return {area:'ip',next:'Check unique IP addresses, subnet masks, VLANs, DHCP pool and return path using the simulated network settings.',route:'network',critical:true};
 if(/VLAN|trunk|access mismatch/i.test(reason))return {area:'ip',next:'Inspect both switch port VLAN settings. Access ports must agree; trunk/native VLANs must carry the modeled traffic.',route:'network',critical:true};

 if(/NVR|DVR|recorder|recording|storage|channels|bandwidth|disk/i.test(reason))return {area:'recording',next:'Check recorder availability, channel capacity, storage health and the simulated camera-to-recorder network path.',route:'recordings',critical:true};
 if(/alarm|zone|siren|tamper|panel|detector/i.test(reason))return {area:'alarm',next:'Inspect the virtual panel, zone assignment, device circuit and source power in the alarm console.',route:'alarm',critical:false};
 if(/access|reader|lock|door|credential/i.test(reason))return {area:'access',next:'Inspect controller wiring, authorization rules, reader state and the virtual door in Access.',route:'access',critical:false};
 if(/length|range|coverage|orientation/i.test(reason))return {area:'coverage',next:'Check the simulated run length, camera orientation, field of view, obstructions and target coverage.',route:'scenario',critical:false};
 return {area:'other',next:'Select the affected virtual element and compare its configuration with current diagnostics. The evidence is simulated, not measured on hardware.',route:'diagnostics',critical:false};
};

/**
 * A grounded, deterministic troubleshooting queue. All items originate from
 * the current simulation result; no speculative theft, compliance or hardware
 * diagnoses are generated. Updates are recalculated as the project changes.
 */
export function guidedDiagnostics(project:Project,result:SimResult):GuidedFinding[]{
 if(project.devices.length===0)return [{id:'start',area:'other',severity:'info',title:'No equipment installed',evidence:'The project has no placed virtual devices.',
  nextStep:'Start by choosing equipment from the library and placing it on the floor plan.',route:'scenario'}];
 const findings:GuidedFinding[]=[],seen=new Set<string>();
 const add=(item:GuidedFinding)=>{if(!seen.has(item.id)){seen.add(item.id);findings.push(item);}};
 for(const cable of project.cables){
  const state=result.cables[cable.id];if(!state||state.up)continue;
  const a=project.devices.find(d=>d.id===cable.a),b=project.devices.find(d=>d.id===cable.b);
  const evidence=state.reason||'No successful virtual link';
  const m=remedy(evidence);
  add({id:'cable:'+cable.id,area:m.area==='other'?'cable':m.area,severity:m.critical?'critical':'warning',
   title:(a?.name||'Unknown device')+' ↔ '+(b?.name||'Unknown device'),
   evidence:format(evidence),nextStep:m.next,entity:{kind:'cable',id:cable.id},route:m.route});
 }
 for(const device of project.devices){
  const state=result.devices[device.id],address=result.network?.addresses[device.id],faults=[...(state?.faults||[]),...(address?.faults||[])];
  const unique=[...new Set(faults)];if(!unique.length)continue;
  // Prioritize a directly actionable physical or IP fault rather than repeating
  // every dependent offline status as a separate diagnostic card.
  unique.sort((a,b)=>{
   const priority=(v:string)=>/Duplicate|PoE|unusable|disconnected|Invalid|DHCP|VLAN/i.test(v)?0:/recorder|channel|storage/i.test(v)?1:2;
   return priority(a)-priority(b);
  });
  const reason=unique[0],m=remedy(reason);
  add({id:'device:'+device.id,area:m.area,severity:m.critical?'critical':'warning',
   title:device.name+' · '+profile(device.profileId).kind,
   evidence:format(reason+(unique.length>1?' · '+(unique.length-1)+' additional modeled issue(s)':'')),
   nextStep:m.next,entity:{kind:'device',id:device.id},route:m.route});
 }
 const uncovered=result.coverage.filter(x=>!x.covered);
 if(uncovered.length)add({id:'coverage:targets',area:'coverage',severity:'warning',
  title:uncovered.length+' target(s) not covered',evidence:format(uncovered.map(x=>x.name).join(', ')),
  nextStep:'Select a camera and review its coverage polygon, virtual orientation and range. Inspect line-of-sight blocking walls and the required scenario targets.',
  route:'scenario'});
 for(const [area,issues,route] of [
  ['alarm',result.alarm?.issues||[],'alarm'],
  ['access',result.access?.issues||[],'access'],
  ['power',result.power?.issues||[],'power']
 ] as const){
  for(const issue of issues.slice(0,5)){
   const m=remedy(issue);
   add({id:area+':'+issue,area,severity:m.critical?'critical':'warning',title:area.toUpperCase()+' · Virtual system check',
    evidence:format(issue),nextStep:m.next,route});
  }
 }
 if(!findings.length&&project.devices.length===0)return [{
  id:'start',area:'other',severity:'info',title:'No equipment installed',evidence:'The project has no placed virtual devices.',
  nextStep:'Start by choosing equipment from the library and placing it on the floor plan.',
  route:'scenario'
 }];
 return findings.sort((a,b)=>({critical:0,warning:1,info:2}[a.severity])-({critical:0,warning:1,info:2}[b.severity])).slice(0,24);
}
