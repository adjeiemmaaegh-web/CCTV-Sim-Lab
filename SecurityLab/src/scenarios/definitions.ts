import type {DeviceKind,Scenario,ScenarioObjective,Target,Room,Wall} from '../domain/types.js';

// Versioned, local-first educational scenario content. Costs are synthetic training assumptions
// in GHS, not supplier quotations. Measurements are schematic canvas units.
const box=(id:string,x:number,y:number,w:number,h:number):Wall[]=>[
 {id:`${id}-north`,kind:'wall',x1:x,y1:y,x2:x+w,y2:y},
 {id:`${id}-east`,kind:'wall',x1:x+w,y1:y,x2:x+w,y2:y+h},
 {id:`${id}-south`,kind:'wall',x1:x+w,y1:y+h,x2:x,y2:y+h},
 {id:`${id}-west`,kind:'wall',x1:x,y1:y+h,x2:x,y2:y}
];
const point=(id:string,name:string,x:number,y:number):Target=>({id,name,x,y,required:true});
const room=(id:string,name:string,x:number,y:number,w:number,h:number):Room=>({id,name,x,y,w,h});
const objective=(id:string,title:string,metric:ScenarioObjective['metric'],weight:number,minimum=1,critical=true,deviceKind?:DeviceKind):ScenarioObjective=>({id,title,metric,weight,minimum,critical,...(deviceKind?{deviceKind}:{})});
const cctvKinds:DeviceKind[]=['camera','switch','nvr','dvr','router','ap','server','power-grid','power-ups','power-ac-panel','power-psu'];
const networkKinds:DeviceKind[]=['camera','switch','nvr','router','ap','server','power-grid','power-ups','power-ac-panel'];
const alarmKinds:DeviceKind[]=['alarm-panel','alarm-sensor','alarm-output','alarm-keypad','power-grid','power-psu','power-ac-panel','power-ups'];
const accessKinds:DeviceKind[]=['access-controller','access-reader','access-lock','access-exit','access-server','power-grid','power-psu','power-ac-panel'];
const powerKinds:DeviceKind[]=['power-grid','power-solar','power-controller','power-battery','power-inverter','power-ups','power-psu','power-ac-panel','power-dc-panel','camera','switch','nvr','router','ap'];
const fourCctv=(n:number):ScenarioObjective[]=>[
 objective('equipment','Correct camera count and compatible devices','camera-count',10,n),
 objective('power','Cameras receive usable power','camera-powered',15,n),
 objective('network','Operational camera signal paths','camera-online',15,n),
 objective('coverage','Required locations covered','target-coverage',20,1),
 objective('recording','Recorder channels and storage active','camera-recording',15,n),
 objective('evidence','Produce real simulated recording evidence','recorded-event',10),
 objective('fault-free','Resolve technical installation faults','technical-health',10),
 objective('budget','Stay within the installation budget','within-budget',5)
];

