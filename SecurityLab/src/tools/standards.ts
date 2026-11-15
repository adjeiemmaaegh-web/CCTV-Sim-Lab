/**
 * Feature 14: good-practice checklists. These are TRAINING GUIDANCE derived from commonly taught practice;
 * they are not a compliance certificate and cite no clause numbers. The owner/instructor chooses which sets to
 * apply; follow the standard that governs the real site's jurisdiction.
 */
import type {Project,SimResult} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {simulate} from '../engine/simulator.js';
import {pixelsPerMetre,HORIZONTAL_PIXELS} from './lens.js';
import {planFromProject} from './storage.js';
import {panelConfig} from '../engine/alarm.js';

export type RuleStatus='pass'|'warn'|'fail'|'na';
export type RuleResult={id:string;set:SetId;title:string;status:RuleStatus;detail:string};
export type SetId='cctv'|'alarm'|'fire'|'network';
export const RULE_SETS:{id:SetId;title:string}[]=[{id:'cctv',title:'CCTV good practice'},{id:'alarm',title:'Intruder alarm good practice'},{id:'fire',title:'Fire detection good practice (training model)'},{id:'network',title:'Network hygiene'}];
export const DISCLAIMER='Training guidance only. Not a compliance certificate; follow the standard that governs the real installation.';

const kinds=(p:Project,k:string)=>p.devices.filter(d=>profile(d.profileId).kind===k);
const sensors=(p:Project,types:string[])=>kinds(p,'alarm-sensor').filter(d=>types.includes(profile(d.profileId).alarmSensorType||''));
const mk=(set:SetId,id:string,title:string,status:RuleStatus,detail:string):RuleResult=>({id,set,title,status,detail});

