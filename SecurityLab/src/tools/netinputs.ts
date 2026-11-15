import type {Project} from '../domain/types.js';
import {simulate} from '../engine/simulator.js';
/** Live link/power sets derived from the full simulation, as the network engine expects. */
export function networkInputs(project:Project){
 const r=simulate(project);
 return {
  result:r,
  up:new Set(project.cables.filter(c=>r.cables[c.id]?.up).map(c=>c.id)),
  powered:new Set(project.devices.filter(d=>r.devices[d.id]?.powered).map(d=>d.id)),
 };
}