export const SCENARIOS:Scenario[]=[
 {
  id:'home4',version:1,focus:'cctv',difficulty:'beginner',title:'01 · Four-camera home',description:'Design a four-camera residential IP CCTV installation with PoE and an NVR.',
  instructions:['Inspect all four required locations.','Install four IP cameras with a compatible PoE switch and NVR.','Connect, configure, test motion recording and resolve coverage gaps.'],
  minCameras:4,budgetGhs:5000,baseline:'empty',allowedKinds:cctvKinds,objectives:fourCctv(4),starterProfiles:['cam-bullet','cam-dome','switch-4','nvr-4'],
  targets:[point('gate','Front gate',150,135),point('drive','Driveway',780,140),point('garden','Garden',720,510),point('side','Side passage',135,500)],
  rooms:[room('living','Living room',290,225,270,160),room('bed','Bedroom',560,225,160,160)],
  walls:[...box('property',75,65,790,520).filter((_,i)=>i!==0),{id:'p-front-left',kind:'wall',x1:75,y1:65,x2:425,y2:65},{id:'p-front-right',kind:'wall',x1:515,y1:65,x2:865,y2:65},{id:'room-sep',kind:'wall',x1:540,y1:230,x2:540,y2:390}]
 },
 {
  id:'home8',version:1,focus:'cctv',difficulty:'intermediate',title:'02 · Eight-camera residence',description:'Protect an extended residential compound with eight operational CCTV views.',
  instructions:['Cover every required exterior and interior location.','Dimension PoE and NVR ports for eight cameras.','Verify night-time visibility and create recording evidence.'],
  minCameras:8,budgetGhs:12000,baseline:'empty',allowedKinds:cctvKinds,starterProfiles:['cam-bullet','cam-turret','cam-dome','switch-8','nvr-8'],
  objectives:[...fourCctv(8).filter(o=>o.id!=='fault-free'),objective('night','Confirm critical night-time visibility','night-coverage',5),objective('fault-free','Correct all installation faults','technical-health',5)],
  targets:[point('gate','Front entrance',130,125),point('drive','Vehicle gate',795,125),point('porch','Entrance porch',455,165),point('lounge','Living area',360,310),point('corridor','Corridor',565,300),point('yard','Rear yard',760,530),point('west','West perimeter',120,440),point('store','Storage annex',585,495)],
  rooms:[room('hall','Lounge',250,215,245,205),room('sleep','Bedrooms',520,215,260,205),room('annex','Storage annex',500,440,210,100)],
  walls:[...box('home8',70,70,800,535).filter((_,i)=>i!==0),{id:'home8-n1',kind:'wall',x1:70,y1:70,x2:425,y2:70},{id:'home8-n2',kind:'wall',x1:510,y1:70,x2:870,y2:70}]
 },
 {
  id:'shop3',version:1,focus:'cctv',difficulty:'beginner',title:'03 · Commercial shop',description:'Protect a retail entrance, cash desk and stockroom within a controlled budget.',
  instructions:['Cover customer access and cash-handling locations.','Select affordable cameras, a compatible recorder and transmission paths.','Confirm recorded event evidence.'],
  minCameras:3,budgetGhs:4000,baseline:'empty',allowedKinds:cctvKinds,starterProfiles:['cam-bullet','cam-analog-bullet','dvr-4','switch-4','nvr-4'],objectives:fourCctv(3),
  targets:[point('entry','Customer entrance',185,130),point('cash','Cash register',620,310),point('stock','Stockroom',730,505)],
  rooms:[room('front','Sales floor',170,145,530,305),room('back','Stockroom',700,405,170,155)],
  walls:[...box('shop',85,65,800,515).filter((_,i)=>i!==0),{id:'door-left',kind:'wall',x1:85,y1:65,x2:170,y2:65},{id:'door-right',kind:'wall',x1:255,y1:65,x2:885,y2:65},{id:'stock-sep',kind:'wall',x1:700,y1:410,x2:700,y2:485}]
 },
 {
  id:'warehouse8',version:1,focus:'cctv',difficulty:'advanced',title:'04 · Warehouse surveillance',description:'Cover aisles, loading bays, stock and pedestrian entrances in a larger property.',
  instructions:['Identify the loading, high-value stock and aisle targets.','Design a suitable eight-camera network.','Verify all cameras record and demonstrate operational night monitoring.'],
  minCameras:8,budgetGhs:17500,baseline:'empty',allowedKinds:cctvKinds,starterProfiles:['cam-4k','cam-ptz','cam-bullet','switch-8','nvr-8'],
  objectives:[...fourCctv(8).filter(o=>o.id!=='fault-free'),objective('night','Night monitoring readiness','night-coverage',5),objective('fault-free','No outstanding video path defects','technical-health',5)],
  targets:[point('dock1','Loading bay A',165,130),point('dock2','Loading bay B',420,130),point('dock3','Loading bay C',735,130),point('rack1','Storage aisle 1',245,310),point('rack2','Storage aisle 2',455,310),point('rack3','Storage aisle 3',670,320),point('exit','Pedestrian exit',185,535),point('office','Dispatch office',760,520)],
  rooms:[room('warehouse','Warehouse floor',140,155,665,360),room('office','Dispatch office',690,445,125,120)],
  walls:[...box('warehouse',70,65,800,535).filter((_,i)=>i!==0),{id:'warehouse-a',kind:'wall',x1:70,y1:65,x2:420,y2:65},{id:'warehouse-b',kind:'wall',x1:525,y1:65,x2:870,y2:65}]
 },
 {
  id:'alarm-install',version:1,focus:'alarm',difficulty:'intermediate',title:'05 · Intrusion alarm installation',description:'Install and commission a wired intrusion alarm across entry and interior zones.',
  instructions:['Install a panel, at least three working detectors, a keypad and siren.','Connect real simulated alarm circuits and assign zones.','Arm the system, let exit delay finish, then trigger a detector and verify the output.'],
  minCameras:0,budgetGhs:5500,baseline:'empty',allowedKinds:alarmKinds,starterProfiles:['alarm-panel-8','alarm-door','alarm-pir','alarm-glass','alarm-keypad','alarm-siren'],
  objectives:[objective('panel','Alarm panel operational','alarm-panel',15),objective('sensors','Three powered wired detectors','alarm-sensors',20,3),objective('keypad','A functioning panel keypad','alarm-keypad',10),objective('arm','Successfully arm intrusion zones','alarm-armed',15),objective('trip','Prove an armed sensor initiated an alarm','alarm-triggered',20),objective('siren','Verify siren output activates','alarm-output',10),objective('budget','Meet equipment allowance','within-budget',10)],
  targets:[point('front','Front entry',485,120),point('interior','Main corridor',450,340),point('rear','Back entrance',755,535)],rooms:[room('sales','Office and reception',190,160,520,225),room('store','Storage room',450,395,270,135)],walls:[...box('alarm',85,65,790,525)]
 },
 {
  id:'ip-network',version:1,focus:'network',difficulty:'advanced',title:'06 · IP camera network configuration',description:'Configure DHCP, switching, routing and video transport between cameras and NVR.',
  instructions:['Install two IP cameras, an NVR, managed switch and router.','Set up a DHCP pool and get a valid camera lease.','Demonstrate routed connectivity between VLANs and record at least one event.'],
  minCameras:2,budgetGhs:7500,baseline:'empty',allowedKinds:networkKinds,starterProfiles:['cam-bullet','switch-managed-8','router-vlan','nvr-4','server-dns'],
  objectives:[objective('cameras','At least two IP cameras installed','camera-count',10,2),objective('path','Two cameras online','camera-online',20,2),objective('record','Camera recorder connectivity','camera-recording',15,2),objective('router','Powered routing equipment','router-ready',10),objective('dhcp','Successful DHCP lease','dhcp-lease',15),objective('route','Working inter-VLAN route','intervlan-route',15),objective('evidence','Stored motion event','recorded-event',5),objective('budget','Stay inside budget','within-budget',10)],
  targets:[point('gate','Gate',205,185),point('office','Office',670,310)],rooms:[room('office','Network lab office',240,220,465,260)],walls:[...box('net',110,80,720,510)]
 },
 {
  id:'rfid-access',version:1,focus:'access',difficulty:'intermediate',title:'07 · RFID door access control',description:'Wire a reader, controller, electric lock and exit button to a managed door.',
  instructions:['Assign a controller to the physical door opening.','Wire RFID reader, lock and exit button to the controller.','Create synthetic credentials and demonstrate both allowed and denied requests.'],
  minCameras:0,budgetGhs:5500,baseline:'empty',allowedKinds:accessKinds,starterProfiles:['access-controller-1','access-reader-card','access-maglock','access-exit-button'],
  objectives:[objective('controller','Powered access control panel','access-controller',15),objective('reader','Authorized reader circuit','access-readers',15),objective('lock','Wired electric lock','access-lock',15),objective('door','Physical door assigned','access-door',10),objective('grant','Prove an authorized card event','access-granted',15),objective('deny','Prove an unauthorized card event','access-denied',10),objective('exit','Verify request-to-exit','access-exit',10),objective('budget','Meet budget','within-budget',10)],
  targets:[],rooms:[room('lobby','Reception',180,155,330,365),room('restricted','Restricted office',510,155,255,365)],
  walls:[...box('access',80,70,800,530),{id:'access-split-a',kind:'wall',x1:510,y1:155,x2:510,y2:305},{id:'access-controlled-door',kind:'door',x1:510,y1:305,x2:510,y2:360},{id:'access-split-b',kind:'wall',x1:510,y1:360,x2:510,y2:520}]
 },
 {
  id:'solar-backup',version:1,focus:'power',difficulty:'advanced',title:'08 · Solar-backed security installation',description:'Build a solar, battery, inverter and UPS-supported surveillance design.',
  instructions:['Connect PV, charge controller, battery, inverter and AC distribution with valid wires.','Provide real simulated power to a camera, switch and NVR.','Disconnect the grid and prove the system remains operational on battery backup.'],
  minCameras:1,budgetGhs:15000,baseline:'empty',allowedKinds:powerKinds,starterProfiles:['power-solar','power-controller','power-battery','power-inverter','power-ups','power-ac-panel','switch-4','nvr-4','cam-bullet'],
  objectives:[objective('strict','Explicit wired electrical model','power-wired',15),objective('solar','Solar PV output available','solar-generation',15),objective('battery','Stored energy available','battery-ready',15),objective('camera','Powered surveillance camera','camera-powered',10),objective('record','Working video recording','camera-recording',10),objective('outage','Backup operates during grid outage','backup-outage',25),objective('budget','Within system budget','within-budget',10)],
  targets:[point('perimeter','Compound entrance',280,140)],rooms:[room('equipment','Power equipment room',405,290,255,185)],walls:[...box('power',90,80,745,505)]
 },
 {
  id:'diagnose4',version:1,focus:'cctv',difficulty:'intermediate',title:'09 · Diagnose failed CCTV',description:'Troubleshoot a pre-installed four-camera system with hidden cable and IP faults.',
  instructions:['Inspect the initially installed equipment and identify problems.','Repair the original broken cable and duplicate IP configuration rather than deleting devices.','Confirm all four cameras record and run a motion verification.'],
  minCameras:4,budgetGhs:5600,baseline:'faulty',allowedKinds:cctvKinds,starterProfiles:['cam-bullet','switch-4','nvr-4'],
  objectives:[...fourCctv(4).filter(o=>o.id!=='fault-free'),objective('repair','Repair all original incident faults','resolved-challenges',10)],
  targets:[point('t1','Loading bay',170,160),point('t2','Front counter',790,155),point('t3','Rear storeroom',770,505),point('t4','Side entrance',155,505)],
  rooms:[room('work','Workshop',270,210,410,230)],walls:[...box('depot',75,70,790,510).filter((_,i)=>i!==0)]
 },
 {
  id:'perimeter',version:1,focus:'mixed',difficulty:'advanced',title:'10 · Investigate perimeter intrusion',description:'Repair a perimeter alarm circuit and investigate a simulated intrusion with CCTV evidence.',
  instructions:['Inspect the pre-installed perimeter rig and repair its damaged beam circuit.','Arm the panel, let the exit delay finish and trigger the perimeter beam.','Record or inspect CCTV evidence and confirm siren operation.'],
  minCameras:1,budgetGhs:8500,baseline:'starter',allowedKinds:[...new Set<DeviceKind>([...cctvKinds,...alarmKinds])],starterProfiles:['alarm-panel-8','alarm-beam','alarm-keypad','alarm-siren','cam-bullet','switch-4','nvr-4'],
  objectives:[objective('alarm','Powered intrusion panel','alarm-panel',10),objective('wire','Repair initial perimeter fault','resolved-challenges',15),objective('sensor','Active perimeter beam detector','alarm-beam',15),objective('arm','Arm the perimeter','alarm-armed',10),objective('trip','Detect a real simulated intrusion','alarm-triggered',15),objective('output','Sound a siren','alarm-output',10),objective('camera','Camera covers relevant target','target-coverage',10),objective('evidence','Capture camera recording evidence','recorded-event',10),objective('budget','Stay within budget','within-budget',5)],
  targets:[point('north','Northern boundary',465,120)],rooms:[room('security','Security control room',380,365,250,160)],walls:[...box('perimeter',75,65,800,525)]
 },
 {
  id:'school-block',version:1,focus:'cctv',difficulty:'intermediate',title:'11 · School block surveillance',description:'Cover the gate, corridors and playground edge of a small school block with six recorded cameras.',
  instructions:['Install PoE switch capacity for six cameras and an NVR.','Cover the gate, both corridor ends, the playground edge, the office door and the store.','Prove recording with a stored motion event and keep within budget.'],
  minCameras:6,budgetGhs:16000,baseline:'empty',allowedKinds:cctvKinds,starterProfiles:['cam-bullet','cam-dome','switch-8','nvr-8'],
  objectives:fourCctv(6),
  targets:[point('gate','School gate',150,130),point('corr-w','West corridor end',210,330),point('corr-e','East corridor end',720,330),point('play','Playground edge',470,545),point('office','Office door',470,175),point('store','Store room',760,520)],
  rooms:[room('block','Classroom block',240,200,470,250),room('office-r','Office',390,150,160,60)],walls:[...box('school',90,80,790,520)]
 },
 {
  id:'hospital-ward',version:1,focus:'mixed',difficulty:'advanced',title:'12 · Hospital ward security',description:'Secure a ward: cameras on the corridor and entrance plus a controlled staff door.',
  instructions:['Install three recorded cameras covering the ward entrance, corridor and nurses station.','Install an access controller, reader and lock on the staff door and test a valid and an invalid credential.','Keep the installation within budget; patient safety means locks must fail safe.'],
  minCameras:3,budgetGhs:32000,baseline:'empty',allowedKinds:[...new Set<DeviceKind>([...cctvKinds,...accessKinds])],starterProfiles:['cam-dome','switch-8','nvr-4','access-controller-1','access-reader-card','access-maglock','access-exit-button'],
  objectives:[objective('cams','Three cameras installed','camera-count',8,3),objective('power','Cameras powered','camera-powered',8,3),objective('online','Cameras online','camera-online',10,3),objective('cover','Entrance, corridor and station covered','target-coverage',14),objective('rec','Recording active','camera-recording',10,3),objective('ctrl','Access controller operational','access-controller',8),objective('door','Controlled door fully wired','access-door',10),objective('grant','Valid credential admitted','access-granted',10),objective('deny','Invalid credential refused','access-denied',10),objective('budget','Within budget','within-budget',2)],
  targets:[point('entrance','Ward entrance',160,320),point('corridor','Ward corridor',470,330),point('station','Nurses station',760,320)],
  rooms:[room('ward','Ward corridor',200,280,570,110),room('staff','Staff room',420,150,200,100)],walls:[...box('ward',90,90,790,500),{id:'staff-door',kind:'door',x1:470,y1:250,x2:530,y2:250}]
 },
 {
  id:'market-kiosk-gh',version:1,focus:'mixed',difficulty:'advanced',title:'13 · Market kiosk with power cuts (Ghana context)',description:'Protect a market kiosk with cameras and an alarm that must keep working through grid outages using solar and battery.',
  instructions:['Install two recorded cameras and a wired alarm with a siren.','Build a solar, battery and inverter supply feeding the equipment.','Prove it keeps recording on battery when the grid is off. Prices are training placeholders, not supplier quotes; exercise content has not been reviewed by local technicians.'],
  minCameras:2,budgetGhs:20000,baseline:'empty',allowedKinds:[...new Set<DeviceKind>([...cctvKinds,...alarmKinds,...powerKinds])],starterProfiles:['cam-bullet','switch-4','nvr-4','alarm-panel-8','alarm-pir','alarm-keypad','alarm-siren','power-solar','power-controller','power-battery','power-inverter'],
  objectives:[objective('cams','Two cameras installed','camera-count',8,2),objective('power','Cameras powered','camera-powered',8,2),objective('rec','Recording ready','camera-recording',10,2),objective('panel','Alarm panel powered','alarm-panel',8),objective('sens','Two working detectors','alarm-sensors',8,2),objective('siren','Siren output','alarm-output',6),objective('wired','Explicit wired power model','power-wired',10),objective('solar','Solar generation','solar-generation',10),objective('batt','Battery ready','battery-ready',10),objective('outage','Runs on battery in an outage','backup-outage',17),objective('budget','Within budget','within-budget',5)],
  targets:[point('counter','Counter',300,300),point('shutter','Shutter door',620,200)],rooms:[room('kiosk','Kiosk',250,220,460,200)],walls:[...box('kiosk',120,100,700,420)]
 },
 {
  id:'church-compound-gh',version:1,focus:'mixed',difficulty:'advanced',title:'14 · Church compound perimeter (Ghana context)',description:'Secure a compound perimeter with a beam, a siren and three cameras at the gate and boundary.',
  instructions:['Install a panel, keypad, perimeter beam and siren; arm the system and prove a beam crossing raises the alarm.','Install three recorded cameras covering the gate, the north boundary and the main door.','Stay within budget. Content is for training and has not been reviewed by local technicians.'],
  minCameras:3,budgetGhs:26000,baseline:'empty',allowedKinds:[...new Set<DeviceKind>([...cctvKinds,...alarmKinds])],starterProfiles:['alarm-panel-8','alarm-beam','alarm-keypad','alarm-siren','alarm-fence','cam-bullet','switch-4','nvr-4'],
  objectives:[objective('cams','Three cameras installed','camera-count',8,3),objective('online','Cameras online','camera-online',10,3),objective('cover','Gate, boundary and door covered','target-coverage',14),objective('rec','Recording active','camera-recording',8,3),objective('panel','Alarm panel powered','alarm-panel',8),objective('beam','Perimeter beam active','alarm-beam',10),objective('key','Keypad installed','alarm-keypad',6),objective('arm','System armed','alarm-armed',10),objective('trip','Beam crossing raised an alarm','alarm-triggered',14),objective('siren','Siren activated','alarm-output',8),objective('budget','Within budget','within-budget',4)],
  targets:[point('gate','Main gate',160,310),point('north','North boundary',470,120),point('door','Church main door',760,330)],rooms:[room('hall','Church hall',560,250,230,180)],walls:[...box('compound',90,80,790,510)]
 },
 {
  id:'office-fire',version:1,focus:'alarm',difficulty:'intermediate',title:'15 · Office fire detection',description:'Install and commission a training fire-detection loop: detectors, call point and sounder on a 24-hour zone.',
  instructions:['Install a panel, keypad, three smoke or heat detectors, one manual call point and a sounder.','Set every fire device to a 24-hour zone so it works while the building is unarmed.','Trigger smoke at a detector and prove the sounder activates. Training model only: not EN 54 or any code-compliance certification.'],
  minCameras:0,budgetGhs:7000,baseline:'empty',allowedKinds:alarmKinds,starterProfiles:['alarm-panel-8','alarm-keypad','alarm-smoke','alarm-heat','alarm-callpoint','alarm-sounder'],
  objectives:[objective('panel','Panel operational','alarm-panel',12),objective('key','Keypad installed','alarm-keypad',6),objective('det','Three wired detectors','fire-detectors',18,3),objective('cp','Manual call point','fire-callpoint',10),objective('snd','Sounder installed','fire-sounder',10),objective('z24','All fire devices on 24-hour zones','fire-24h',14),objective('fire','Fire alarm raised on a 24-hour zone','fire-alarm',20),objective('budget','Within budget','within-budget',10)],
  targets:[point('open','Open-plan office',330,260),point('server','Server cupboard',720,220),point('exit','Fire exit',470,520)],rooms:[room('office','Open office',200,200,420,260),room('serverroom','Server cupboard',650,170,140,100)],walls:[...box('office',90,80,790,500)]
 }
];

export function scenarioFor(id:string):Scenario|undefined{return SCENARIOS.find(s=>s.id===id);}
