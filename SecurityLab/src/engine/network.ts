import type {Cable,Device} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
export function ipv4(ip:string):number|undefined {
 if(!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip))return undefined;
 const n=ip.split('.').map(Number);if(n.some(x=>x<0||x>255))return undefined;
 return (((n[0]*256+n[1])*256+n[2])*256+n[3])>>>0;
}
export function validMask(mask:string):boolean {
 const n=ipv4(mask);if(n===undefined||n===0)return false;
 const inv=(~n)>>>0;return (inv&(inv+1))===0;
}
export function sameSubnet(a:Device,b:Device):boolean {
 const x=ipv4(a.ip),y=ipv4(b.ip),maskA=ipv4(a.mask),maskB=ipv4(b.mask);
 return x!==undefined&&y!==undefined&&maskA!==undefined&&maskB!==undefined&&validMask(a.mask)&&validMask(b.mask)&&maskA===maskB&&((x&maskA)>>>0)===((y&maskA)>>>0);
}
export function duplicateIPs(devices:Device[],powered:Set<string>):Set<string>{
 const byIp=new Map<string,string[]>();for(const d of devices){if(!powered.has(d.id)||profile(d.profileId).kind==='switch'||ipv4(d.ip)===undefined)continue;
  const key=String(ipv4(d.ip));byIp.set(key,[...(byIp.get(key)||[]),d.id]);}
 const conflicts=new Set<string>();for(const ids of byIp.values())if(ids.length>1)ids.forEach(id=>conflicts.add(id));return conflicts;
}
export function activeCableGraph(devices:Device[],cables:Cable[],powered:Set<string>,badCables:Set<string>):Map<string,string[]> {
 const graph=new Map(devices.map(d=>[d.id,[] as string[]]));
 for(const c of cables){if(badCables.has(c.id)||!powered.has(c.a)||!powered.has(c.b))continue;
  if(!graph.has(c.a)||!graph.has(c.b))continue;
  graph.get(c.a)!.push(c.b);graph.get(c.b)!.push(c.a);
 }return graph;
}
export function pathThroughSwitches(fromId:string,toId:string,graph:Map<string,string[]>,devices:Device[]):boolean {
 const byId=new Map(devices.map(d=>[d.id,d]));const seen=new Set([fromId]),pending=[fromId];
 while(pending.length){const current=pending.shift()!;if(current===toId)return true;
  if(current!==fromId&&profile(byId.get(current)!.profileId).kind!=='switch')continue;
  for(const n of graph.get(current)||[])if(!seen.has(n)){seen.add(n);pending.push(n);}
 }return false;
}
