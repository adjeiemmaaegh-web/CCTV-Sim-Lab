import React from 'react';
import type {Device,DhcpPool,PortConfig,RouterInterface,StaticRoute} from '../../../src/domain/types.js';
import {profile} from '../../../src/domain/catalog.js';
import type {Workbench} from '../hooks/useWorkbench.js';

const num=(value:string)=>Number(value);
const vlanOptions=(n:number)=>Math.min(4094,Math.max(1,Math.trunc(n)||10));
function Field({label,value,save,disabled,type='text',min,max}:{label:string;value:string|number;save:(v:string)=>void;disabled:boolean;type?:string;min?:number;max?:number}){
 return <label className="prop-field"><span>{label}</span><input disabled={disabled} type={type} min={min} max={max} value={value} onChange={e=>save(e.currentTarget.value)}/></label>;
}
export function NetworkSettings({w,d}:{w:Workbench;d:Device}){
 const p=profile(d.profileId),disabled=w.blocked,update=(fields:Partial<Device>)=>w.update(d.id,fields);
 const address=w.result.network?.addresses[d.id],wireless=w.result.network?.wireless[d.id];
 const ipEligible=p.kind!=='switch'&&!(p.kind==='camera'&&p.signal==='analog');
 const ports=d.portConfigs||[];
 const editPort=(index:number,partial:Partial<PortConfig>)=>{
  const current=ports.find(x=>x.number===index)||{number:index,mode:'access' as const,accessVlan:10,nativeVlan:10,allowedVlans:[10],speedMbps:p.portSpeedMbps||1000};
  update({portConfigs:[...ports.filter(x=>x.number!==index),{...current,...partial}].sort((a,b)=>a.number-b.number)});
 };
 const iface=d.routerInterfaces||[];
 const editInterface=(index:number,fields:Partial<RouterInterface>)=>update({routerInterfaces:iface.map((v,i)=>i===index?{...v,...fields}:v)});
 const pools=d.dhcpPools||[];
 const editPool=(index:number,fields:Partial<DhcpPool>)=>update({dhcpPools:pools.map((v,i)=>i===index?{...v,...fields}:v)});
 const routes=d.routes||[];
 const editRoute=(index:number,fields:Partial<StaticRoute>)=>update({routes:routes.map((v,i)=>i===index?{...v,...fields}:v)});
 return <div className="network-settings">
  <div className="section-heading">STAGE 5 · NETWORK CONFIGURATION</div>
  {ipEligible&&<div className="fields">
   <label className="prop-field"><span>Address assignment</span><select disabled={disabled} value={d.addressMode||'static'} onChange={e=>update({addressMode:e.currentTarget.value as 'static'|'dhcp'})}><option value="static">Static IPv4</option><option value="dhcp">DHCP client</option></select></label>
   <Field label="Access VLAN (1–4094)" value={d.vlanId??10} save={v=>update({vlanId:vlanOptions(num(v))})} disabled={disabled} type="number" min={1} max={4094}/>
   <Field label="DNS server (IPv4)" value={d.dns||''} save={v=>update({dns:v})} disabled={disabled}/>
   {address&&<p className="editor-muted">Effective address: <strong>{address.ip||'No lease'}</strong> · {address.source.toUpperCase()} · VLAN {address.vlanId}</p>}
  </div>}
  {p.wirelessCapable&&<div className="fields">
   <label className="checkfield"><span>Connect over Wi-Fi</span><input disabled={disabled} type="checkbox" checked={d.wifiEnabled!==false} onChange={e=>update({wifiEnabled:e.currentTarget.checked})}/></label>
   <Field label="Wi-Fi SSID" value={d.wifiSsid||''} save={v=>update({wifiSsid:v})} disabled={disabled}/>
   <Field label="Training PSK (not a real credential)" value={d.wifiKey||''} save={v=>update({wifiKey:v})} disabled={disabled}/>
   <p className="editor-muted">{wireless?.connected?`Associated with ${w.project.devices.find(x=>x.id===wireless.apId)?.name||'AP'} · signal ${wireless.signalPercent}%`:wireless?.reason||'Not associated'}.</p>
  </div>}
  {p.kind==='ap'&&<><div className="section-heading">WIRELESS ACCESS POINT (SIMULATED)</div><div className="fields">
    <Field label="SSID" value={d.wireless?.ssid||''} save={v=>update({wireless:{...d.wireless!,ssid:v}})} disabled={disabled}/>
    <Field label="Training PSK" value={d.wireless?.key||''} save={v=>update({wireless:{...d.wireless!,key:v}})} disabled={disabled}/>
    <Field label="Bridged VLAN" value={d.wireless?.vlanId??10} save={v=>update({wireless:{...d.wireless!,vlanId:vlanOptions(num(v))},vlanId:vlanOptions(num(v))})} disabled={disabled} type="number" min={1} max={4094}/>
    <Field label="Radio range (plan units)" value={d.wireless?.rangeUnits??200} save={v=>update({wireless:{...d.wireless!,rangeUnits:Math.max(1,num(v))}})} disabled={disabled} type="number"/>
    <Field label="Maximum clients" value={d.wireless?.maxClients??8} save={v=>update({wireless:{...d.wireless!,maxClients:Math.min(50,Math.max(1,Math.trunc(num(v))||1))}})} disabled={disabled} type="number"/>
    <Field label="Radio capacity (Mb/s)" value={d.wireless?.bandwidthMbps??72} save={v=>update({wireless:{...d.wireless!,bandwidthMbps:Math.max(1,num(v))}})} disabled={disabled} type="number"/>
    <p className="editor-muted">Power is supplied by a modelled DC adapter. Range is a circular 2D approximation; actual Wi-Fi signal physics is not simulated.</p>
   </div></>}
  {p.managed&&<><div className="section-heading">MANAGED SWITCH · PORT VLAN TABLE</div><div className="port-table">
   {Array.from({length:p.ethernetPorts},(_,i)=>i+1).map(n=>{const pc=ports.find(x=>x.number===n)||{number:n,mode:'access',accessVlan:10,nativeVlan:10,allowedVlans:[10],speedMbps:p.portSpeedMbps||1000} as PortConfig;
    return <div key={n} className="port-config"><strong>P{n}</strong><select aria-label={`Port ${n} mode`} disabled={disabled} value={pc.mode} onChange={e=>editPort(n,{mode:e.target.value as PortConfig['mode']})}><option value="access">Access</option><option value="trunk">Trunk</option></select>
     <input aria-label={`Port ${n} VLAN`} disabled={disabled} type="number" min={1} max={4094} value={pc.mode==='access'?pc.accessVlan:pc.nativeVlan} onChange={e=>editPort(n,pc.mode==='access'?{accessVlan:vlanOptions(num(e.target.value))}:{nativeVlan:vlanOptions(num(e.target.value))})}/>
     {pc.mode==='trunk'&&<input aria-label={`Port ${n} allowed VLANs`} disabled={disabled} placeholder="10,20" value={pc.allowedVlans.join(',')} onChange={e=>editPort(n,{allowedVlans:e.target.value.split(',').map(v=>Number(v.trim())).filter(v=>Number.isSafeInteger(v)&&v>=1&&v<=4094).slice(0,32)})}/>}
     <select aria-label={`Port ${n} speed`} disabled={disabled} value={pc.speedMbps} onChange={e=>editPort(n,{speedMbps:num(e.target.value)})}>{[10,100,1000].map(v=><option key={v} value={v}>{v} Mb/s</option>)}</select>
    </div>;})}
   <p className="editor-muted">Cable endpoints use numbered switch ports. Access ports carry one untagged VLAN; trunks carry configured VLANs with a native VLAN for untagged endpoints. This is a simplified 802.1Q teaching model.</p>
  </div></>}
  {p.kind==='server'&&<><div className="section-heading">VIRTUAL DNS RECORDS</div><label className="checkfield"><span>Answer local DNS lookups</span><input type="checkbox" disabled={disabled} checked={d.dnsEnabled===true} onChange={e=>update({dnsEnabled:e.currentTarget.checked})}/></label>
    {(d.dnsRecords||[]).map((r,n)=><div key={n} className="network-entry"><Field label="Hostname" value={r.hostname} disabled={disabled} save={v=>update({dnsRecords:(d.dnsRecords||[]).map((x,i)=>i===n?{...x,hostname:v}:x)})}/><Field label="IPv4 result" value={r.ip} disabled={disabled} save={v=>update({dnsRecords:(d.dnsRecords||[]).map((x,i)=>i===n?{...x,ip:v}:x)})}/><button disabled={disabled} onClick={()=>update({dnsRecords:(d.dnsRecords||[]).filter((_,i)=>i!==n)})}>Remove record</button></div>)}
    <button disabled={disabled||(d.dnsRecords||[]).length>=24} onClick={()=>update({dnsRecords:[...(d.dnsRecords||[]),{hostname:'camera.lab',ip:'192.168.10.20'}]})}>+ DNS record</button><p className="editor-muted">A DNS client must address this server's IPv4 and have a valid network path before local hostname lookup succeeds. No external DNS is sent.</p>
  </>}
  {p.kind==='router'&&<><div className="section-heading">INTER-VLAN ROUTER</div><label className="checkfield"><span>Enable IPv4 forwarding</span><input disabled={disabled} type="checkbox" checked={d.routingEnabled===true} onChange={e=>update({routingEnabled:e.target.checked})}/></label>
   <div className="section-heading">VLAN INTERFACES</div>{iface.map((i,n)=><div key={n} className="network-entry">
    <Field label="VLAN" value={i.vlanId} type="number" min={1} max={4094} disabled={disabled} save={v=>editInterface(n,{vlanId:vlanOptions(num(v))})}/>
    <Field label="IPv4 interface" value={i.ip} disabled={disabled} save={v=>editInterface(n,{ip:v})}/>
    <Field label="Netmask" value={i.mask} disabled={disabled} save={v=>editInterface(n,{mask:v})}/>
    <button disabled={disabled} onClick={()=>update({routerInterfaces:iface.filter((_,j)=>j!==n)})}>Remove interface</button></div>)}
   <button disabled={disabled||iface.length>=16} onClick={()=>{const vlan=[30,40,50,60,70,80,90,100].find(n=>!iface.some(i=>i.vlanId===n))||200;update({routerInterfaces:[...iface,{vlanId:vlan,ip:`192.168.${vlan}.1`,mask:'255.255.255.0'}]});}}>+ VLAN interface</button>
   <div className="section-heading">DHCP POOLS</div>{pools.map((p,n)=><div key={n} className="network-entry">
    <Field label="VLAN" value={p.vlanId} type="number" disabled={disabled} save={v=>editPool(n,{vlanId:vlanOptions(num(v))})}/>
    {(['start','end','mask','gateway','dns'] as const).map(k=><Field key={k} label={k} value={p[k]} disabled={disabled} save={v=>editPool(n,{[k]:v})}/>)}
    <button disabled={disabled} onClick={()=>update({dhcpPools:pools.filter((_,j)=>j!==n)})}>Remove DHCP pool</button></div>)}
   <button disabled={disabled||pools.length>=8} onClick={()=>{const vlan=iface.find(i=>!pools.some(p=>p.vlanId===i.vlanId))?.vlanId||20;update({dhcpPools:[...pools,{vlanId:vlan,start:`192.168.${vlan}.100`,end:`192.168.${vlan}.199`,mask:'255.255.255.0',gateway:`192.168.${vlan}.1`,dns:'1.1.1.1'}]});}}>+ DHCP pool</button>
   <div className="section-heading">STATIC ROUTES (REQUIRE RETURN PATH)</div>{routes.map((route,n)=><div key={n} className="network-entry">
    {(['destination','mask','nextHop'] as const).map(k=><Field key={k} label={k} disabled={disabled} value={route[k]} save={v=>editRoute(n,{[k]:v})}/>)}
    <button disabled={disabled} onClick={()=>update({routes:routes.filter((_,j)=>j!==n)})}>Remove route</button></div>)}
   <button disabled={disabled||routes.length>=24} onClick={()=>update({routes:[...routes,{destination:'192.168.30.0',mask:'255.255.255.0',nextHop:'192.168.20.2'}]})}>+ Static route</button>
   <p className="editor-muted">Only connected VLAN interfaces and explicit one-hop static routes are simulated; NAT, internet uplinks and dynamic routing protocols are not.</p>
  </>}
 </div>;
}
