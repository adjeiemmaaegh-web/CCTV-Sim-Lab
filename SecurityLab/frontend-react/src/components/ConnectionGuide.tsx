import React from 'react';
import {profile} from '../../../src/domain/catalog.js';
import type {Cable} from '../../../src/domain/types.js';
import {ethernetPortChoices,validatePortChange} from '../../../src/tools/wiring-guide.js';
import type {Workbench} from '../hooks/useWorkbench.js';

/** Live read-only engineering checks plus safe port editing for the selected virtual cable. */
export function ConnectionGuide({w,cable}:{w:Workbench;cable:Cable}){
 const a=w.project.devices.find(d=>d.id===cable.a),b=w.project.devices.find(d=>d.id===cable.b);
 if(!a||!b)return <p role="alert">A cable endpoint is missing. Inspect the project before editing.</p>;
 const medium=cable.medium??'ethernet',ethernet=medium==='ethernet',status=w.result.cables[cable.id];
 const net=w.result.network?.links[cable.id];
 const update=(fields:Partial<Cable>,label:string)=>{
  w.commit({...w.project,cables:w.project.cables.map(c=>c.id===cable.id?{...c,...fields}:c)},label);
 };
 const changePort=(side:'a'|'b',port:number)=>{
  const invalid=validatePortChange(w.project,cable,side,port);
  if(invalid){w.setNotice(invalid);return;}
  update({[side+'Port']:port||undefined},'Virtual cable port '+side.toUpperCase()+' updated');
 };
 const reason=status?.reason||'Awaiting simulation';
 const linked=Boolean(status?.up);
 const help=linked?'Virtual link checks currently pass. This does not establish real cable performance.'
  :/PoE|power|unpowered/i.test(reason)?'Check that the supplying switch is enabled, the chosen switch port can supply PoE, and its virtual power budget is sufficient.'
  :/VLAN/i.test(reason)?'Compare access VLANs and trunk/native VLANs at both virtual ports.'
  :/occupied|port|assigned/i.test(reason)?'Use a free port at each endpoint. One virtual Ethernet interface cannot host two cables.'
  :/length|run exceeds/i.test(reason)?'Reduce the simulated cable length or redesign the topology; copper and coax limits are model assumptions.'
  :/disconnected/i.test(reason)?'Reconnect the cable in this panel and rerun the virtual checks.'
  :'Inspect both endpoint configurations, cable continuity and network diagnostics.';
 return <section className="connection-guide" aria-label="Connection setup">
  <div className="section-heading">CONNECTION SETUP · VIRTUAL {medium.toUpperCase()}</div>
  <div className="connection-route"><strong>{a.name}</strong><span aria-hidden="true">↔</span><strong>{b.name}</strong></div>
  <p className={linked?'connection-ok':'connection-warning'} role="status">{linked?'✓ Link ready':'⚠ Needs attention'} — {reason}</p>
  {ethernet&&<div className="fields">
   {(['a','b'] as const).map(side=>{
    const d=side==='a'?a:b,peer=side==='a'?b:a;
    const spec=profile(d.profileId),choices=ethernetPortChoices(w.project,d.id,cable.id,peer.id);
    const selected=(side==='a'?cable.aPort:cable.bPort)||0;
    const used=choices.filter(p=>p.usedBy).length;
    return <label className="prop-field" key={side}>
     <span>{'End '+side.toUpperCase()+' · '+d.name+' ('+used+'/'+spec.ethernetPorts+' other ports used)'}</span>
     <select aria-label={'End '+side.toUpperCase()+' port'} disabled={w.blocked||spec.ethernetPorts===0} value={selected} onChange={e=>changePort(side,Number(e.currentTarget.value))}>
      <option value={0}>Automatic (legacy project)</option>
      {choices.sort((x,y)=>x.number-y.number).map(p=><option key={p.number} value={p.number} disabled={!p.available&&p.number!==selected}>{p.label}</option>)}
     </select>
    </label>;
   })}
   {net&&<p className="editor-muted">Effective virtual interfaces: P{net.aPort} ↔ P{net.bPort}. VLANs: {net.vlans.join(', ')||'none'}. Capacity: {net.capacityMbps.toFixed(0)} Mb/s. Observed traffic: {net.usedMbps.toFixed(2)} Mb/s.</p>}
   {net?.faults.map((fault,i)=><p key={i} className="connection-warning">⚠ {fault}</p>)}
   {([a,b] as const).filter(d=>profile(d.profileId).kind==='switch').map(d=>{
    const sw=profile(d.profileId),poe=w.result.poe[d.id];return <p className="editor-muted" key={d.id}>{d.name}: {sw.poePorts} modeled PoE outputs, {poe?.consumedW.toFixed(1)||'0'} / {poe?.budgetW.toFixed(1)||sw.poeBudgetW.toFixed(1)} W allocated. Port and power eligibility are checked separately.</p>;
   })}
  </div>}
  {(ethernet||medium==='coax')&&<label className="prop-field"><span>Virtual termination / tester result</span><select aria-label="Cable termination result" disabled={w.blocked} value={cable.termination||'pass'} onChange={e=>update({termination:e.currentTarget.value as Cable['termination']},'Virtual cable tester result updated')}><option value="pass">PASS — continuity and wire map</option><option value="open">FAIL — open conductor</option><option value="short">FAIL — short circuit</option>{ethernet&&<option value="split-pair">FAIL — split pair</option>}</select><small className="editor-muted">Use this training fault to practise inspection and repair; it does not represent a physical cable measurement.</small></label>}
  <p className="connection-tip"><strong>Recommended check:</strong> {help}</p>
  <p className="editor-muted">All ports, link status and electrical behavior here are training models. They do not certify a real installation or manufacturer interoperability.</p>
 </section>;
}
