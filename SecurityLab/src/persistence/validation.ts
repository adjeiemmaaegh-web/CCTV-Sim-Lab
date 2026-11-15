import type {Project} from '../domain/types.js';
import {PROFILES} from '../domain/catalog.js';
import {SCENARIOS} from '../scenarios/index.js';

const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1000000;
const txt=(s:unknown)=>typeof s==='string'&&s.length<500;
const idTxt=(s:unknown)=>txt(s)&&String(s).trim().length>0;
const validPoint=(p:Record<string,unknown>)=>finite(p.x)&&finite(p.y);
/** Import boundary: reject invalid references, unsafe image URLs, unknown profiles, corrupt numeric values. */
/** Stage 1 schema upgrade is lossless: geometry, devices, event evidence and IDs stay unchanged. */
export function migrateProject(input:unknown):Project{
 if(!input||typeof input!=='object')throw new Error('Expected a SecurityLab project JSON object');
 const p=input as Record<string,unknown>;
 if(p.schemaVersion!==1&&p.schemaVersion!==2)throw new Error('Unsupported SecurityLab project schema version');
 const migrated=structuredClone(p) as unknown as Project;
 if(p.schemaVersion===1){migrated.schemaVersion=2;migrated.assessments??=[];}
 return migrated;
}
export function validateProject(input:unknown):Project{
 input=migrateProject(input);
 if(!input||typeof input!=='object')throw new Error('Expected a SecurityLab project JSON object');
 const p=input as Record<string,unknown>;
 if(p.schemaVersion!==2||!idTxt(p.id)||!idTxt(p.title)||!idTxt(p.scenarioId)||!SCENARIOS.some(s=>s.id===p.scenarioId))throw new Error('Unsupported project format, scenario or schema');
 if(!Array.isArray(p.devices)||!Array.isArray(p.cables)||!Array.isArray(p.rooms)||!Array.isArray(p.walls)||!Array.isArray(p.events)||!Array.isArray(p.targets))throw new Error('Project has missing geometry/equipment fields');
 if(p.devices.length>120||p.cables.length>240||p.walls.length>400||p.rooms.length>200||p.events.length>250||p.targets.length>50)throw new Error('Project exceeds safety limits');
 for(const d of p.devices){
  if(!d||!idTxt(d.id)||!idTxt(d.name)||!PROFILES.some(x=>x.id===d.profileId)||!validPoint(d)||!finite(d.heading)||!finite(d.fov)||!finite(d.range)||!txt(d.ip)||!txt(d.mask)||!txt(d.gateway)||typeof d.enabled!=='boolean'||typeof d.motionEnabled!=='boolean'||typeof d.recordingEnabled!=='boolean')throw new Error('Invalid device record');
  for(const key of ['unitCostGhs','poeBudgetW','storageGB','usedGB','bitrateMbps','opticalZoom','tiltDegrees','motionSensitivity','incomingMbps','frameRate'])if(d[key]!==undefined&&!finite(d[key]))throw new Error(`Invalid numeric equipment value: ${key}`);
  // No mutable project can turn a radio-only reference profile into a fictitious wired panel.
  const spec=PROFILES.find(x=>x.id===d.profileId)!;
  if(spec.manufacturerSpec?.status==='reference-only')throw new Error('Reference-only manufacturer profile cannot be installed');
  if(spec.manufacturerSpec&&d.unitCostGhs!==undefined&&(!finite(d.unitCostGhs)||d.unitCostGhs<=0||d.unitCostGhs>999999))throw new Error('Manufacturer local quotation must be positive GHS');
  // Stage 6 alarm configuration: bound counts, safe numeric fields, configured zone identifiers and legal states.
  if(d.alarmDevice!==undefined){
   const a=d.alarmDevice;
   if(!a||!Number.isInteger(a.zone)||a.zone<1||a.zone>32||typeof a.normallyClosed!=='boolean'||
    !['none','open','short','tamper'].includes(a.fault)||typeof a.bypassed!=='boolean'||
    !finite(a.sensitivity)||a.sensitivity<0||a.sensitivity>100)throw new Error('Invalid alarm detector circuit configuration');
  }
  if(d.alarmPanel!==undefined){
   const a=d.alarmPanel;
   if(!a||typeof a.pin!=='string'||!/^[0-9]{4,8}$/.test(a.pin)||
    !Number.isInteger(a.entryDelaySec)||a.entryDelaySec<0||a.entryDelaySec>180||
    !Number.isInteger(a.exitDelaySec)||a.exitDelaySec<0||a.exitDelaySec>180||
    !Number.isInteger(a.sirenDurationSec)||a.sirenDurationSec<1||a.sirenDurationSec>900||
    !finite(a.batteryCapacityWh)||a.batteryCapacityWh<0||a.batteryCapacityWh>1000||
    !finite(a.batteryChargeWh)||a.batteryChargeWh<0||a.batteryChargeWh>a.batteryCapacityWh||
    typeof a.batteryEnabled!=='boolean'||typeof a.tamper!=='boolean'||
    !Array.isArray(a.zones)||a.zones.length>32||new Set(a.zones.map((z:{number:number})=>z.number)).size!==a.zones.length)throw new Error('Invalid alarm panel configuration');
   for(const z of a.zones)if(!z||!Number.isInteger(z.number)||z.number<1||z.number>32||!txt(z.name)||
    !['instant','entry','interior','24h'].includes(z.type)||(z.contact!==undefined&&!['nc','no'].includes(z.contact))||typeof z.enabled!=='boolean'||typeof z.bypassed!=='boolean')throw new Error('Invalid alarm zone configuration');
  }
  // Stage 8 power configuration. Only fictional electrical training profiles may own it.
  if(d.powerConfig!==undefined){const c=d.powerConfig;
   if(!PROFILES.find(x=>x.id===d.profileId)?.kind.startsWith('power-')||!c||
    !['ratedW','capacityWh','chargeWh','efficiency','chargeLimitW','dischargeLimitW'].every(k=>finite(c[k]))||
    c.ratedW<0||c.ratedW>10000||c.capacityWh<0||c.capacityWh>100000||
    c.chargeWh<0||c.chargeWh>c.capacityWh||c.efficiency<0.5||c.efficiency>1||
    c.chargeLimitW<0||c.chargeLimitW>5000||c.dischargeLimitW<0||c.dischargeLimitW>10000||
    !['none','tripped','failed','low-battery'].includes(c.fault))throw new Error('Invalid power device configuration');
  }
  // Stage 7 access control: synthetic credentials and bounded virtual controller parameters.
  if(d.accessController!==undefined){const c=d.accessController;
   if(!c||!txt(c.doorWallId)||!Number.isSafeInteger(c.unlockSeconds)||c.unlockSeconds<1||c.unlockSeconds>60||
    !Number.isSafeInteger(c.heldOpenLimitSeconds)||c.heldOpenLimitSeconds<1||c.heldOpenLimitSeconds>600||
    !finite(c.supplyCapacityW)||c.supplyCapacityW<1||c.supplyCapacityW>250||typeof c.batteryEnabled!=='boolean'||
    !finite(c.batteryCapacityWh)||c.batteryCapacityWh<0||c.batteryCapacityWh>2000||
    !finite(c.batteryChargeWh)||c.batteryChargeWh<0||c.batteryChargeWh>c.batteryCapacityWh)throw new Error('Invalid access controller settings');
  }
  if(d.accessReader!==undefined){const c=d.accessReader;
   if(!c||!['card','pin','biometric'].includes(c.method)||c.method!==PROFILES.find(x=>x.id===d.profileId)?.accessReaderMethod||!['none','offline','tamper'].includes(c.fault))throw new Error('Invalid access reader');
  }
  if(d.accessLock!==undefined){const c=d.accessLock;
   if(!c||!['fail-safe','fail-secure'].includes(c.failMode)||!['none','stuck-locked','stuck-open'].includes(c.fault))throw new Error('Invalid electronic lock configuration');
  }
  if(d.addressMode!==undefined&&!['static','dhcp'].includes(d.addressMode))throw new Error('Invalid IP assignment mode');
  if(d.dns!==undefined&&!txt(d.dns))throw new Error('Invalid DNS field');
  if(d.vlanId!==undefined&&(!Number.isInteger(d.vlanId)||d.vlanId<1||d.vlanId>4094))throw new Error('Invalid VLAN ID');
  if(d.wifiEnabled!==undefined&&typeof d.wifiEnabled!=='boolean')throw new Error('Invalid Wi-Fi client flag');
  for(const k of ['wifiSsid','wifiKey'])if(d[k]!==undefined&&(typeof d[k]!=='string'||d[k].length>64))throw new Error('Invalid wireless client setting');
  if(d.routingEnabled!==undefined&&typeof d.routingEnabled!=='boolean')throw new Error('Invalid router forwarding flag');
  if(d.dnsEnabled!==undefined&&typeof d.dnsEnabled!=='boolean')throw new Error('Invalid DNS server flag');
  if(d.dnsRecords!==undefined){
   if(!Array.isArray(d.dnsRecords)||d.dnsRecords.length>24)throw new Error('Invalid DNS record count');
   for(const r of d.dnsRecords)if(!r||typeof r.hostname!=='string'||r.hostname.length>80||!txt(r.ip))throw new Error('Invalid DNS record');
  }
  if(d.portConfigs!==undefined){
   if(!Array.isArray(d.portConfigs)||d.portConfigs.length>48||new Set(d.portConfigs.map((v:{number:number})=>v.number)).size!==d.portConfigs.length)throw new Error('Invalid port configuration table');
   for(const v of d.portConfigs)if(!v||!Number.isInteger(v.number)||v.number<1||v.number>48||!['access','trunk'].includes(v.mode)||
    !Number.isInteger(v.accessVlan)||v.accessVlan<1||v.accessVlan>4094||!Number.isInteger(v.nativeVlan)||v.nativeVlan<1||v.nativeVlan>4094||
    !Array.isArray(v.allowedVlans)||v.allowedVlans.length>32||v.allowedVlans.some((n:number)=>!Number.isInteger(n)||n<1||n>4094)||
    !finite(v.speedMbps)||v.speedMbps<1||v.speedMbps>10000)throw new Error('Invalid VLAN switch port');
  }
  if(d.routerInterfaces!==undefined){
   if(!Array.isArray(d.routerInterfaces)||d.routerInterfaces.length>16||new Set(d.routerInterfaces.map((v:{vlanId:number})=>v.vlanId)).size!==d.routerInterfaces.length)throw new Error('Invalid router interfaces');
   for(const i of d.routerInterfaces)if(!i||!Number.isInteger(i.vlanId)||i.vlanId<1||i.vlanId>4094||!txt(i.ip)||!txt(i.mask))throw new Error('Invalid VLAN interface');
  }
  if(d.dhcpPools!==undefined){
   if(!Array.isArray(d.dhcpPools)||d.dhcpPools.length>8)throw new Error('Invalid DHCP pool count');
   for(const v of d.dhcpPools)if(!v||!Number.isInteger(v.vlanId)||v.vlanId<1||v.vlanId>4094||!['start','end','mask','gateway','dns'].every(k=>txt(v[k])))throw new Error('Invalid DHCP pool configuration');
  }
  if(d.routes!==undefined){
   if(!Array.isArray(d.routes)||d.routes.length>24)throw new Error('Invalid static route count');
   for(const r of d.routes)if(!r||!['destination','mask','nextHop'].every(k=>txt(r[k])))throw new Error('Invalid static route');
  }
  if(d.wireless!==undefined){const w=d.wireless;
   if(!w||typeof w.ssid!=='string'||w.ssid.length>32||typeof w.key!=='string'||w.key.length>64||
    !Number.isInteger(w.vlanId)||w.vlanId<1||w.vlanId>4094||!finite(w.rangeUnits)||w.rangeUnits<1||w.rangeUnits>5000||
    !Number.isInteger(w.maxClients)||w.maxClients<1||w.maxClients>50||!finite(w.bandwidthMbps)||w.bandwidthMbps<1||w.bandwidthMbps>1000)throw new Error('Invalid wireless AP settings');
  }
  if(d.recordingMode!==undefined&&!['continuous','motion','scheduled','off'].includes(d.recordingMode))throw new Error('Invalid camera recording mode');
  if(d.resolution!==undefined&&!['720p','1080p','1440p','4K'].includes(d.resolution))throw new Error('Invalid camera resolution');
  if(d.codec!==undefined&&!['H264','H265'].includes(d.codec))throw new Error('Invalid camera codec');
  for(const k of ['infraredEnabled','analogPowerConnected','storageFailed'])if(d[k]!==undefined&&typeof d[k]!=='boolean')throw new Error(`Invalid camera flag ${k}`);
  if(d.motionSensitivity!==undefined&&(d.motionSensitivity<0||d.motionSensitivity>100))throw new Error('Motion sensitivity must be 0–100');
  if(d.opticalZoom!==undefined&&(d.opticalZoom<1||d.opticalZoom>20))throw new Error('Invalid PTZ zoom');
  if(d.tiltDegrees!==undefined&&(d.tiltDegrees< -60||d.tiltDegrees>60))throw new Error('Invalid PTZ tilt');
  if(d.frameRate!==undefined&&(d.frameRate<1||d.frameRate>60))throw new Error('Invalid camera frame rate');
  if(d.bitrateMbps!==undefined&&(d.bitrateMbps<0.25||d.bitrateMbps>64))throw new Error('Invalid video bitrate');
  if(d.incomingMbps!==undefined&&(d.incomingMbps<0||d.incomingMbps>1000))throw new Error('Invalid recorder bandwidth');
  if(d.motionZones!==undefined){
   if(!Array.isArray(d.motionZones)||d.motionZones.length>8)throw new Error('Maximum eight motion zones per camera');
   if(new Set(d.motionZones.map((z:{id:string})=>z.id)).size!==d.motionZones.length)throw new Error('Duplicate motion-zone IDs');
   for(const z of d.motionZones)if(!z||!idTxt(z.id)||!txt(z.name)||!finite(z.x)||!finite(z.y)||!finite(z.w)||!finite(z.h)||z.w<=0||z.h<=0||z.w>1000||z.h>650||typeof z.enabled!=='boolean')throw new Error('Invalid camera detection zone');
  }
  if(d.recordingSchedule!==undefined){
   const q=d.recordingSchedule;
   if(!q||!Array.isArray(q.days)||q.days.length>7||new Set(q.days).size!==q.days.length||q.days.some((v:unknown)=>!Number.isInteger(v)||Number(v)<0||Number(v)>6)||
     !Number.isInteger(q.startMinute)||q.startMinute<0||q.startMinute>1439||!Number.isInteger(q.endMinute)||q.endMinute<0||q.endMinute>1440)throw new Error('Invalid weekly recording schedule');
  }
  if(d.ptzPresets!==undefined){
   if(!Array.isArray(d.ptzPresets)||d.ptzPresets.length>8||new Set(d.ptzPresets.map((v:{id:string})=>v.id)).size!==d.ptzPresets.length)throw new Error('Invalid PTZ presets');
   for(const v of d.ptzPresets)if(!v||!idTxt(v.id)||!txt(v.name)||!finite(v.heading)||!finite(v.opticalZoom)||v.opticalZoom<1||v.opticalZoom>20||!finite(v.tiltDegrees)||v.tiltDegrees< -60||v.tiltDegrees>60)throw new Error('Invalid PTZ preset value');
  }
 }
 const ids=new Set((p.devices as {id:string}[]).map(d=>d.id));
 if(ids.size!==p.devices.length)throw new Error('Duplicate equipment IDs');
 for(const c of p.cables){if(!c||!idTxt(c.id)||!idTxt(c.a)||!idTxt(c.b)||!ids.has(c.a)||!ids.has(c.b)||!finite(c.lengthMeters)||typeof c.connected!=='boolean'||(c.medium!==undefined&&!['ethernet','coax','alarm','access','power-ac','power-dc','power-pv'].includes(c.medium))||
   (c.aPort!==undefined&&(!Number.isInteger(c.aPort)||c.aPort<1||c.aPort>48))||
   (c.bPort!==undefined&&(!Number.isInteger(c.bPort)||c.bPort<1||c.bPort>48))||
   (c.speedMbps!==undefined&&(!finite(c.speedMbps)||c.speedMbps<1||c.speedMbps>10000))||
   (c.powerMaxAmps!==undefined&&(!finite(c.powerMaxAmps)||c.powerMaxAmps<=0||c.powerMaxAmps>200)))throw new Error('Invalid cable endpoint, port or bandwidth');}
 if(new Set((p.cables as {id:string}[]).map(c=>c.id)).size!==p.cables.length)throw new Error('Duplicate cable IDs');
 if(p.powerSettings!==undefined){const c=p.powerSettings as Record<string,unknown>;
  if(!c||!['legacy','wired'].includes(String(c.mode))||!finite(c.solarPercent)||Number(c.solarPercent)<0||Number(c.solarPercent)>100||
   !Number.isSafeInteger(c.virtualMinutes)||Number(c.virtualMinutes)<0||Number(c.virtualMinutes)>1000000000)throw new Error('Invalid virtual power clock or solar configuration');
 }
 if(p.alarmElapsedSec!==undefined&&(!Number.isSafeInteger(p.alarmElapsedSec)||Number(p.alarmElapsedSec)<0||Number(p.alarmElapsedSec)>1000000000))throw new Error('Invalid alarm virtual clock');
 if(p.alarmStates!==undefined){
  const states=p.alarmStates;
  if(!states||typeof states!=='object'||Array.isArray(states)||Object.keys(states).length>16)throw new Error('Invalid alarm panel runtime state');
  for(const [id,runtime] of Object.entries(states)){
   const panel=p.devices.find((d:{id:string;profileId:string})=>d.id===id);
   if(!panel||PROFILES.find(x=>x.id===panel.profileId)?.kind!=='alarm-panel')throw new Error('Alarm state refers to unknown panel');
   const a=runtime as Record<string,unknown>;
   if(!a||!['disarmed','stay','away'].includes(String(a.mode))||!['idle','exit','armed','entry','triggered'].includes(String(a.phase))||
    !Number.isSafeInteger(a.remainingSeconds)||Number(a.remainingSeconds)<0||Number(a.remainingSeconds)>3600||
    !Number.isSafeInteger(a.sirenSeconds)||Number(a.sirenSeconds)<0||Number(a.sirenSeconds)>900||
    (a.pendingZone!==undefined&&(!Number.isInteger(a.pendingZone)||Number(a.pendingZone)<1||Number(a.pendingZone)>32))||
    !Array.isArray(a.triggeredZones)||a.triggeredZones.length>32||a.triggeredZones.some((z:unknown)=>!Number.isInteger(z)||Number(z)<1||Number(z)>32))throw new Error('Invalid alarm runtime state');
  }
 }
 if(p.accessClock!==undefined){const c=p.accessClock as Record<string,unknown>;
  if(!c||!Number.isSafeInteger(c.day)||Number(c.day)<0||Number(c.day)>6||!Number.isSafeInteger(c.minute)||Number(c.minute)<0||Number(c.minute)>1439||!Number.isSafeInteger(c.second)||Number(c.second)<0||Number(c.second)>59)throw new Error('Invalid access virtual clock');
 }
 if(p.accessIdentities!==undefined){
  if(!Array.isArray(p.accessIdentities)||p.accessIdentities.length>100||new Set(p.accessIdentities.map((v:{id:string})=>v.id)).size!==p.accessIdentities.length)throw new Error('Invalid synthetic access identities');
  for(const c of p.accessIdentities){if(!c||!idTxt(c.id)||!txt(c.name)||typeof c.enabled!=='boolean'||
   !['cardToken','pinToken','biometricToken'].every(k=>typeof c[k]==='string'&&c[k].length<=64)||
   !Array.isArray(c.grants)||c.grants.length>24)throw new Error('Invalid access identity');
   for(const g of c.grants)if(!g||!idTxt(g.controllerId)||!p.devices.some((d:{id:string;profileId:string})=>d.id===g.controllerId&&PROFILES.find(v=>v.id===d.profileId)?.kind==='access-controller')||
    !Array.isArray(g.days)||g.days.length>7||new Set(g.days).size!==g.days.length||g.days.some((n:unknown)=>!Number.isInteger(n)||Number(n)<0||Number(n)>6)||
    !Number.isSafeInteger(g.startMinute)||g.startMinute<0||g.startMinute>1439||!Number.isSafeInteger(g.endMinute)||g.endMinute<0||g.endMinute>1440)throw new Error('Invalid access permission');
  }
 }
 if(p.accessDoorStates!==undefined){
  if(!p.accessDoorStates||typeof p.accessDoorStates!=='object'||Array.isArray(p.accessDoorStates)||Object.keys(p.accessDoorStates).length>200)throw new Error('Invalid access door runtime');
  for(const [wallId,state] of Object.entries(p.accessDoorStates) as [string,Record<string,unknown>][])if(!p.walls.some((w:{id:string;kind:string})=>w.id===wallId&&w.kind==='door')||
   !state||typeof state.open!=='boolean'||typeof state.forced!=='boolean'||typeof state.alarm!=='boolean'||
   !Number.isSafeInteger(state.unlockedSeconds)||Number(state.unlockedSeconds)<0||Number(state.unlockedSeconds)>60||
   !Number.isSafeInteger(state.heldOpenSeconds)||Number(state.heldOpenSeconds)<0||Number(state.heldOpenSeconds)>10000000)throw new Error('Invalid access door state');
 }
 if(p.accessLog!==undefined){
  if(!Array.isArray(p.accessLog)||p.accessLog.length>250||new Set(p.accessLog.map((v:{id:string})=>v.id)).size!==p.accessLog.length)throw new Error('Invalid access event log');
  for(const e of p.accessLog)if(!e||!idTxt(e.id)||!txt(e.at)||!Number.isFinite(Date.parse(String(e.at)))||!idTxt(e.controllerId)||!txt(e.reason)||
   !['card','pin','biometric','exit','open','close','time','fault'].includes(e.action)||!['granted','denied','alarm','info'].includes(e.decision)||
   !e.clock||!Number.isSafeInteger(e.clock.day)||e.clock.day<0||e.clock.day>6||!Number.isSafeInteger(e.clock.minute)||e.clock.minute<0||e.clock.minute>1439||
   !Number.isSafeInteger(e.clock.second)||e.clock.second<0||e.clock.second>59||(e.readerId!==undefined&&!idTxt(e.readerId))||(e.identityId!==undefined&&!idTxt(e.identityId)))throw new Error('Invalid access audit event');
 }
 for(const w of p.walls){if(!w||!idTxt(w.id)||!['wall','door','window'].includes(w.kind)||!['x1','x2','y1','y2'].every(k=>finite(w[k]))||(w.roomId!==undefined&&!idTxt(w.roomId)))throw new Error('Invalid wall/door record');}
 for(const r of p.rooms){if(!r||!idTxt(r.id)||!txt(r.name)||!validPoint(r)||!finite(r.w)||!finite(r.h))throw new Error('Invalid room record');}
 const roomIds=new Set((p.rooms as {id:string}[]).map(r=>r.id));
 for(const wall of p.walls)if(wall.roomId!==undefined&&!roomIds.has(wall.roomId))throw new Error('Wall belongs to unknown room');
 for(const t of p.targets){if(!t||!idTxt(t.id)||!txt(t.name)||!validPoint(t))throw new Error('Invalid target objective');}
 if(p.floorplanImage!==undefined&&(typeof p.floorplanImage!=='string'||p.floorplanImage.length>2_800_000||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(p.floorplanImage)))throw new Error('Unsafe or oversized floor-plan image');
 if(p.unitsPerMeter!==undefined&&(typeof p.unitsPerMeter!=='number'||!finite(p.unitsPerMeter)||p.unitsPerMeter<1||p.unitsPerMeter>100))throw new Error('Invalid property scale');
 if(p.siteElements!==undefined){
  if(!Array.isArray(p.siteElements)||p.siteElements.length>150)throw new Error('Too many site annotations');
  for(const marker of p.siteElements)if(!marker||!idTxt(marker.id)||!txt(marker.label)||!['entrance','gate','label'].includes(marker.kind)||!validPoint(marker))throw new Error('Invalid site annotation');
  if(new Set(p.siteElements.map((m:{id:string})=>m.id)).size!==p.siteElements.length)throw new Error('Duplicate site annotation IDs');
 }
 if(p.floorplanSettings!==undefined){const f=p.floorplanSettings as Record<string,unknown>|null;if(!f||typeof f!=='object'||!['x','y','width','height','opacity'].every(k=>finite(f[k]))||typeof f.width!=='number'||f.width<20||f.width>3000||typeof f.height!=='number'||f.height<20||f.height>1950||typeof f.x!=='number'||f.x< -1000||f.x>1000||typeof f.y!=='number'||f.y< -650||f.y>650||typeof f.opacity!=='number'||f.opacity<0||f.opacity>1||typeof f.locked!=='boolean')throw new Error('Invalid image reference transform');}
 // Stage 10 scenario provenance is bounded and deliberately persistent so a repair
 // cannot be claimed by deleting the original faulty cable or camera.
 if(p.scenarioState!==undefined){
  const state=p.scenarioState as Record<string,unknown>;
  if(!state||!Number.isInteger(state.definitionVersion)||Number(state.definitionVersion)<1||Number(state.definitionVersion)>100||
   typeof state.startedAt!=='string'||!Number.isFinite(Date.parse(state.startedAt))||
   !Array.isArray(state.challenges)||state.challenges.length>12)throw new Error('Invalid scenario exercise state');
  const challenges=state.challenges as Record<string,unknown>[];
  if(new Set(challenges.map(c=>c?.id)).size!==challenges.length)throw new Error('Duplicate scenario challenge identifiers');
  for(const c of challenges){if(!c||!idTxt(c.id)||!['cable-repair','ip-conflict','alarm-wire-repair'].includes(String(c.kind))||
   !txt(c.label)||!txt(c.hint)||(c.cableId!==undefined&&!idTxt(c.cableId))||(c.deviceId!==undefined&&!idTxt(c.deviceId))||
   (c.kind==='ip-conflict'&&!idTxt(c.deviceId))||(c.kind!=='ip-conflict'&&!idTxt(c.cableId)))throw new Error('Invalid tracked scenario challenge');}
 }
 if(p.assessments!==undefined){
  if(!Array.isArray(p.assessments)||p.assessments.length>50)throw new Error('Invalid assessment history');
  const ids=new Set<string>();
  const categories=['equipment','coverage','network','recording','alarm','access','power','reliability','troubleshooting'];
  for(const a of p.assessments){
   if(!a||!idTxt(a.id)||ids.has(a.id)||!txt(a.at)||!Number.isFinite(Date.parse(String(a.at)))||!SCENARIOS.some(s=>s.id===a.scenarioId)||!a.assessment||
    !Number.isInteger(a.assessment.score)||a.assessment.score<0||a.assessment.score>100||typeof a.assessment.passed!=='boolean'||
    !Array.isArray(a.assessment.rubric)||a.assessment.rubric.length>40||!Array.isArray(a.assessment.recommendations)||a.assessment.recommendations.length>50||
    a.assessment.recommendations.some((x:unknown)=>!txt(x)))throw new Error('Invalid assessment record');
   ids.add(a.id);
   if(a.projectId!==undefined&&!idTxt(a.projectId)||a.projectTitle!==undefined&&!txt(a.projectTitle)||
      a.source!==undefined&&a.source!=='local-simulation')throw new Error('Invalid assessment source metadata');
   for(const r of a.assessment.rubric)if(!r||!idTxt(r.id)||!txt(r.title)||!txt(r.details)||!finite(r.earned)||!finite(r.max)||r.earned<0||r.max<0||r.earned>r.max)throw new Error('Invalid assessment rubric');
   const v=a.assessment;
   if(v.version!==undefined&&v.version!==2||v.method!==undefined&&v.method!=='local-simulation'||
     v.scenarioVersion!==undefined&&(!Number.isSafeInteger(v.scenarioVersion)||v.scenarioVersion<1||v.scenarioVersion>100)||
     v.fingerprint!==undefined&&(typeof v.fingerprint!=='string'||!/^fnv32:[0-9a-f]{8}$/.test(v.fingerprint))||
     v.summary!==undefined&&!txt(v.summary)||v.level!==undefined&&!['not-yet-demonstrated','developing','criteria-not-met','simulated-proficiency'].includes(v.level))throw new Error('Invalid competency assessment metadata');
   if(v.areas!==undefined){
    if(!Array.isArray(v.areas)||v.areas.length>9)throw new Error('Invalid competency areas');
    for(const c of v.areas)if(!c||!categories.includes(c.id)||!txt(c.title)||!finite(c.earned)||!finite(c.max)||!finite(c.percent)||c.max<0||c.earned<0||c.earned>c.max||c.percent<0||c.percent>100||
      !Array.isArray(c.objectiveIds)||c.objectiveIds.length>40||c.objectiveIds.some((x:unknown)=>!idTxt(x)))throw new Error('Invalid competency area');
   }
   if(v.evidence!==undefined){
    if(!Array.isArray(v.evidence)||v.evidence.length>60)throw new Error('Invalid competency evidence');
    for(const e of v.evidence)if(!e||!idTxt(e.id)||!categories.includes(e.category)||!['scenario-rule','tracked-incident'].includes(e.source)||!txt(e.title)||!txt(e.details)||!finite(e.actual)||!finite(e.required)||
      e.required<0||e.actual<0||typeof e.met!=='boolean'||typeof e.critical!=='boolean')throw new Error('Invalid assessment evidence');
   }
   if(v.findings!==undefined){
    if(!Array.isArray(v.findings)||v.findings.length>60)throw new Error('Invalid competency findings');
    for(const f of v.findings)if(!f||!idTxt(f.id)||!categories.includes(f.category)||!['critical','major','minor','information'].includes(f.severity)||!txt(f.title)||!txt(f.description)||!txt(f.recommendation)||
      f.objectiveId!==undefined&&!idTxt(f.objectiveId))throw new Error('Invalid assessment finding');
   }
   if(v.gates!==undefined){
    if(!Array.isArray(v.gates)||v.gates.length>12)throw new Error('Invalid assessment pass gates');
    for(const g of v.gates)if(!g||!idTxt(g.id)||!txt(g.title)||!txt(g.description)||typeof g.met!=='boolean')throw new Error('Invalid assessment pass gate');
   }
  }
 }
 if(p.environment!==undefined){const e=p.environment as any;
  if(!e||!['clear','rain','fog','dust'].includes(e.weather)||!finite(e.ambientC)||e.ambientC<-40||e.ambientC>70||typeof e.glare!=='boolean')throw new Error('Invalid environment settings');
 }
 if(p.fieldReview!==undefined){
  // The import payload is untrusted until each field below is validated.
  const fr=p.fieldReview as any;
  const tasks=['property-editor','cctv-installation','network-troubleshooting','alarm-workflow','access-control','power-backup','file-reopen','offline-workflow','assessment-report'];
  if(!fr||fr.version!==1||!Array.isArray(fr.trials)||!Array.isArray(fr.issues)||fr.trials.length>120||fr.issues.length>120)throw new Error('Invalid field review');
  if(new Set(fr.trials.map((x:{id:string})=>x.id)).size!==fr.trials.length||new Set(fr.issues.map((x:{id:string})=>x.id)).size!==fr.issues.length)throw new Error('Duplicate field review identifiers');
  for(const t of fr.trials)if(!t||!idTxt(t.id)||!txt(t.at)||!Number.isFinite(Date.parse(t.at))||!['learner','technician','instructor'].includes(t.role)||
   !txt(t.platform)||!txt(t.browser)||!['low-spec','standard','other'].includes(t.deviceClass)||!finite(t.ramGb)||t.ramGb<0||t.ramGb>512||typeof t.offline!=='boolean'||
   !SCENARIOS.some(x=>x.id===t.scenarioId)||!tasks.includes(t.task)||!['completed','partial','blocked'].includes(t.outcome)||!finite(t.durationMinutes)||t.durationMinutes<0||t.durationMinutes>1440||
   typeof t.notes!=='string'||t.notes.length>1200)throw new Error('Invalid anonymous field trial');
  for(const i of fr.issues)if(!i||!idTxt(i.id)||!txt(i.at)||!Number.isFinite(Date.parse(i.at))||!['critical','major','minor'].includes(i.severity)||
   !['open','resolved','deferred'].includes(i.status)||!tasks.includes(i.area)||!txt(i.summary)||!idTxt(i.summary)||
   !['steps','expected','observed'].every(k=>typeof i[k]==='string'&&i[k].length<=1200)||
   (i.trialId!==undefined&&!fr.trials.some((t:{id:string})=>t.id===i.trialId)))throw new Error('Invalid field review finding');
 }
 if(p.simulationDay!==undefined&&(typeof p.simulationDay!=='number'||!Number.isInteger(p.simulationDay)||p.simulationDay<0||p.simulationDay>6))throw new Error('Invalid virtual day of week');
 if(p.simulationMinute!==undefined&&(typeof p.simulationMinute!=='number'||!Number.isInteger(p.simulationMinute)||p.simulationMinute<0||p.simulationMinute>1439))throw new Error('Invalid virtual clock minute');
 if(p.clips!==undefined){
  if(!Array.isArray(p.clips)||p.clips.length>500)throw new Error('Invalid clip metadata list');
  if(new Set(p.clips.map((c:{id:string})=>c.id)).size!==p.clips.length)throw new Error('Duplicate virtual clip IDs');
  for(const c of p.clips)if(!c||!idTxt(c.id)||!idTxt(c.cameraId)||!idTxt(c.recorderId)||!txt(c.at)||!Number.isFinite(Date.parse(String(c.at)))||
    !Number.isInteger(c.simulatedDay)||c.simulatedDay<0||c.simulatedDay>6||!Number.isInteger(c.simulatedMinute)||c.simulatedMinute<0||c.simulatedMinute>1439||
    !finite(c.durationSeconds)||c.durationSeconds<0||c.durationSeconds>86400||!finite(c.sizeGB)||c.sizeGB<0||c.sizeGB>1||!['motion','manual'].includes(c.kind)||
    (c.x!==undefined&&!finite(c.x))||(c.y!==undefined&&!finite(c.y)))throw new Error('Invalid virtual clip metadata');
 }
 if(typeof p.night!=='boolean'||typeof p.mainsOn!=='boolean'||typeof p.assisted!=='boolean')throw new Error('Invalid simulation state');
 for(const e of p.events)if(!e||!txt(e.id)||!txt(e.at)||!txt(e.message)||!['info','motion','recorded','fault','warning'].includes(e.kind)||typeof e.recorded!=='boolean')throw new Error('Invalid event log');
 if(!txt(p.createdAt)||!txt(p.updatedAt)||!Number.isFinite(Date.parse(String(p.createdAt)))||!Number.isFinite(Date.parse(String(p.updatedAt))))throw new Error('Invalid project timestamps');
 for(const [kind,records] of [['room',p.rooms],['wall',p.walls],['target',p.targets]] as const){
  const entries=records as {id:string}[];
  if(new Set(entries.map(e=>e.id)).size!==entries.length)throw new Error(`Duplicate ${kind} IDs`);
 }
 return structuredClone(input as Project);
}