function cctvRules(p:Project,r:SimResult):RuleResult[]{
 const cams=kinds(p,'camera'),out:RuleResult[]=[];
 if(!cams.length)return [mk('cctv','cctv-0','Cameras installed','na','No cameras yet')];
 const units=p.unitsPerMeter??10;
 const weak:string[]=[];
 for(const t of p.targets.filter(t=>t.required)){
  const cov=r.coverage.find(c=>c.id===t.id);
  if(!cov?.covered){weak.push(`${t.name} (not covered)`);continue;}
  const best=Math.max(...cov.cameraIds.map(id=>{const c=p.devices.find(d=>d.id===id)!;const m=Math.hypot(c.x-t.x,c.y-t.y)/units;return pixelsPerMetre(HORIZONTAL_PIXELS[c.resolution||'1080p']??1920,c.fov,Math.max(0.5,m));}));
  if(best<125)weak.push(`${t.name} (${best.toFixed(0)} px/m)`);
 }
 out.push(mk('cctv','cctv-1','Entrances reach recognition density (125 px/m)',weak.length?'warn':'pass',weak.length?`Below target: ${weak.join('; ')}`:'All required locations meet 125 px/m'));
 const sw=Object.values(r.poe).filter(x=>x.budgetW>0);
 const hot=sw.filter(x=>x.consumedW/x.budgetW>0.8);
 out.push(mk('cctv','cctv-2','PoE budget keeps 20% headroom',!sw.length?'na':hot.length?'warn':'pass',!sw.length?'No PoE switches':hot.length?`${hot.length} switch(es) above 80% of budget`:'All PoE switches under 80%'));
 const hasUps=kinds(p,'power-ups').length>0;
 out.push(mk('cctv','cctv-3','Recorder protected by a UPS or battery backup',hasUps?'pass':'warn',hasUps?'A UPS is present':'No UPS: recordings can be lost in a power cut'));
 if(kinds(p,'nvr').length+kinds(p,'dvr').length){
  const days=planFromProject(p,30).daysAchievable;
  out.push(mk('cctv','cctv-4','Storage reaches 30 days at the configured recording modes',days>=30?'pass':'warn',Number.isFinite(days)?`About ${days.toFixed(1)} days with a 4x4 TB RAID 5 assumption (see Storage tool)`:'No continuous load'));
 }
 const segregated=cams.some(c=>(c.vlanId??10)!==10)||cams.every(c=>profile(c.profileId).signal==='analog');
 out.push(mk('cctv','cctv-5','Cameras are kept off the default VLAN',segregated?'pass':'warn',segregated?'Camera VLAN separated':'All IP cameras are on VLAN 10 with everything else'));
 return out;
}
function alarmRules(p:Project,r:SimResult):RuleResult[]{
 const panels=kinds(p,'alarm-panel');
 if(!panels.length)return [mk('alarm','al-0','Alarm panel installed','na','No alarm panel yet')];
 const out:RuleResult[]=[];
 const conf=panelConfig(panels[0]);
 out.push(mk('alarm','al-1','Keypad and audible warning device present',kinds(p,'alarm-keypad').length&&kinds(p,'alarm-output').length?'pass':'fail',`${kinds(p,'alarm-keypad').length} keypad(s), ${kinds(p,'alarm-output').length} sounder(s)/siren(s)`));
 out.push(mk('alarm','al-2','Panel PIN changed from the training default',conf.pin==='1234'?'warn':'pass',conf.pin==='1234'?'Default classroom PIN 1234 in use':'Non-default PIN'));
 out.push(mk('alarm','al-3','Entry delay is 45 seconds or less',conf.entryDelaySec<=45?'pass':'warn',`Entry delay ${conf.entryDelaySec}s`));
 out.push(mk('alarm','al-4','Standby battery enabled',conf.batteryEnabled?'pass':'fail',conf.batteryEnabled?'Battery enabled':'Panel has no standby battery'));
 const bypassed=kinds(p,'alarm-sensor').filter(d=>d.alarmDevice?.bypassed).length;
 out.push(mk('alarm','al-5','No sensors left bypassed',bypassed?'warn':'pass',bypassed?`${bypassed} sensor(s) bypassed`:'None bypassed'));
 const open=Object.values(r.alarm?.panels||{}).some(a=>a.faults.length>0);
 out.push(mk('alarm','al-6','No panel faults',open?'warn':'pass',open?'Panel reports faults (see Alarm tab)':'No faults'));
 return out;
}
function fireRules(p:Project,r:SimResult):RuleResult[]{
 const det=sensors(p,['smoke','heat']),cps=sensors(p,['callpoint']),snd=kinds(p,'alarm-output').filter(d=>d.profileId==='alarm-sounder');
 if(!det.length&&!cps.length&&!snd.length)return [mk('fire','fi-0','Fire devices installed','na','No fire devices yet')];
 const out:RuleResult[]=[];
 const uncovered=p.rooms.filter(room=>{
  const pts=[[room.x,room.y],[room.x+room.w,room.y],[room.x,room.y+room.h],[room.x+room.w,room.y+room.h],[room.x+room.w/2,room.y+room.h/2]];
  return !pts.every(([x,y])=>det.some(d=>Math.hypot(d.x-x,d.y-y)<=Math.max(10,d.range||(profile(d.profileId).alarmSensorType==='smoke'?75:53))));
 });
 out.push(mk('fire','fi-1','Every room is within detector coverage radius',!p.rooms.length?'na':uncovered.length?'warn':'pass',!p.rooms.length?'No rooms drawn':uncovered.length?`Not fully covered: ${uncovered.map(x=>x.name).join(', ')}`:'All rooms covered (point-detector radius model)'));
 out.push(mk('fire','fi-2','Sounder installed',snd.length?'pass':'fail',`${snd.length} sounder(s)`));
 out.push(mk('fire','fi-3','Manual call point installed',cps.length?'pass':'warn',`${cps.length} call point(s)`));
 const allZones=[...det,...cps].every(d=>{const st=r.alarm?.devices[d.id],z=st?.panelId?r.alarm?.panels[st.panelId]?.zones.find(x=>x.number===st.zone):undefined;return z?.type==='24h';});
 out.push(mk('fire','fi-4','Fire devices are on 24-hour zones',[...det,...cps].length===0?'na':allZones?'pass':'fail',allZones?'All on 24-hour zones':'Some fire devices would not work while the system is unarmed'));
 const wired=[...det,...cps,...snd].filter(d=>!r.alarm?.devices[d.id]?.wired||!r.alarm?.devices[d.id]?.powered);
 out.push(mk('fire','fi-5','All fire devices wired and powered',wired.length?'fail':'pass',wired.length?`${wired.length} not wired or not powered`:'All wired and powered'));
 return out;
}
function networkRules(p:Project,r:SimResult):RuleResult[]{
 const n=r.network;if(!n)return [mk('network','nw-0','Network present','na','No network data')];
 const faults=Object.entries(n.addresses).filter(([,a])=>a.faults.length);
 const out:RuleResult[]=[mk('network','nw-1','No addressing faults (duplicates, bad masks, lease failures)',faults.length?'fail':'pass',faults.length?`${faults.length} device(s) with faults`:'Clean')];
 const noDns=Object.values(n.addresses).filter(a=>a.source!=='unassigned'&&a.ip&&!a.dns).length;
 out.push(mk('network','nw-2','Devices have a DNS server configured',noDns?'warn':'pass',noDns?`${noDns} device(s) without DNS`:'All configured'));
 const unprotected=p.devices.filter(d=>profile(d.profileId).kind==='router'&&d.routingEnabled!==false&&!(d.routerInterfaces||[]).length);
 out.push(mk('network','nw-3','Routers have defined interfaces',unprotected.length?'warn':'pass',unprotected.length?'A router forwards with no interfaces':'OK'));
 return out;
}
export function reviewProject(p:Project,sets:SetId[]=['cctv','alarm','fire','network'],result:SimResult=simulate(p)):RuleResult[]{
 const out:RuleResult[]=[];
 if(sets.includes('cctv'))out.push(...cctvRules(p,result));
 if(sets.includes('alarm'))out.push(...alarmRules(p,result));
 if(sets.includes('fire'))out.push(...fireRules(p,result));
 if(sets.includes('network'))out.push(...networkRules(p,result));
 return out;
}
export function summarise(rs:RuleResult[]){return {pass:rs.filter(r=>r.status==='pass').length,warn:rs.filter(r=>r.status==='warn').length,fail:rs.filter(r=>r.status==='fail').length,na:rs.filter(r=>r.status==='na').length};}
