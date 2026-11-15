/**
 * Feature 8: guided lessons. Progress is DERIVED from the project and simulation engine, never self-reported,
 * so a step is only "done" when the installation really satisfies it. Each step carries a hint and a "why".
 */
import type {Project,SimResult} from '../domain/types.js';
import {profile} from '../domain/catalog.js';
import {simulate} from '../engine/simulator.js';

export type LessonStep={id:string;title:string;instruction:string;why:string;hint:string;check:(p:Project,r:SimResult)=>boolean};
export type Lesson={id:string;title:string;level:'beginner'|'intermediate'|'advanced';scenarioId:string;summary:string;steps:LessonStep[]};

const kinds=(p:Project,k:string)=>p.devices.filter(d=>profile(d.profileId).kind===k);
const ipCams=(p:Project)=>kinds(p,'camera').filter(d=>profile(d.profileId).signal!=='analog');
const linked=(p:Project,a:string,b:string)=>p.cables.some(c=>c.connected&&((c.a===a&&c.b===b)||(c.a===b&&c.b===a)));
const anyLink=(p:Project,ka:string,kb:string)=>kinds(p,ka).some(a=>kinds(p,kb).some(b=>linked(p,a.id,b.id)));

export const LESSONS:Lesson[]=[
 {id:'first-camera',title:'Your first PoE camera and recorder',level:'beginner',scenarioId:'home4',summary:'Power, connect and record from one IP camera.',steps:[
  {id:'switch',title:'Place a PoE switch',instruction:'Choose a PoE switch from the Equipment Library and click the plan to place it.',why:'A PoE switch carries data and power over one cable, so the camera needs no separate power supply.',hint:'Search "PoE" in the library. Check that it has enough PoE budget (watts) for your cameras.',check:p=>kinds(p,'switch').length>=1},
  {id:'nvr',title:'Place an NVR',instruction:'Place a network video recorder (NVR).',why:'The NVR stores video from IP cameras and must be on the same network as them.',hint:'NVR = network recorder. A DVR is for analog coax cameras.',check:p=>kinds(p,'nvr').length>=1},
  {id:'camera',title:'Place an IP camera covering the entrance',instruction:'Place an IP camera and point it at the main entrance target.',why:'Coverage depends on position, heading, field of view and walls.',hint:'Turn on "coverage" in the toolbar and rotate the camera until the green zone reaches the target.',check:(p,r)=>ipCams(p).length>=1&&r.coverage.some(c=>c.covered)},
  {id:'cable-cam',title:'Cable the camera to the switch',instruction:'Use the Cable tool: click the camera then the switch.',why:'Without a cable the camera has neither data nor PoE power.',hint:'Select the Cable tool, click the first device, then the second.',check:p=>anyLink(p,'camera','switch')},
  {id:'cable-nvr',title:'Cable the switch to the NVR',instruction:'Connect the switch to the NVR.',why:'The NVR must be reachable over the network to record.',hint:'Same Cable tool; use any free switch port.',check:p=>anyLink(p,'switch','nvr')},
  {id:'online',title:'Camera online and recording-ready',instruction:'Open Diagnostics and fix anything that stops the camera being online and ready to record.',why:'Power, addressing and recorder channels must all be right.',hint:'Check IP addresses are on the same subnet and the PoE budget is not exceeded.',check:(p,r)=>ipCams(p).some(c=>r.devices[c.id]?.powered&&r.devices[c.id]?.networkOk&&r.devices[c.id]?.recordingReady)},
  {id:'event',title:'Record a motion event',instruction:'Switch to Test Motion and click inside the camera view.',why:'Proves the whole chain works, not just the cabling.',hint:'Night mode shortens range unless infrared is on.',check:p=>(p.clips||[]).length>=1},
 ]},
 {id:'vlan-dhcp',title:'VLANs, DHCP and routing',level:'intermediate',scenarioId:'ip-network',summary:'Put cameras on their own VLAN and route to the NVR.',steps:[
  {id:'router',title:'Place a router',instruction:'Place a VLAN-capable router.',why:'Different VLANs only talk to each other through a router.',hint:'Look for "VLAN" in the router name.',check:p=>kinds(p,'router').length>=1},
  {id:'managed',title:'Place a managed switch',instruction:'Place a managed switch (not the basic one).',why:'Only managed switches let you assign VLANs and trunks.',hint:'Names with "Managed".',check:p=>kinds(p,'switch').some(d=>profile(d.profileId).managed)},
  {id:'trunk',title:'Create a trunk to the router',instruction:'Cable switch to router and set that switch port to trunk carrying VLANs 10 and 20.',why:'A trunk carries several VLANs over one link.',hint:'Use the Network CLI: interface port 1 / switchport mode trunk.',check:p=>kinds(p,'switch').some(d=>d.portConfigs?.some(c=>c.mode==='trunk'&&c.allowedVlans.length>=2))},
  {id:'cam-vlan',title:'Move a camera to VLAN 20',instruction:'Give an IP camera VLAN 20 and a matching access port.',why:'Segmenting cameras limits what other devices can reach them.',hint:'Camera: vlan 20. Switch port: access vlan 20.',check:p=>ipCams(p).some(d=>d.vlanId===20)},
  {id:'dhcp',title:'Get a DHCP lease',instruction:'Add a DHCP pool for VLAN 20 on the router and set the camera to DHCP.',why:'DHCP hands out addresses automatically.',hint:'ip dhcp pool vlan 20 range ... ; camera: ip address dhcp.',check:(p,r)=>Object.keys(r.network?.dhcpLeases||{}).length>=1},
  {id:'route',title:'Reach the NVR across VLANs',instruction:'Make a VLAN 20 camera reach the NVR on VLAN 10 (use Packet trace to confirm).',why:'Proves the router and gateways are right.',hint:'Gateways must point at the router interface of their own VLAN.',check:(p,r)=>Object.values(r.network?.traces||{}).some(t=>t.ok&&!!t.viaRouter)},
 ]},
 {id:'alarm-basics',title:'Intrusion alarm commissioning',level:'intermediate',scenarioId:'alarm-install',summary:'Wire, arm and test a panel with a siren.',steps:[
  {id:'panel',title:'Powered alarm panel',instruction:'Place an alarm panel and give it power.',why:'The panel is the brain of the system.',hint:'Use the alarm practice rig button if you need a starting layout.',check:(p,r)=>Object.values(r.alarm?.panels||{}).some(a=>a.powered)},
  {id:'sensors',title:'Two working sensors',instruction:'Wire at least two sensors to the panel.',why:'Zones need detectors.',hint:'Alarm cables are a separate medium from Ethernet.',check:(p,r)=>kinds(p,'alarm-sensor').filter(d=>r.alarm?.devices[d.id]?.powered&&r.alarm?.devices[d.id]?.wired).length>=2},
  {id:'keypad',title:'Keypad',instruction:'Wire a keypad.',why:'You cannot arm or disarm without one.',hint:'Default classroom PIN is 1234.',check:(p,r)=>kinds(p,'alarm-keypad').some(d=>r.alarm?.devices[d.id]?.powered&&r.alarm?.devices[d.id]?.wired)},
  {id:'arm',title:'Arm the system',instruction:'Arm away and wait out the exit delay.',why:'Exit delay lets you leave without a false alarm.',hint:'Advance the alarm clock past the exit delay.',check:(p,r)=>Object.values(r.alarm?.panels||{}).some(a=>a.powered&&a.mode!=='disarmed'&&a.phase!=='exit')},
  {id:'trip',title:'Trip a sensor',instruction:'Trigger a stimulus in front of a sensor.',why:'Confirms detection and the alarm state machine.',hint:'Use the Alarm tab test controls.',check:(p,r)=>Object.values(r.alarm?.panels||{}).some(a=>a.phase==='triggered')},
 ]},
 {id:'door-access',title:'Door access control',level:'beginner',scenarioId:'rfid-access',summary:'Wire a reader and lock and test credentials.',steps:[
  {id:'controller',title:'Powered controller',instruction:'Place an access controller on a door.',why:'It decides who may enter.',hint:'Use the access practice rig as a starting point.',check:(p,r)=>Object.values(r.access?.controllers||{}).some(c=>c.powered)},
  {id:'door',title:'Assign the door',instruction:'Assign a door, one lock and a reader to the controller.',why:'A controller with no door does nothing.',hint:'Set the door wall in the controller settings.',check:(p,r)=>Object.values(r.access?.controllers||{}).some(c=>c.powered&&!!c.door&&c.lockIds.length===1&&c.connectedReaderIds.length>0)},
  {id:'grant',title:'A valid credential opens the door',instruction:'Create a credential and present it.',why:'Authorised users must be let in.',hint:'Add a synthetic credential and give it a grant for the controller.',check:p=>(p.accessLog||[]).some(e=>e.decision==='granted'&&['card','pin','biometric'].includes(e.action))},
  {id:'deny',title:'An unknown credential is refused',instruction:'Present an unknown token.',why:'Unauthorised users must be refused.',hint:'Use any token that is not on a credential.',check:p=>(p.accessLog||[]).some(e=>e.decision==='denied'&&['card','pin','biometric'].includes(e.action))},
 ]},
];

export type LessonProgress={lesson:Lesson;done:boolean[];completed:number;currentIndex:number;finished:boolean};
export function lessonProgress(project:Project,lesson:Lesson,result:SimResult=simulate(project)):LessonProgress{
 const done=lesson.steps.map(s=>{try{return !!s.check(project,result);}catch{return false;}});
 const first=done.findIndex(d=>!d);
 return {lesson,done,completed:done.filter(Boolean).length,currentIndex:first<0?lesson.steps.length:first,finished:first<0};
}
export const lessonById=(id:string)=>LESSONS.find(l=>l.id===id);
