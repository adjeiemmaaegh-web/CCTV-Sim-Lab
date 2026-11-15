/**
 * Feature 17 (printable plan report): a standalone HTML document with the floor plan(s) drawn as SVG, equipment
 * list, quotation, good-practice review and diagnostics. Open it and use the browser's Print -> Save as PDF.
 * No external requests, no scripts in the generated document.
 */
import type {Project,SimResult} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {coveragePolygon} from '../engine/geometry.js';
import {adjustDevice} from '../engine/environment.js';
import {simulate} from '../engine/simulator.js';
import {floorList,floorView,hasFloors} from './floors.js';
import {buildQuote,type QuoteSettings,DEFAULT_QUOTE_SETTINGS} from './quote.js';
import {reviewProject,DISCLAIMER} from './standards.js';

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const CABLE_COLOUR:Record<string,string>={ethernet:'#1b7fbf',coax:'#c26a00',alarm:'#8a3fb8',access:'#b08a00',dc:'#555',ac:'#b00020'};

export function planSvg(p:Project,floor:number,r:SimResult):string{
 const v=floorView(p,floor),dev=new Map(v.devices.map(d=>[d.id,d]));const out:string[]=[];
 out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650" width="100%" role="img" aria-label="Floor plan"><rect width="1000" height="650" fill="#fff" stroke="#999"/>`);
 for(const room of v.rooms)out.push(`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="#f2f6fa" stroke="#bbb"/><text x="${room.x+6}" y="${room.y+14}" font-size="11" fill="#555">${esc(room.name)}</text>`);
 for(const d of v.devices.filter(d=>profile(d.profileId).kind==='camera')){
  const pts=coveragePolygon(adjustDevice(p,d),v.walls,p.night,24).map(q=>`${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ');
  out.push(`<polygon points="${pts}" fill="rgba(40,160,120,.18)" stroke="rgba(40,160,120,.5)"/>`);
 }
 for(const w of v.walls)out.push(`<line x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" stroke="${w.kind==='wall'?'#222':w.kind==='door'?'#a60':'#37a'}" stroke-width="${w.kind==='wall'?4:3}" ${w.kind==='wall'?'':'stroke-dasharray="6 4"'}/>`);
 for(const c of v.cables){const a=dev.get(c.a),b=dev.get(c.b);if(!a||!b)continue;out.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${CABLE_COLOUR[(c.medium||'ethernet').replace(/^power-/,'')]||'#1b7fbf'}" stroke-width="1.6" ${c.connected?'':'stroke-dasharray="3 3" opacity=".5"'}/>`);}
 for(const t of v.targets){const cov=r.coverage.find(x=>x.id===t.id)?.covered;out.push(`<g><path d="M${t.x-7} ${t.y-7}L${t.x+7} ${t.y+7}M${t.x+7} ${t.y-7}L${t.x-7} ${t.y+7}" stroke="${cov?'#1a8a4a':'#c0392b'}" stroke-width="2"/><text x="${t.x+9}" y="${t.y+4}" font-size="10">${esc(t.name)}</text></g>`);}
 v.devices.forEach((d,i)=>{const k=profile(d.profileId).kind,on=r.devices[d.id]?.powered;out.push(`<g><circle cx="${d.x}" cy="${d.y}" r="8" fill="${on?'#1f9d6a':'#aaa'}" stroke="#222"/><text x="${d.x}" y="${d.y+3}" font-size="8" fill="#fff" text-anchor="middle">${i+1}</text><title>${esc(d.name)} (${esc(k)})</title></g>`);});
 out.push('</svg>');return out.join('');
}
export function planReportHtml(p:Project,result:SimResult=simulate(p),settings:QuoteSettings=DEFAULT_QUOTE_SETTINGS,generatedAt=new Date().toISOString()):string{
 const floors=hasFloors(p)?floorList(p):[{id:0,name:'Plan'}];
 const q=buildQuote(p,settings),review=reviewProject(p,['cctv','alarm','fire','network'],result);
 const money=(n:number)=>n.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
 const body=floors.map(f=>{const ds=floorView(p,f.id).devices;return `<section><h2>${esc(f.name)}</h2>${planSvg(p,f.id,result)}<ol class="legend">${ds.map(d=>`<li>${esc(d.name)} <small>(${esc(profile(d.profileId).kind)}${d.ip&&profile(d.profileId).kind!=='switch'&&!/^(alarm|access|power)-/.test(profile(d.profileId).kind)?`, ${esc(d.ip)}`:''})</small></li>`).join('')}</ol></section>`;}).join('');
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)} - plan report</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#111;max-width:1000px}h1{margin:0}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid #ccc;padding:4px 6px;text-align:left}td.n{text-align:right}.legend{columns:2;font-size:12px}.warn{color:#a40}.fail{color:#b00020}section{break-inside:avoid;margin:18px 0}@media print{body{margin:8mm}a{color:inherit}}</style></head><body>
<h1>${esc(p.title)}</h1><p>Scenario ${esc(p.scenarioId)} &middot; generated ${esc(generatedAt.slice(0,19).replace('T',' '))} UTC &middot; ${p.assisted?'<b>assisted worked example</b>':'independent attempt'}</p>
<p class="warn">Training simulation output. Not an engineering design approval, certification or binding quotation.</p>
${body}
<h2>Bill of materials and estimate (${esc(q.currency)})</h2><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
${q.lines.map(l=>`<tr><td>${esc(l.description)}</td><td class="n">${l.qty}</td><td class="n">${l.unitCost===null?'quote needed':money(l.unitCost)}</td><td class="n">${l.total===null?'-':money(l.total)}</td></tr>`).join('')}
<tr><td>Cable</td><td></td><td></td><td class="n">${money(q.cableTotal)}</td></tr><tr><td>Labour (${q.labourHours} h)</td><td></td><td></td><td class="n">${money(q.labour)}</td></tr>
<tr><td><b>Total</b></td><td></td><td></td><td class="n"><b>${money(q.total)}</b></td></tr></tbody></table>
<h2>Good-practice review</h2><table><tbody>${review.map(x=>`<tr class="${x.status==='fail'?'fail':x.status==='warn'?'warn':''}"><td>${x.status.toUpperCase()}</td><td>${esc(x.title)}</td><td>${esc(x.detail)}</td></tr>`).join('')}</tbody></table><p><small>${esc(DISCLAIMER)}</small></p>
<h2>Simulation diagnostics</h2>${result.issues.length?`<ul>${result.issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:'<p>No issues reported by the simulation.</p>'}
</body></html>`;
}
