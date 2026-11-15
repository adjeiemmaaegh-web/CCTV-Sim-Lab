/**
 * Stage 5 — deterministic, offline IP/L2/L3 training model.
 * This is an educational abstraction (no packets, STP, ARP, NAT, RF propagation,
 * switch firmware, real wireless cryptography, or vendor protocol emulation).
 * A simulation result is derived only from project config + powered/live links.
 */
import type {Device,DhcpPool,NetworkAddress,NetworkLinkStatus,NetworkSnapshot,NetworkTrace,PortConfig,Project,RouterInterface} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {ipv4,validMask} from './network.js';

const VLAN_MIN=1,VLAN_MAX=4094;
const vlanOK=(v:number)=>Number.isSafeInteger(v)&&v>=VLAN_MIN&&v<=VLAN_MAX;
const selectedVlan=(d:Device)=>d.vlanId??10;
const ipString=(i:number)=>[24,16,8,0].map(s=>(i>>>s)&255).join('.');
const onSubnet=(ip:string,base:string,mask:string)=>{
 const a=ipv4(ip),b=ipv4(base),m=ipv4(mask);return a!==undefined&&b!==undefined&&m!==undefined&&validMask(mask)&&((a&m)>>>0)===((b&m)>>>0);
};
const portOf=(device:Device,port:number):PortConfig=>{
 const p=profile(device.profileId),override=p.managed?device.portConfigs?.find(x=>x.number===port):undefined;
 if(override)return override;
 if(p.kind==='router')return {number:port,mode:'trunk',accessVlan:10,nativeVlan:10,allowedVlans:(device.routerInterfaces||[]).map(i=>i.vlanId),speedMbps:p.portSpeedMbps||1000};
 const v=p.kind==='ap'?(device.wireless?.vlanId??selectedVlan(device)):p.kind==='switch'?10:selectedVlan(device);
 return {number:port,mode:'access',accessVlan:v,nativeVlan:v,allowedVlans:[v],speedMbps:p.portSpeedMbps||1000};
};
const vlansOnLink=(a:PortConfig,b:PortConfig)=>{
 const candidates=a.mode==='access'?[a.accessVlan]:a.allowedVlans;
 return candidates.filter(v=>vlanOK(v)&&(b.mode==='access'?b.accessVlan===v:b.allowedVlans.includes(v))&&
  (a.mode==='access'||b.mode==='access'?a.mode==='trunk'?a.nativeVlan===v:b.mode==='trunk'?b.nativeVlan===v:true:true));
};
type Edge={id:string;a:string;b:string;vlan:number};
export type NetworkEvaluation={snapshot:NetworkSnapshot;trace:(from:string,to:string)=>NetworkTrace;reserve:(path:NetworkTrace,mbps:number)=>boolean;resolve:(clientId:string,hostname:string)=>{ok:boolean;ip?:string;reason:string}};

