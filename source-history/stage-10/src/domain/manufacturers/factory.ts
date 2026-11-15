import type {Profile,DeviceKind,ManufacturerSpec} from '../types.js';
/** Common no-hardware bootstrap values. Always specify real physical limits per model. */
export function vendorProfile(fields:Pick<Profile,'id'|'name'|'manufacturer'|'model'|'kind'|'powerW'|'ethernetPorts'|'poePorts'|'poeBudgetW'|'maxPortW'|'nvrChannels'|'defaultStorageGB'|'defaultFov'|'defaultRange'|'protocols'> & Partial<Profile> & {manufacturerSpec:ManufacturerSpec}):Profile {
 return {costGhs:0,simulated:true,...fields};
}
export const NOT_A_PRICE='No published verified Ghana price: enter a local equipment quotation in the device inspector. Zero is NOT a free device.';
/** Each exact ID is pinned to a specification/variant. Never edit an existing ID to reflect future hardware revisions; create a new ID. */
export const SOURCE_DATE='2026-11-14';
