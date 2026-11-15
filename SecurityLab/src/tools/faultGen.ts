/**
 * Feature 9: seeded, reproducible fault generator. The same project + seed always produces the same faults,
 * so an instructor can give one seed to a class and compare answers. Faults reuse the engine's own injectors.
 */
import type {Diagnosis,Project} from '../domain/types.js';
import {injectFault} from '../engine/simulator.js';

export const FAULT_KINDS=['disconnect','ipconflict','badsubnet','lowpoe','power','storage','diskfail','bandwidth','dhcp','vlan','wifi','orientation','coax','nightir'] as const;
export type FaultKind=typeof FAULT_KINDS[number];
export const FAULT_LABEL:Record<FaultKind,string>={
 disconnect:'Disconnected video cable',ipconflict:'Duplicate IP address',badsubnet:'Wrong subnet mask',lowpoe:'Insufficient PoE budget',power:'Switch/recorder power failure',
 storage:'Recorder disk full',diskfail:'Failed recording drive',bandwidth:'Recorder bandwidth exceeded',dhcp:'DHCP failure',vlan:'VLAN mismatch',wifi:'Wireless failure',
 orientation:'Camera pointing the wrong way',coax:'Coax fault',nightir:'Night with infrared problem'};

export type {Diagnosis};

/** Small deterministic PRNG (mulberry32). */
export function rng(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

/** Fault kinds that actually change this project. */
export function applicableFaults(project:Project):FaultKind[]{
 return FAULT_KINDS.filter(k=>{try{return injectFault(project,k).project!==project;}catch{return false;}});
}
export function generateFaults(project:Project,seed:number,count=1):{project:Project;diagnosis:Diagnosis}{
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Seed must be an integer 0-4294967295');
 if(!Number.isInteger(count)||count<1||count>4)throw new Error('Fault count must be 1-4');
 const rand=rng(seed);let current={...project,diagnosis:undefined} as Project;const applied:{kind:FaultKind;message:string}[]=[];
 for(let i=0;i<count;i++){
  const pool=applicableFaults(current).filter(k=>!applied.some(a=>a.kind===k));
  if(!pool.length)break;
  const kind=pool[Math.floor(rand()*pool.length)],r=injectFault(current,kind);
  current=r.project;applied.push({kind,message:r.message});
 }
 if(!applied.length)throw new Error('This project has no equipment that can fail in a diagnosable way yet');
 const diagnosis:Diagnosis={seed,count:applied.length,applied,revealed:false,guesses:[]};
 return {project:{...current,diagnosis},diagnosis};
}
export function submitGuess(project:Project,guesses:FaultKind[]):{project:Project;correct:FaultKind[];missed:FaultKind[];wrong:FaultKind[]}{
 const d=project.diagnosis;if(!d)throw new Error('No generated fault in this project');
 const truth=d.applied.map(a=>a.kind as FaultKind),uniq=[...new Set(guesses)];
 return {project:{...project,diagnosis:{...d,guesses:[...uniq]}},correct:uniq.filter(g=>truth.includes(g)),missed:truth.filter(t=>!uniq.includes(t)),wrong:uniq.filter(g=>!truth.includes(g))};
}
export const reveal=(project:Project):Project=>project.diagnosis?{...project,diagnosis:{...project.diagnosis,revealed:true}}:project;
