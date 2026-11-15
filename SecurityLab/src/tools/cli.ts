/**
 * Educational network CLI (Feature 1). A deliberately small, Cisco-flavoured command language that edits the
 * same device fields the forms edit, so CLI and GUI always agree. It is NOT IOS: it supports only the commands
 * listed by `help`. Pure functions: every command returns a new Project and output lines.
 */
import type {Device,PortConfig,Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {ipv4,validMask} from '../engine/network.js';
import {probeNetwork} from '../engine/networking.js';
import {networkInputs} from './netinputs.js';

export type CliMode='exec'|'privileged'|'config'|'config-if';
export type CliState={deviceId:string|null;mode:CliMode;iface?:string};
export type CliResult={project:Project;state:CliState;output:string[]};
export const initialCliState=():CliState=>({deviceId:null,mode:'exec'});

const isManagedSwitch=(d:Device)=>profile(d.profileId).kind==='switch'&&!!profile(d.profileId).managed;
const kindOf=(d:Device)=>profile(d.profileId).kind;
const find=(p:Project,name:string)=>p.devices.find(d=>d.name.toLowerCase()===name.toLowerCase())??p.devices.find(d=>d.name.toLowerCase().startsWith(name.toLowerCase()));
const replace=(p:Project,id:string,fn:(d:Device)=>Device):Project=>({...p,devices:p.devices.map(d=>d.id===id?fn(d):d)});
const vlanOk=(n:number)=>Number.isInteger(n)&&n>=1&&n<=4094;
const parseVlanList=(s:string)=>s.split(',').flatMap(x=>{const m=x.split('-').map(Number);if(m.length===2&&m.every(Number.isFinite)&&m[1]>=m[0]&&m[1]-m[0]<4094)return Array.from({length:m[1]-m[0]+1},(_,i)=>m[0]+i);return m.length===1?[m[0]]:[NaN];});
const portNo=(s:string)=>{const m=/^(?:port|fa0\/|gi0\/|eth)?\s*(\d+)$/i.exec(s.trim());return m?Number(m[1]):NaN;};
const defaultPort=(n:number):PortConfig=>({number:n,mode:'access',accessVlan:10,nativeVlan:10,allowedVlans:[10],speedMbps:1000});

export const prompt=(p:Project,s:CliState)=>{
 const d=s.deviceId?p.devices.find(x=>x.id===s.deviceId):undefined;
 if(!d)return 'SecurityLab>';
 const n=d.name.replace(/\s+/g,'-');
 return s.mode==='exec'?`${n}>`:s.mode==='privileged'?`${n}#`:s.mode==='config'?`${n}(config)#`:`${n}(config-if)#`;
};

function showRunning(d:Device):string[]{
 const k=kindOf(d),out=[`hostname ${d.name.replace(/\s+/g,'-')}`,'!'];
 if(k==='switch'){
  const ports=profile(d.profileId).ethernetPorts;
  for(let i=1;i<=ports;i++){const c=d.portConfigs?.find(x=>x.number===i)??defaultPort(i);
   out.push(`interface port ${i}`,` switchport mode ${c.mode}`);
   if(c.mode==='access')out.push(` switchport access vlan ${c.accessVlan}`);
   else out.push(` switchport trunk native vlan ${c.nativeVlan}`,` switchport trunk allowed vlan ${c.allowedVlans.join(',')}`);
   out.push('!');}
 }else if(k==='router'){
  for(const i of d.routerInterfaces||[])out.push(`interface vlan ${i.vlanId}`,` ip address ${i.ip} ${i.mask}`,'!');
  out.push(d.routingEnabled===false?'no ip routing':'ip routing');
  for(const p of d.dhcpPools||[])out.push(`ip dhcp pool vlan ${p.vlanId} range ${p.start} ${p.end} mask ${p.mask} gateway ${p.gateway} dns ${p.dns}`);
  for(const r of d.routes||[])out.push(`ip route ${r.destination} ${r.mask} ${r.nextHop}`);
 }else{
  out.push(`vlan ${d.vlanId??10}`);
  if(d.addressMode==='dhcp')out.push('ip address dhcp');else out.push(`ip address ${d.ip} ${d.mask}`,`ip default-gateway ${d.gateway}`);
  if(d.dns)out.push(`ip name-server ${d.dns}`);
 }
 return out;
}

const HELP=['Commands (educational subset, not Cisco IOS):',
 ' devices | connect <device name> | enable | configure terminal | exit | end | help',
 ' show running-config | show vlan | show ip interface brief | show ip route | show dhcp lease | show interfaces trunk',
 ' ping <device name|ip>            (simulated reachability, uses live link and power state)',
 ' [switch] interface port <n>; switchport mode access|trunk; switchport access vlan <id>;',
 '          switchport trunk native vlan <id>; switchport trunk allowed vlan <list>',
 ' [router] interface vlan <id> -> ip address <ip> <mask>; no interface vlan <id>; ip routing | no ip routing;',
 '          ip dhcp pool vlan <id> range <start> <end> mask <mask> gateway <ip> dns <ip>; no ip dhcp pool vlan <id>;',
 '          ip route <dest> <mask> <next-hop>; no ip route <dest> <mask>',
 ' [host/camera/recorder] vlan <id>; ip address <ip> <mask>; ip address dhcp; ip default-gateway <ip>; ip name-server <ip>'];

export function runCommand(project:Project,state:CliState,line:string):CliResult{
 const text=line.trim().replace(/\s+/g,' ');const out=(...o:string[])=>({project,state,output:o});
 if(!text)return out();
 const [cmd,...rest]=text.split(' ');const c=cmd.toLowerCase(),arg=rest.join(' ');
 const dev=state.deviceId?project.devices.find(d=>d.id===state.deviceId):undefined;
 if(c==='help'||c==='?')return out(...HELP);
 if(c==='devices')return out(...project.devices.filter(d=>!/^(alarm|access|power)-/.test(kindOf(d))).map(d=>`${d.name}  [${kindOf(d)}]`));
 if(c==='connect'){
  const d=find(project,arg);if(!d)return out(`% Unknown device "${arg}". Type "devices".`);
  if(/^(alarm|access|power)-/.test(kindOf(d)))return out('% This device has no network console.');
  return {project,state:{deviceId:d.id,mode:'exec'},output:[`Connected to ${d.name}.`]};
 }
 if(!dev)return out('% Not connected. Use "devices" then "connect <name>".');
 const k=kindOf(dev),mode=state.mode;
 if(c==='enable'){return mode==='exec'?{project,state:{...state,mode:'privileged'},output:[]}:out('% Already privileged.');}
 if(c==='configure'&&/^t(erminal)?$/i.test(arg)){return mode==='privileged'?{project,state:{...state,mode:'config'},output:['Enter configuration commands.']}:out('% Use "enable" first.');}
 if(c==='end'){return {project,state:{...state,mode:mode==='exec'?'exec':'privileged',iface:undefined},output:[]};}
 if(c==='exit'){
  if(mode==='config-if')return {project,state:{...state,mode:'config',iface:undefined},output:[]};
  if(mode==='config')return {project,state:{...state,mode:'privileged'},output:[]};
  if(mode==='privileged')return {project,state:{...state,mode:'exec'},output:[]};
  return {project,state:{deviceId:null,mode:'exec'},output:['Disconnected.']};
 }
 if(c==='show'){
  const s=arg.toLowerCase();
  if(mode==='exec'&&s.startsWith('running'))return out('% Privileged mode required (enable).');
  if(s.startsWith('running'))return out(...showRunning(dev));
  if(s==='vlan'){
   if(!isManagedSwitch(dev))return out('% Only managed switches have a VLAN database.');
   const ports=profile(dev.profileId).ethernetPorts,map=new Map<number,number[]>();
   for(let i=1;i<=ports;i++){const pc=dev.portConfigs?.find(x=>x.number===i)??defaultPort(i);if(pc.mode==='access')map.set(pc.accessVlan,[...(map.get(pc.accessVlan)||[]),i]);}
   return out('VLAN  Access ports',...[...map.entries()].sort((a,b)=>a[0]-b[0]).map(([v,ps])=>`${String(v).padEnd(5)} ${ps.join(', ')}`));
  }
  if(s==='interfaces trunk'){
   if(!isManagedSwitch(dev))return out('% Only managed switches have trunks.');
   const t=Array.from({length:profile(dev.profileId).ethernetPorts},(_,i)=>dev.portConfigs?.find(x=>x.number===i+1)).filter((x):x is PortConfig=>!!x&&x.mode==='trunk');
   return out('Port  Native  Allowed',...(t.length?t.map(x=>`${String(x.number).padEnd(5)} ${String(x.nativeVlan).padEnd(7)} ${x.allowedVlans.join(',')}`):['(no trunk ports)']));
  }
  if(s==='ip interface brief'){
   const {result}=networkInputs(project),a=result.network?.addresses[dev.id];
   if(k==='router')return out('Interface   IP-Address       Mask',...(dev.routerInterfaces||[]).map(i=>`vlan ${String(i.vlanId).padEnd(6)} ${i.ip.padEnd(15)} ${i.mask}`));
   if(k==='switch')return out('% Layer-2 switch: no IP interface.');
   return out('Interface   IP-Address       Mask             VLAN  Source',`eth0        ${(a?.ip||'unassigned').padEnd(15)} ${(a?.mask||'').padEnd(16)} ${String(a?.vlanId??'').padEnd(5)} ${a?.source??''}`);
  }
  if(s==='ip route'){
   if(k!=='router')return out('% Only routers have a routing table.');
   const lines=[...(dev.routerInterfaces||[]).map(i=>`C  ${i.ip}/${i.mask} is directly connected, vlan ${i.vlanId}`),...(dev.routes||[]).map(r=>`S  ${r.destination} ${r.mask} via ${r.nextHop}`)];
   return out(...(lines.length?lines:['(empty)']));
  }
  if(s==='dhcp lease'){
   const {result}=networkInputs(project),leases=Object.entries(result.network?.dhcpLeases||{});
   return out('Client                 IP',...(leases.length?leases.map(([id,ip])=>`${(project.devices.find(d=>d.id===id)?.name||id).padEnd(22)} ${ip}`):['(no leases)']));
  }
  return out('% Unrecognised show command. Type "help".');
 }
 if(c==='ping'){
  const target=find(project,arg)??project.devices.find(d=>d.ip===arg);
  if(!target)return out(`% Unknown device or address "${arg}".`);
  if(target.id===dev.id)return out('Reply from self.');
  const {up,powered}=networkInputs(project),t=probeNetwork(project,up,powered,dev.id,target.id);
  return out(t.ok?`Reply from ${target.name}: reachable (${t.reason})`:`Request failed: ${t.reason}`);
 }
 // ----- configuration commands (modify project) -----
 if(mode==='exec'||mode==='privileged')return out('% Command not available here. Use "configure terminal" (after "enable") to change settings.');
 const no=c==='no',words=(no?rest:[c,...rest]),w0=(words[0]||'').toLowerCase(),w1=(words[1]||'').toLowerCase();
 if(w0==='interface'){
  if(k==='switch'&&isManagedSwitch(dev)){const n=portNo(words.slice(1).join(' ').replace(/^port\s*/i,''));
   if(!Number.isInteger(n)||n<1||n>profile(dev.profileId).ethernetPorts)return out('% Invalid port number.');
   return {project,state:{...state,mode:'config-if',iface:String(n)},output:[]};}
  if(k==='router'){const v=Number(words[2]??(words[1]||'').replace(/^vlan/i,''));
   if(!/^vlan/i.test(words[1]||'')||!vlanOk(v))return out('% Use: interface vlan <id>');
   if(no){return {project:replace(project,dev.id,d=>({...d,routerInterfaces:(d.routerInterfaces||[]).filter(i=>i.vlanId!==v)})),state,output:[]};}
   const existing=dev.routerInterfaces?.some(i=>i.vlanId===v);
   const next=existing?project:replace(project,dev.id,d=>({...d,routerInterfaces:[...(d.routerInterfaces||[]),{vlanId:v,ip:'0.0.0.0',mask:'255.255.255.0'}]}));
   return {project:next,state:{...state,mode:'config-if',iface:String(v)},output:[]};}
  return out('% This device has no configurable interfaces.');
 }
 if(w0==='switchport'){
  if(!(mode==='config-if'&&k==='switch'&&isManagedSwitch(dev)&&state.iface))return out('% Enter "interface port <n>" on a managed switch first.');
  const n=Number(state.iface),cur=dev.portConfigs?.find(x=>x.number===n)??defaultPort(n);let nx={...cur};
  const sub=w1;
  if(sub==='mode'&&['access','trunk'].includes((words[2]||'').toLowerCase()))nx={...nx,mode:words[2].toLowerCase() as 'access'|'trunk',allowedVlans:words[2].toLowerCase()==='trunk'&&nx.allowedVlans.length<2?[10,20]:nx.allowedVlans};
  else if(sub==='access'&&(words[2]||'').toLowerCase()==='vlan'){const v=Number(words[3]);if(!vlanOk(v))return out('% Invalid VLAN id (1-4094).');nx={...nx,accessVlan:v,nativeVlan:v,allowedVlans:nx.mode==='access'?[v]:nx.allowedVlans};}
  else if(sub==='trunk'&&(words[2]||'').toLowerCase()==='native'&&(words[3]||'').toLowerCase()==='vlan'){const v=Number(words[4]);if(!vlanOk(v))return out('% Invalid VLAN id.');nx={...nx,nativeVlan:v};}
  else if(sub==='trunk'&&(words[2]||'').toLowerCase()==='allowed'&&(words[3]||'').toLowerCase()==='vlan'){const l=parseVlanList(words.slice(4).join(''));if(!l.length||!l.every(vlanOk))return out('% Invalid VLAN list.');nx={...nx,allowedVlans:[...new Set(l)].sort((a,b)=>a-b)};}
  else return out('% Unrecognised switchport command.');
  return {project:replace(project,dev.id,d=>({...d,portConfigs:[...(d.portConfigs||[]).filter(x=>x.number!==n),nx].sort((a,b)=>a.number-b.number)})),state,output:[]};
 }
 if(k==='router'){
  if(w0==='ip'&&w1==='routing')return {project:replace(project,dev.id,d=>({...d,routingEnabled:!no})),state,output:[]};
  if(w0==='ip'&&mode==='config-if'&&w1==='address'){
   if(!state.iface)return out('% No interface selected.');const v=Number(state.iface),ip=words[2],mask=words[3];
   if(ipv4(ip||'')===undefined||!validMask(mask||''))return out('% Usage: ip address <ip> <mask> (valid IPv4 and netmask).');
   return {project:replace(project,dev.id,d=>({...d,routerInterfaces:(d.routerInterfaces||[]).map(i=>i.vlanId===v?{...i,ip,mask}:i)})),state,output:[]};}
  if(w0==='ip'&&w1==='dhcp'&&(words[2]||'').toLowerCase()==='pool'){
   const v=Number(words[4]);if(!vlanOk(v))return out('% Usage: ip dhcp pool vlan <id> range <start> <end> mask <m> gateway <ip> dns <ip>');
   if(no)return {project:replace(project,dev.id,d=>({...d,dhcpPools:(d.dhcpPools||[]).filter(p=>p.vlanId!==v)})),state,output:[]};
   const kv=(key:string)=>{const i=words.findIndex(x=>x.toLowerCase()===key);return i>=0?words.slice(i+1,i+(key==='range'?3:2)):[];};
   const [start,end]=kv('range'),[mask]=kv('mask'),[gateway]=kv('gateway'),[dns]=kv('dns');
   if([start,end,gateway,dns].some(x=>!x||ipv4(x)===undefined)||!validMask(mask||''))return out('% Usage: ip dhcp pool vlan <id> range <start> <end> mask <m> gateway <ip> dns <ip>');
   return {project:replace(project,dev.id,d=>({...d,dhcpPools:[...(d.dhcpPools||[]).filter(p=>p.vlanId!==v),{vlanId:v,start,end,mask,gateway,dns}]})),state,output:[]};}
  if(w0==='ip'&&w1==='route'){
   const [dest,mask,nh]=[words[2],words[3],words[4]];
   if(no)return {project:replace(project,dev.id,d=>({...d,routes:(d.routes||[]).filter(r=>!(r.destination===dest&&r.mask===mask))})),state,output:[]};
   if(ipv4(dest||'')===undefined||!validMask(mask||'')||ipv4(nh||'')===undefined)return out('% Usage: ip route <dest> <mask> <next-hop>');
   return {project:replace(project,dev.id,d=>({...d,routes:[...(d.routes||[]).filter(r=>!(r.destination===dest&&r.mask===mask)),{destination:dest,mask,nextHop:nh}]})),state,output:[]};}
 }
 if(k!=='switch'&&k!=='router'){
  if(w0==='vlan'){const v=Number(words[1]);if(!vlanOk(v))return out('% Invalid VLAN id (1-4094).');return {project:replace(project,dev.id,d=>({...d,vlanId:v})),state,output:[]};}
  if(w0==='ip'&&w1==='address'){
   if((words[2]||'').toLowerCase()==='dhcp')return {project:replace(project,dev.id,d=>({...d,addressMode:'dhcp'})),state,output:[]};
   const [ip,mask]=[words[2],words[3]];if(ipv4(ip||'')===undefined||!validMask(mask||''))return out('% Usage: ip address <ip> <mask> | ip address dhcp');
   return {project:replace(project,dev.id,d=>({...d,addressMode:'static',ip,mask})),state,output:[]};}
  if(w0==='ip'&&w1==='default-gateway'){if(ipv4(words[2]||'')===undefined)return out('% Invalid gateway address.');return {project:replace(project,dev.id,d=>({...d,gateway:words[2]})),state,output:[]};}
  if(w0==='ip'&&w1==='name-server'){if(ipv4(words[2]||'')===undefined)return out('% Invalid DNS address.');return {project:replace(project,dev.id,d=>({...d,dns:words[2]})),state,output:[]};}
 }
 return out('% Unrecognised or unsupported command. Type "help".');
}