export function evaluateNetwork(project:Project,upCables:Set<string>,powered:Set<string>):NetworkEvaluation {
 const devices=project.devices.filter(d=>!profile(d.profileId).kind.startsWith('alarm-')&&!profile(d.profileId).kind.startsWith('access-')&&!profile(d.profileId).kind.startsWith('power-')),byId=new Map(devices.map(d=>[d.id,d]));
 const links:Record<string,NetworkLinkStatus>={},wireless:NetworkSnapshot['wireless']={},addresses:NetworkSnapshot['addresses']={},dhcpLeases:Record<string,string>={},diagnostics:string[]=[];
 const edges:Edge[]=[];
 const portUsed=new Map<string,Set<number>>();
 const uses=(id:string)=>{if(!portUsed.has(id))portUsed.set(id,new Set());return portUsed.get(id)!;};
 const cables=[...project.cables].filter(c=>(c.medium??'ethernet')==='ethernet'&&upCables.has(c.id)).sort((a,b)=>a.id.localeCompare(b.id));
 for(const c of cables){
  const a=byId.get(c.a),b=byId.get(c.b);if(!a||!b)continue;
  const pa=profile(a.profileId),pb=profile(b.profileId),usedA=uses(a.id),usedB=uses(b.id);
  const nextPort=(d:Device,used:Set<number>,configured?:number)=>configured??Array.from({length:profile(d.profileId).ethernetPorts},(_,i)=>i+1).find(i=>!used.has(i))??0;
  const ap=nextPort(a,usedA,c.aPort),bp=nextPort(b,usedB,c.bPort);
  const faults:string[]=[];
  if(!ap||!bp||ap>pa.ethernetPorts||bp>pb.ethernetPorts||ap<1||bp<1)faults.push('Ethernet port out of range or unavailable');
  if(usedA.has(ap)||usedB.has(bp))faults.push('Ethernet port assigned to multiple cables');
  const left=portOf(a,ap),right=portOf(b,bp);
  const vlans=vlansOnLink(left,right);
  if(!vlans.length)faults.push('VLAN access/trunk mismatch');
  const speed=Math.min(c.speedMbps??1000,left.speedMbps,right.speedMbps,pa.portSpeedMbps||1000,pb.portSpeedMbps||1000);
  if(!Number.isFinite(speed)||speed<=0)faults.push('Invalid link speed');
  links[c.id]={id:c.id,a:a.id,b:b.id,aPort:ap,bPort:bp,vlans,capacityMbps:Math.max(0,speed),usedMbps:0,faults};
  if(faults.length){diagnostics.push(`${a.name} ↔ ${b.name}: ${faults.join('; ')}`);continue;}
  usedA.add(ap);usedB.add(bp);
  vlans.forEach(vlan=>edges.push({id:c.id,a:a.id,b:b.id,vlan}));
 }
 // Wireless is a modelled local L2 segment; an AP needs its own wired uplink for upstream communication.
 const aps=devices.filter(d=>profile(d.profileId).kind==='ap'&&powered.has(d.id)&&d.wireless).sort((a,b)=>a.id.localeCompare(b.id));
 const clients=new Map<string,number>();
 for(const cam of devices.filter(d=>profile(d.profileId).wirelessCapable&&d.wifiEnabled!==false).sort((a,b)=>a.id.localeCompare(b.id))){
  let reason='No powered matching wireless access point',chosen:Device|undefined;
  const ssid=cam.wifiSsid||'SecurityLab';
  for(const ap of aps){
   const radio=ap.wireless!,range=radio.rangeUnits,meters=Math.hypot(cam.x-ap.x,cam.y-ap.y);
   if(ssid!==radio.ssid)continue;
   if((cam.wifiKey||'')!==radio.key){reason='Wireless passphrase mismatch';continue;}
   if(meters>range){reason='Wireless client outside configured range';continue;}
   if((clients.get(ap.id)||0)>=radio.maxClients){reason='Access point association limit reached';continue;}
   chosen=ap;break;
  }
  const radio=chosen?.wireless,dist=chosen?Math.hypot(cam.x-chosen.x,cam.y-chosen.y):0;
  const signal=radio?Math.max(5,Math.round(100*(1-dist/Math.max(1,radio.rangeUnits)))):0;
  wireless[cam.id]={clientId:cam.id,apId:chosen?.id,ssid,connected:!!chosen&&powered.has(cam.id),reason:chosen?'Associated (simulated RF; no actual radio frames)':reason,signalPercent:signal,bandwidthMbps:radio?Math.max(1,radio.bandwidthMbps*signal/100):0};
  if(!chosen||!radio||!powered.has(cam.id)){if(powered.has(cam.id))diagnostics.push(`${cam.name}: ${reason}`);continue;}
  clients.set(chosen.id,(clients.get(chosen.id)||0)+1);
  const id=`radio:${cam.id}:${chosen.id}`;
  links[id]={id,a:cam.id,b:chosen.id,aPort:0,bPort:0,vlans:[radio.vlanId],capacityMbps:wireless[cam.id].bandwidthMbps,usedMbps:0,faults:[]};
  edges.push({id,a:cam.id,b:chosen.id,vlan:radio.vlanId});
 }
 const l2=(a:string,b:string,vlan:number):NetworkTrace=>{
  if(a===b)return {ok:true,reason:'Same network device',devices:[a],links:[]};
  const visited=new Set([a]),queue:[string,string[],string[]][]=[[a,[a],[]]];
  while(queue.length){const [id,route,through]=queue.shift()!;
   for(const e of edges){if(e.vlan!==vlan)continue;
    const neighbour=e.a===id?e.b:e.b===id?e.a:null;
    if(!neighbour||visited.has(neighbour))continue;
    // A client/recorder/server/AP cannot forward Ethernet. AP bridges wireless to its uplink.
    const kind=profile(byId.get(id)!.profileId).kind;
    if(id!==a&&!['switch','ap'].includes(kind))continue;
    // Routers do not bridge separate L2 networks: this walk never changes VLAN.
    const nextRoute=[...route,neighbour],nextLinks=[...through,e.id];
    if(neighbour===b)return {ok:true,reason:`VLAN ${vlan} connected`,devices:nextRoute,links:nextLinks};
    visited.add(neighbour);queue.push([neighbour,nextRoute,nextLinks]);
   }
  }
  return {ok:false,reason:`No forwarding path on VLAN ${vlan}`,devices:[],links:[]};
 };
 const validPool=(pool:DhcpPool,interfaces:RouterInterface[])=>{
  const start=ipv4(pool.start),end=ipv4(pool.end);
  return vlanOK(pool.vlanId)&&start!==undefined&&end!==undefined&&start<=end&&end-start<=1023&&validMask(pool.mask)&&
   interfaces.some(i=>i.vlanId===pool.vlanId&&onSubnet(i.ip,pool.start,pool.mask))&&
   onSubnet(pool.start,pool.end,pool.mask)&&onSubnet(pool.gateway,pool.start,pool.mask)&&ipv4(pool.dns)!==undefined;
 };
 const routers=devices.filter(d=>profile(d.profileId).kind==='router'&&powered.has(d.id)).sort((a,b)=>a.id.localeCompare(b.id));
 const occupied=new Map<number,Set<number>>();
 const addOccupied=(v:number,ip:string)=>{const n=ipv4(ip);if(n===undefined)return;if(!occupied.has(v))occupied.set(v,new Set());occupied.get(v)!.add(n);};
 for(const d of devices){if(profile(d.profileId).signal==='analog')continue;if(d.addressMode!=='dhcp'&&d.ip)addOccupied(selectedVlan(d),d.ip);}
 for(const r of routers)for(const i of r.routerInterfaces||[])addOccupied(i.vlanId,i.ip);
 // Deterministic DHCP leases are recomputed; no real timer or server state is implied.
 for(const d of [...devices].sort((a,b)=>a.id.localeCompare(b.id))){
  if(profile(d.profileId).signal==='analog')continue;
  const vlan=selectedVlan(d),faults:string[]=[];
  if(!vlanOK(vlan))faults.push('Invalid access VLAN ID');
  if(d.addressMode==='dhcp'){
   let leased=false;
   for(const r of routers){
    const pools=(r.dhcpPools||[]).filter(pool=>pool.vlanId===vlan);
    if(!l2(d.id,r.id,vlan).ok)continue;
    for(const pool of pools){
     if(!validPool(pool,r.routerInterfaces||[])){diagnostics.push(`${r.name}: invalid DHCP pool for VLAN ${vlan}`);continue;}
     const start=ipv4(pool.start)!,end=ipv4(pool.end)!,taken=occupied.get(vlan)||new Set<number>();
     const net=(start&ipv4(pool.mask)!)>>>0,broadcast=(net|(~ipv4(pool.mask)!)>>>0)>>>0;
     for(let n=start;n<=end;n++){
      if(n===net||n===broadcast||taken.has(n))continue;
      addOccupied(vlan,ipString(n));
      addresses[d.id]={ip:ipString(n),mask:pool.mask,gateway:pool.gateway,dns:pool.dns,vlanId:vlan,source:'dhcp',faults};
      dhcpLeases[d.id]=ipString(n);leased=true;break;
     }
     if(leased)break;
    }
    if(leased)break;
   }
   if(!leased){faults.push('DHCP lease unavailable (pool, VLAN or route failure)');addresses[d.id]={ip:'',mask:'',gateway:'',dns:'',vlanId:vlan,source:'unassigned',faults};}
  }else{
   addresses[d.id]={ip:d.ip,mask:d.mask,gateway:d.gateway,dns:d.dns||'',vlanId:vlan,source:'static',faults};
  }
  const addr=addresses[d.id];
  if(profile(d.profileId).kind!=='switch'&&(!addr.ip||ipv4(addr.ip)===undefined||!validMask(addr.mask)))faults.push('Invalid IPv4 address or subnet mask');
  if(addr.dns&&ipv4(addr.dns)===undefined)faults.push('Invalid DNS server address');
 }
 const ipGroups=new Map<string,string[]>();
 for(const d of devices){if(!powered.has(d.id)||profile(d.profileId).kind==='switch'||profile(d.profileId).signal==='analog')continue;
  const a=addresses[d.id];if(!a?.ip||ipv4(a.ip)===undefined)continue;
  const key=`${a.vlanId}:${ipv4(a.ip)}`;
  ipGroups.set(key,[...(ipGroups.get(key)||[]),d.id]);
 }
 for(const r of routers)for(const i of r.routerInterfaces||[]){
  const key=`${i.vlanId}:${ipv4(i.ip)}`;if(ipv4(i.ip)===undefined)continue;
  const assigned=ipGroups.get(key)||[];
  if(assigned.length)for(const id of assigned)addresses[id].faults.push('IPv4 address conflicts with a router VLAN interface');
 }
 for(const ids of ipGroups.values())if(ids.length>1)for(const id of ids)addresses[id].faults.push('Duplicate IPv4 address on VLAN');
 const trace=(from:string,to:string):NetworkTrace=>{
  const a=addresses[from],b=addresses[to];
  if(!a||!b)return {ok:false,reason:'Unknown source or target device',devices:[],links:[]};
  if(!powered.has(from)||!powered.has(to))return {ok:false,reason:'Source or target has no power',devices:[],links:[]};
  if(a.faults.some(f=>f.includes('lease')||f.includes('Duplicate')||f.includes('Invalid IPv4')||f.includes('conflicts with'))||b.faults.some(f=>f.includes('lease')||f.includes('Duplicate')||f.includes('Invalid IPv4')||f.includes('conflicts with')))
   return {ok:false,reason:'Source or destination IP configuration invalid',devices:[],links:[]};
  if(a.vlanId===b.vlanId&&onSubnet(a.ip,b.ip,a.mask)&&onSubnet(b.ip,a.ip,b.mask))return l2(from,to,a.vlanId);
  for(const router of routers){
   if(!router.routingEnabled)continue;
   const interfaces=router.routerInterfaces||[];
   const sourceIf=interfaces.find(i=>i.vlanId===a.vlanId&&onSubnet(a.ip,i.ip,i.mask));
   const targetIf=interfaces.find(i=>i.vlanId===b.vlanId&&onSubnet(b.ip,i.ip,i.mask));
   if(!sourceIf||!targetIf||a.gateway!==sourceIf.ip||b.gateway!==targetIf.ip)continue;
   const outbound=l2(from,router.id,a.vlanId),returnPath=l2(router.id,to,b.vlanId);
   if(outbound.ok&&returnPath.ok)return {ok:true,reason:`Routed by ${router.name} between VLANs ${a.vlanId} and ${b.vlanId}`,devices:[...outbound.devices,...returnPath.devices.slice(1)],links:[...outbound.links,...returnPath.links],viaRouter:router.id};
  }
  // One routed transit hop: require matching forward and reverse static routes.
  // This is not arbitrary dynamic routing and deliberately refuses missing return paths.
  for(const first of routers){
   if(!first.routingEnabled)continue;
   const inIf=(first.routerInterfaces||[]).find(i=>i.vlanId===a.vlanId&&onSubnet(a.ip,i.ip,i.mask));
   if(!inIf||a.gateway!==inIf.ip)continue;
   const left=l2(from,first.id,a.vlanId);if(!left.ok)continue;
   for(const second of routers){
    if(second.id===first.id||!second.routingEnabled)continue;
    const outIf=(second.routerInterfaces||[]).find(i=>i.vlanId===b.vlanId&&onSubnet(b.ip,i.ip,i.mask));
    if(!outIf||b.gateway!==outIf.ip)continue;
    const right=l2(second.id,to,b.vlanId);if(!right.ok)continue;
    for(const fwd of first.routerInterfaces||[]){
     const back=(second.routerInterfaces||[]).find(i=>i.vlanId===fwd.vlanId&&onSubnet(i.ip,fwd.ip,fwd.mask));
     if(!back)continue;
     const outboundRoute=(first.routes||[]).some(r=>validMask(r.mask)&&onSubnet(b.ip,r.destination,r.mask)&&r.nextHop===back.ip);
     const returnRoute=(second.routes||[]).some(r=>validMask(r.mask)&&onSubnet(a.ip,r.destination,r.mask)&&r.nextHop===fwd.ip);
     if(!outboundRoute||!returnRoute)continue;
     const transit=l2(first.id,second.id,fwd.vlanId);if(!transit.ok)continue;
     return {ok:true,reason:`Static routes via ${first.name} and ${second.name}`,devices:[...left.devices,...transit.devices.slice(1),...right.devices.slice(1)],links:[...left.links,...transit.links,...right.links],viaRouter:first.id};
    }
   }
  }
  return {ok:false,reason:'No valid same-subnet path or bidirectional gateway/routing configuration',devices:[],links:[]};
 };
 const radioUsed=new Map<string,number>();
 const reserve=(path:NetworkTrace,mbps:number):boolean=>{
  if(!path.ok||!Number.isFinite(mbps)||mbps<=0)return false;
  const unique=[...new Set(path.links)];
  if(unique.some(id=>!links[id]||links[id].usedMbps+mbps>links[id].capacityMbps+1e-9))return false;
  const apIds=[...new Set(unique.map(id=>id.startsWith('radio:')?links[id].b:undefined).filter((id):id is string=>!!id))];
  if(apIds.some(id=>(radioUsed.get(id)||0)+mbps>(byId.get(id)?.wireless?.bandwidthMbps||0)+1e-9))return false;
  unique.forEach(id=>links[id].usedMbps+=mbps);
  apIds.forEach(id=>radioUsed.set(id,(radioUsed.get(id)||0)+mbps));
  return true;
 };
 const resolve=(clientId:string,hostname:string):{ok:boolean;ip?:string;reason:string}=>{
  const client=addresses[clientId];
  if(!client)return {ok:false,reason:'Unknown DNS client'};
  if(!/^[a-z0-9][a-z0-9.-]{0,78}$/i.test(hostname))return {ok:false,reason:'Invalid hostname'};
  if(!client.dns||ipv4(client.dns)===undefined)return {ok:false,reason:'DNS resolver is not a valid IPv4 address'};
  const servers=devices.filter(d=>profile(d.profileId).kind==='server'&&d.dnsEnabled&&addresses[d.id]?.ip===client.dns&&powered.has(d.id));
  for(const server of servers){
   const path=trace(clientId,server.id);if(!path.ok)continue;
   const answer=server.dnsRecords?.find(r=>r.hostname.toLowerCase()===hostname.toLowerCase());
   if(answer){if(ipv4(answer.ip)===undefined)return {ok:false,reason:'DNS record has an invalid IPv4 target'};
    return {ok:true,ip:answer.ip,reason:`Resolved via ${server.name} (simulated local DNS)`};}
   return {ok:false,reason:'DNS server reachable but hostname has no configured record'};
  }
  return {ok:false,reason:'No reachable configured local DNS server at resolver address'};
 };
 const traces:Record<string,NetworkTrace>={};
 for(const d of devices.filter(d=>profile(d.profileId).kind==='camera'&&profile(d.profileId).signal!=='analog'))
  for(const nvr of devices.filter(d=>profile(d.profileId).kind==='nvr'))traces[`${d.id}→${nvr.id}`]=trace(d.id,nvr.id);
 for(const d of devices){for(const fault of addresses[d.id]?.faults||[])diagnostics.push(`${d.name}: ${fault}`);}
 return {snapshot:{addresses,links,wireless,dhcpLeases,diagnostics,traces},trace,reserve,resolve};
}

/** Diagnostic probe with operational effects. Returns simulation analysis, not a real ICMP packet. */
export function probeNetwork(project:Project,upCables:Set<string>,powered:Set<string>,from:string,to:string):NetworkTrace{
 return evaluateNetwork(project,upCables,powered).trace(from,to);
}

/** Training DNS probe; does not contact any external resolver or make real packets. */
export function resolveNetworkName(project:Project,upCables:Set<string>,powered:Set<string>,from:string,hostname:string){
 return evaluateNetwork(project,upCables,powered).resolve(from,hostname);
}
