import type {Profile} from '../types.js';
import {HIKVISION_PROFILES} from './hikvision.js';
import {DAHUA_PROFILES} from './dahua.js';
import {UBIQUITI_PROFILES} from './ubiquiti.js';
import {TPLINK_PROFILES} from './tplink.js';
import {REOLINK_PROFILES} from './reolink.js';
import {AJAX_PROFILES} from './ajax.js';
/** Stable, immutable release collection. Adding a new model means adding a separate module/ID, not rewriting the engine. */
export const MANUFACTURER_PROFILES:Profile[]=[...HIKVISION_PROFILES,...DAHUA_PROFILES,...UBIQUITI_PROFILES,...TPLINK_PROFILES,...REOLINK_PROFILES,...AJAX_PROFILES];
export const MANUFACTURERS=['Hikvision','Dahua','Ubiquiti','TP-Link','Reolink','Ajax Systems'] as const;
export function profileReadyForSimulation(p:Profile):boolean{return p.manufacturerSpec?.status!=='reference-only';}
export function manufacturerVideoCompatible(camera:Profile,recorder:Profile):{ok:boolean;reason:string}{
 if(!camera.manufacturerSpec||!recorder.manufacturerSpec)return {ok:true,reason:'Generic training stream adapter (not verified hardware compatibility)'};
 const outputs=camera.manufacturerSpec.videoOutput||[],inputs=recorder.manufacturerSpec.videoInput||[];
 const shared=outputs.find(x=>inputs.includes(x));
 return shared?{ok:true,reason:`Common documented stream family ${shared} — virtual negotiation only`}:{ok:false,reason:`Unverified cross-vendor video protocol between ${camera.model} and ${recorder.model}`};
}
/** The vendor catalog is for training and source traceability, never a product certification or shopping feed. */
export function manufacturerCatalogDiagnostics(profiles:readonly Profile[]):string[]{
 const errors:string[]=[],ids=new Set<string>();
 for(const p of profiles){const m=p.manufacturerSpec;if(!m){errors.push(`${p.id}: missing source metadata`);continue;}
  if(ids.has(p.id))errors.push(`${p.id}: duplicate immutable model ID`);ids.add(p.id);
  if(!m.sourceUrl.startsWith('https://'))errors.push(`${p.id}: missing HTTPS provenance`);
  if(!m.edition||!m.variant||!m.documentedAt||!m.limitations.length||!m.sourcedFacts.length)errors.push(`${p.id}: incomplete disclosure`);
  if(p.poePorts>p.ethernetPorts||p.poeBudgetW<0||p.powerW<0||p.nvrChannels<0)errors.push(`${p.id}: invalid device capacities`);
  if(m.status==='reference-only'&&m.simulatedFeatures.some(x=>x.includes('interactive control')))errors.push(`${p.id}: unsupported reference mode`);
 }
 return errors;
}
