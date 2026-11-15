/**
 * Feature 12: bill of materials and GHS quotation. Prices are USER-ENTERED: generic training items use the
 * catalogue's training price; manufacturer profiles have no built-in price and are flagged until a quotation
 * is entered. Nothing here is a real supplier price.
 */
import type {Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';

export type QuoteSettings={cableRatePerMetre:Record<string,number>;labourRatePerHour:number;labourHours:Partial<Record<string,number>>;marginPercent:number;vatPercent:number;currency:string};
export const DEFAULT_QUOTE_SETTINGS:QuoteSettings={cableRatePerMetre:{ethernet:6,coax:5,alarm:3,access:3,dc:4,ac:6},labourRatePerHour:60,
 labourHours:{camera:1.5,nvr:1,dvr:1,switch:0.75,router:0.75,ap:0.75,server:1,'alarm-panel':2,'alarm-sensor':0.75,'alarm-keypad':0.75,'alarm-output':0.75,'access-controller':2,'access-reader':1,'access-lock':1.25},marginPercent:15,vatPercent:0,currency:'GHS'};

export type BomLine={profileId:string;description:string;qty:number;unitCost:number|null;total:number|null;needsQuotation:boolean};
export type Quote={lines:BomLine[];cables:{medium:string;metres:number;rate:number;total:number}[];materials:number;cableTotal:number;labourHours:number;labour:number;subtotal:number;margin:number;vat:number;total:number;warnings:string[];currency:string};

export function buildQuote(project:Project,settings:QuoteSettings=DEFAULT_QUOTE_SETTINGS,unitsPerMetre=project.unitsPerMeter??10):Quote{
 if(settings.marginPercent<0||settings.vatPercent<0||settings.labourRatePerHour<0)throw new Error('Rates must not be negative');
 const warnings:string[]=[],map=new Map<string,BomLine>();let labourHours=0;
 for(const d of project.devices){
  const p=profile(d.profileId),isRef=!!p.manufacturerSpec;
  const cost=isRef?(Number.isFinite(d.unitCostGhs)&&d.unitCostGhs!>0?d.unitCostGhs!:null):p.costGhs;
  const key=`${d.profileId}|${cost}`,line=map.get(key)||{profileId:d.profileId,description:`${p.name}${p.manufacturer&&p.manufacturer!=='SecurityLab'?` (${p.manufacturer} ${p.model})`:''}`,qty:0,unitCost:cost,total:cost===null?null:0,needsQuotation:cost===null};
  line.qty++;if(cost!==null)line.total=(line.total??0)+cost;map.set(key,line);
  if(cost===null)warnings.push(`${d.name}: enter a supplier quotation (no built-in price for manufacturer models)`);
  labourHours+=settings.labourHours[p.kind]??0.5;
 }
 const lines=[...map.values()].sort((a,b)=>a.description.localeCompare(b.description));
 const byMedium=new Map<string,number>(),dev=new Map(project.devices.map(d=>[d.id,d]));
 for(const c of project.cables){const a=dev.get(c.a),b=dev.get(c.b);const straight=a&&b?Math.hypot(a.x-b.x,a.y-b.y)/unitsPerMetre:0;
  const m=c.medium??'ethernet',len=Math.max(c.lengthMeters||0,straight)*1.15+2; // 15% slack plus 2 m for terminations
  byMedium.set(m,(byMedium.get(m)||0)+len);labourHours+=0.25+len/60;}
 const cables=[...byMedium.entries()].map(([medium,m])=>{const rate=settings.cableRatePerMetre[medium]??0,metres=Math.ceil(m);return {medium,metres,rate,total:metres*rate};});
 const materials=lines.reduce((n,l)=>n+(l.total??0),0),cableTotal=cables.reduce((n,c)=>n+c.total,0);
 const labour=labourHours*settings.labourRatePerHour,subtotal=materials+cableTotal+labour,margin=subtotal*settings.marginPercent/100,vat=(subtotal+margin)*settings.vatPercent/100;
 const r=(n:number)=>Math.round(n*100)/100;
 if(!project.devices.length)warnings.push('No equipment placed yet');
 return {lines,cables,materials:r(materials),cableTotal:r(cableTotal),labourHours:r(labourHours),labour:r(labour),subtotal:r(subtotal),margin:r(margin),vat:r(vat),total:r(subtotal+margin+vat),warnings:[...new Set(warnings)],currency:settings.currency};
}
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function quoteCsv(q:Quote):string{
 const cell=(v:string|number)=>{let s=String(v);if(/^[=+\-@]/.test(s))s="'"+s;return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
 const rows:(string|number)[][]=[['Item','Qty','Unit cost','Total'],...q.lines.map(l=>[l.description,l.qty,l.unitCost??'QUOTE NEEDED',l.total??'']),
  ...q.cables.map(c=>[`Cable (${c.medium}) metres`,c.metres,c.rate,c.total]),['Labour hours',q.labourHours,'',q.labour],['Subtotal','','',q.subtotal],['Margin','','',q.margin],['VAT','','',q.vat],['TOTAL','','',q.total]];
 return rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
export function quoteHtml(project:Project,q:Quote):string{
 const f=(n:number|null)=>n===null?'<em>quote needed</em>':n.toLocaleString('en',{minimumFractionDigits:2,maximumFractionDigits:2});
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Quotation - ${esc(project.title)}</title><style>body{font-family:system-ui,sans-serif;margin:2rem;color:#111}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #ccc;padding:6px;text-align:left}td.n,th.n{text-align:right}.warn{color:#a40}</style></head><body>
<h1>Quotation (training estimate)</h1><p><b>Project:</b> ${esc(project.title)} &middot; <b>Currency:</b> ${esc(q.currency)}</p>
<p class="warn">Prices are user-entered or training placeholders. This is not a binding quotation or a supplier price list.</p>
<table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit</th><th class="n">Total</th></tr></thead><tbody>
${q.lines.map(l=>`<tr><td>${esc(l.description)}</td><td class="n">${l.qty}</td><td class="n">${f(l.unitCost)}</td><td class="n">${f(l.total)}</td></tr>`).join('')}
${q.cables.map(c=>`<tr><td>Cable (${esc(c.medium)})</td><td class="n">${c.metres} m</td><td class="n">${f(c.rate)}</td><td class="n">${f(c.total)}</td></tr>`).join('')}
<tr><td>Labour (${q.labourHours} h)</td><td></td><td></td><td class="n">${f(q.labour)}</td></tr>
<tr><td><b>Subtotal</b></td><td></td><td></td><td class="n">${f(q.subtotal)}</td></tr><tr><td>Margin</td><td></td><td></td><td class="n">${f(q.margin)}</td></tr><tr><td>VAT</td><td></td><td></td><td class="n">${f(q.vat)}</td></tr>
<tr><td><b>Total</b></td><td></td><td></td><td class="n"><b>${f(q.total)}</b></td></tr></tbody></table>
${q.warnings.length?`<h3>Warnings</h3><ul>${q.warnings.map(w=>`<li class="warn">${esc(w)}</li>`).join('')}</ul>`:''}</body></html>`;
}
