export type DeviceKind = 'camera' | 'switch' | 'nvr' | 'dvr' | 'router' | 'ap' | 'server' | 'alarm-panel' | 'alarm-sensor' | 'alarm-output' | 'alarm-keypad' | 'access-controller' | 'access-reader' | 'access-lock' | 'access-exit' | 'access-server' | 'power-grid' | 'power-solar' | 'power-controller' | 'power-battery' | 'power-inverter' | 'power-ups' | 'power-psu' | 'power-ac-panel' | 'power-dc-panel';
export type SignalType = 'ip' | 'analog';
export type CableMedia = 'ethernet' | 'coax' | 'alarm' | 'access' | 'power-ac' | 'power-dc' | 'power-pv';
// Stage 5 network fields are optional so all Stage 1–4 documents retain their semantics.
export type PortConfig = {number:number; mode:'access'|'trunk'; accessVlan:number; nativeVlan:number; allowedVlans:number[]; speedMbps:number};
export type RouterInterface = {vlanId:number; ip:string; mask:string};
export type StaticRoute = {destination:string; mask:string; nextHop:string};
export type DhcpPool = {vlanId:number; start:string; end:string; mask:string; gateway:string; dns:string};
export type DnsRecord = {hostname:string;ip:string};
export type WirelessSettings = {ssid:string; key:string; vlanId:number; rangeUnits:number; maxClients:number; bandwidthMbps:number};
export type NetworkAddress = {ip:string; mask:string; gateway:string; dns:string; vlanId:number; source:'static'|'dhcp'|'unassigned'; faults:string[]};
export type NetworkLinkStatus = {id:string; a:string; b:string; aPort:number; bPort:number; vlans:number[]; capacityMbps:number; usedMbps:number; faults:string[]};
export type WirelessAssociation = {clientId:string; apId?:string; ssid:string; connected:boolean; reason:string; signalPercent:number; bandwidthMbps:number};
export type NetworkTrace = {ok:boolean; reason:string; devices:string[]; links:string[]; viaRouter?:string};
export type NetworkSnapshot = {addresses:Record<string,NetworkAddress>; links:Record<string,NetworkLinkStatus>; wireless:Record<string,WirelessAssociation>; dhcpLeases:Record<string,string>; diagnostics:string[]; traces:Record<string,NetworkTrace>};
// Stage 6 alarm models. The structured state is saved with each project; no live hardware or firmware is accessed.
export type AlarmSensorType='pir'|'door'|'window'|'glass'|'vibration'|'beam'|'panic';
export type AlarmZoneType='instant'|'entry'|'interior'|'24h';
export type AlarmArmMode='disarmed'|'stay'|'away';
export type AlarmPhase='idle'|'exit'|'armed'|'entry'|'triggered';
export type AlarmZone={number:number;name:string;type:AlarmZoneType;enabled:boolean;bypassed:boolean;contact?:'nc'|'no'};
export type AlarmPanelConfig={pin:string;entryDelaySec:number;exitDelaySec:number;sirenDurationSec:number;zones:AlarmZone[];batteryCapacityWh:number;batteryChargeWh:number;batteryEnabled:boolean;tamper:boolean};
export type AlarmRuntime={mode:AlarmArmMode;phase:AlarmPhase;remainingSeconds:number;pendingZone?:number;triggeredZones:number[];sirenSeconds:number};
export type AlarmDeviceState={zone:number;normallyClosed:boolean;fault:'none'|'open'|'short'|'tamper';bypassed:boolean;sensitivity:number};
export type AlarmZoneStatus={number:number;name:string;type:AlarmZoneType;armed:boolean;ready:boolean;triggered:boolean;faults:string[];devices:string[]};
export type AlarmPanelStatus={id:string;powered:boolean;acOn:boolean;usingBattery:boolean;batteryWh:number;mode:AlarmArmMode;phase:AlarmPhase;remainingSeconds:number;zones:AlarmZoneStatus[];activeOutputs:string[];faults:string[]};
export type AlarmResult={panels:Record<string,AlarmPanelStatus>;devices:Record<string,{powered:boolean;panelId?:string;wired:boolean;zone?:number;faults:string[]}>;wires:Record<string,{up:boolean;reason:string}>;issues:string[];activeSirenCount:number};
// Stage 7: purely synthetic access control training. Tokens are not real RFID/biometrics.
export type AccessMethod='card'|'pin'|'biometric';
export type AccessReaderConfig={method:AccessMethod; fault:'none'|'offline'|'tamper';};
export type AccessLockConfig={failMode:'fail-safe'|'fail-secure';fault:'none'|'stuck-locked'|'stuck-open';};
export type AccessControllerConfig={doorWallId:string;unlockSeconds:number;heldOpenLimitSeconds:number;supplyCapacityW:number;batteryEnabled:boolean;batteryCapacityWh:number;batteryChargeWh:number};
export type AccessGrant={controllerId:string;days:number[];startMinute:number;endMinute:number};
export type AccessIdentity={id:string;name:string;enabled:boolean;cardToken:string;pinToken:string;biometricToken:string;grants:AccessGrant[]};
export type AccessClock={day:number;minute:number;second:number};
export type AccessDoorRuntime={open:boolean;unlockedSeconds:number;heldOpenSeconds:number;forced:boolean;alarm:boolean};
export type AccessLog={id:string;at:string;clock:AccessClock;controllerId:string;readerId?:string;identityId?:string;action:'card'|'pin'|'biometric'|'exit'|'open'|'close'|'time'|'fault';decision:'granted'|'denied'|'alarm'|'info';reason:string};
export type AccessDeviceStatus={id:string;powered:boolean;wired:boolean;controllerId?:string;faults:string[]};
export type AccessDoorStatus={controllerId:string;wallId:string;name:string;open:boolean;locked:boolean;forced:boolean;alarm:boolean;unlockSeconds:number;heldOpenSeconds:number;faults:string[]};
export type AccessControllerStatus={id:string;powered:boolean;usingBattery:boolean;connectedReaderIds:string[];lockIds:string[];exitIds:string[];door?:AccessDoorStatus;faults:string[];powerUsedW:number;powerBudgetW:number};
export type AccessResult={controllers:Record<string,AccessControllerStatus>;devices:Record<string,AccessDeviceStatus>;cables:Record<string,{up:boolean;reason:string}>;doors:Record<string,AccessDoorStatus>;issues:string[];grantedCount:number;deniedCount:number};
// Stage 8: offline educational power model; not electrical safety certification.
export type PowerMode='legacy'|'wired';
export type PowerSettings={mode:PowerMode;solarPercent:number;virtualMinutes:number};
export type PowerConfig={ratedW:number;capacityWh:number;chargeWh:number;efficiency:number;fault:'none'|'tripped'|'failed'|'low-battery';chargeLimitW:number;dischargeLimitW:number};
export type PowerDeviceStatus={id:string;powered:boolean;inputW:number;outputW:number;availableW:number;capacityW:number;chargeWh:number;capacityWh:number;faults:string[];source?:string};
export type PowerCableStatus={id:string;up:boolean;media:CableMedia;voltageV:number;watts:number;maxWatts:number;faults:string[]};
export type PowerResult={mode:PowerMode;devices:Record<string,PowerDeviceStatus>;cables:Record<string,PowerCableStatus>;issues:string[];totalLoadW:number;solarGenerationW:number;gridDrawW:number;batteryDrawW:number;estimatedBackupMinutes:number};
export type RecordingMode = 'continuous' | 'motion' | 'scheduled' | 'off';
export type MotionZone = {id:string; name:string; x:number; y:number; w:number; h:number; enabled:boolean};
export type RecordingSchedule = {days:number[]; startMinute:number; endMinute:number};
export type PTZPreset = {id:string; name:string; heading:number; opticalZoom:number; tiltDegrees:number};
export type RecordingClip = {id:string; cameraId:string; recorderId:string; at:string; simulatedDay:number; simulatedMinute:number; durationSeconds:number; sizeGB:number; kind:'motion'|'manual'; x?:number; y?:number};
export type Room = {id:string; name:string; x:number; y:number; w:number; h:number};
export type Wall = {id:string; kind:'wall'|'door'|'window'; x1:number; y1:number; x2:number; y2:number; roomId?:string};
export type Point = {x:number; y:number};
export type SiteElement = Point & {id:string;kind:'entrance'|'gate'|'label';label:string};
export type FloorplanSettings = {x:number;y:number;width:number;height:number;opacity:number;locked:boolean};
export type Target = Point & {id:string; name:string; required:true};
// Stage 9 manufacturer profiles: immutable profile IDs and documented/approximate facts.
// Manufacturer names identify reference equipment only. No manufacturer sponsors SecurityLab.
export type ManufacturerSpec = {
  edition:string; variant:string; documentedAt:string; status:'simulation'|'reference-only';
  sourceUrl:string; sourceTitle:string;
  sourcedFacts:string[]; simulatedFeatures:string[]; limitations:string[];
  priceBasis:'user-quote';
  videoOutput?:string[]; videoInput?:string[];
  poePortNumbers?:number[];
  marketStatus?:'discontinued'|'not-confirmed';
};
export type Profile = {
  id:string; name:string; kind:DeviceKind; manufacturer:string; model:string; powerW:number;
  costGhs:number; ethernetPorts:number; poePorts:number; poeBudgetW:number; maxPortW:number;
  nvrChannels:number; defaultStorageGB:number; defaultFov:number; defaultRange:number;
  protocols:string[]; simulated:true; source?:string;
  manufacturerSpec?:ManufacturerSpec;
  signal?:SignalType; formFactor?:'bullet'|'dome'|'turret'|'ptz'|'box'; isPTZ?:boolean;
  megapixels?:number; maxBitrateMbps?:number; irRange?:number; maxZoom?:number;
  maxIncomingMbps?:number; coaxInputs?:number; maxFrameRate?:number; maxInstalledStorageGB?:number;
  managed?:boolean; portSpeedMbps?:number; wirelessCapable?:boolean; defaultWireless?:boolean;
  alarmSensorType?:AlarmSensorType; alarmZones?:number; alarmOutputs?:number; alarmWirePorts?:number;
  accessWirePorts?:number;accessReaderMethod?:AccessMethod;
  powerInputType?:'ac'|'dc'|'pv'|'poe'|'none';powerOutputType?:'ac'|'dc'|'pv'|'none';
  powerInputV?:number;powerOutputV?:number;powerRatedW?:number;powerCapacityWh?:number;

};
export type Device = {
  id:string; profileId:string; name:string; x:number; y:number; heading:number; fov:number; range:number;
  ip:string; mask:string; gateway:string; enabled:boolean; motionEnabled:boolean; recordingEnabled:boolean;
  unitCostGhs?:number; poeBudgetW?:number; storageGB?:number; usedGB?:number; bitrateMbps?:number;
  recordingMode?:RecordingMode; recordingSchedule?:RecordingSchedule; motionZones?:MotionZone[]; motionSensitivity?:number;
  infraredEnabled?:boolean; opticalZoom?:number; tiltDegrees?:number; ptzPresets?:PTZPreset[];
  analogPowerConnected?:boolean; storageFailed?:boolean; incomingMbps?:number;
  resolution?:'720p'|'1080p'|'1440p'|'4K'; frameRate?:number; codec?:'H264'|'H265';
  // IP and L2/L3 virtual configuration, not firmware settings.
  addressMode?:'static'|'dhcp'; dns?:string; vlanId?:number; portConfigs?:PortConfig[];
  routerInterfaces?:RouterInterface[]; routes?:StaticRoute[]; routingEnabled?:boolean; dhcpPools?:DhcpPool[];
  wireless?:WirelessSettings; wifiSsid?:string; wifiKey?:string; wifiEnabled?:boolean;
  dnsEnabled?:boolean; dnsRecords?:DnsRecord[];
  alarmPanel?:AlarmPanelConfig; alarmDevice?:AlarmDeviceState;
  accessController?:AccessControllerConfig;accessReader?:AccessReaderConfig;accessLock?:AccessLockConfig;
  powerConfig?:PowerConfig;
};
export type Cable = {id:string; a:string; b:string; connected:boolean; lengthMeters:number; medium?:CableMedia; aPort?:number; bPort?:number; speedMbps?:number;powerMaxAmps?:number};
export type LabEvent = {id:string; at:string; kind:'info'|'motion'|'recorded'|'fault'|'warning'; message:string; x?:number; y?:number; deviceId?:string; recorded:boolean};
export type ScenarioFocus='cctv'|'network'|'alarm'|'access'|'power'|'mixed';
export type ScenarioMetric='camera-count'|'camera-powered'|'camera-online'|'camera-recording'|'target-coverage'|'night-coverage'|'recorded-event'|'technical-health'|'within-budget'|'resolved-challenges'|'alarm-panel'|'alarm-sensors'|'alarm-keypad'|'alarm-armed'|'alarm-triggered'|'alarm-output'|'alarm-beam'|'router-ready'|'dhcp-lease'|'intervlan-route'|'access-controller'|'access-readers'|'access-lock'|'access-door'|'access-granted'|'access-denied'|'access-exit'|'power-wired'|'solar-generation'|'battery-ready'|'backup-outage';
export type ScenarioObjective={id:string;title:string;metric:ScenarioMetric;minimum:number;weight:number;critical:boolean;deviceKind?:DeviceKind};
export type ScenarioChallenge={id:string;kind:'cable-repair'|'ip-conflict'|'alarm-wire-repair';cableId?:string;deviceId?:string;label:string;hint:string};
export type ScenarioState={definitionVersion:number;startedAt:string;challenges:ScenarioChallenge[]};
export type Scenario={id:string;version:number;focus:ScenarioFocus;difficulty:'beginner'|'intermediate'|'advanced';title:string;description:string;instructions:string[];starterProfiles:string[];allowedKinds:DeviceKind[];minCameras:number;budgetGhs:number;targets:Target[];rooms:Room[];walls:Wall[];baseline:'empty'|'faulty'|'starter';objectives:ScenarioObjective[]};
// Stage 14: anonymous, manually entered field-trial observations. Never a production certificate.
export type FieldRole='learner'|'technician'|'instructor';
export type FieldOutcome='completed'|'partial'|'blocked';
export type FieldTrialTask='property-editor'|'cctv-installation'|'network-troubleshooting'|'alarm-workflow'|'access-control'|'power-backup'|'file-reopen'|'offline-workflow'|'assessment-report';
export type FieldTrial={id:string;at:string;role:FieldRole;platform:string;browser:string;deviceClass:'low-spec'|'standard'|'other';ramGb:number;offline:boolean;scenarioId:string;task:FieldTrialTask;outcome:FieldOutcome;durationMinutes:number;notes:string};
export type FieldIssue={id:string;at:string;severity:'critical'|'major'|'minor';status:'open'|'resolved'|'deferred';area:FieldTrialTask;summary:string;steps:string;expected:string;observed:string;trialId?:string};
export type FieldReview={version:1;trials:FieldTrial[];issues:FieldIssue[]};
export type Project = {
  schemaVersion:2; id:string; title:string; scenarioId:string; createdAt:string; updatedAt:string;
  rooms:Room[]; walls:Wall[]; targets:Target[]; devices:Device[]; cables:Cable[]; events:LabEvent[];
  night:boolean; mainsOn:boolean; assisted:boolean; floorplanImage?:string; assessments?:AssessmentRecord[];
  // Stage 3 additive geometry fields: existing Stage 1/2 projects remain schemaVersion 2.
  unitsPerMeter?:number; siteElements?:SiteElement[]; floorplanSettings?:FloorplanSettings;
  clips?:RecordingClip[]; simulationDay?:number; simulationMinute?:number;
  alarmStates?:Record<string,AlarmRuntime>; alarmElapsedSec?:number;
  accessIdentities?:AccessIdentity[];accessClock?:AccessClock;accessDoorStates?:Record<string,AccessDoorRuntime>;accessLog?:AccessLog[];
  powerSettings?:PowerSettings;
  scenarioState?:ScenarioState;
  fieldReview?:FieldReview; // optional local project evidence, no personal identifiers
};
export type DeviceStatus = {id:string; powered:boolean; connected:boolean; networkOk:boolean; recordingReady:boolean; recorderId?:string; faults:string[]; poeSourceId?:string; channel?:number; signal?:SignalType; streamMbps?:number; scheduleActive?:boolean};
export type CableStatus = {id:string; up:boolean; reason:string};
export type PoEStatus = {id:string; budgetW:number; consumedW:number; allocatedCount:number; deniedIds:string[]};
export type RecorderStatus = {id:string; channelsTotal:number; channelsUsed:number; bandwidthLimitMbps:number; bandwidthUsedMbps:number; storageGB:number; usedGB:number; freeGB:number; estimatedRetentionHours:number; cameras:string[]; faults:string[]};
export type Coverage = {name:string; id:string; covered:boolean; cameraIds:string[]};
export type SimResult = {power?:PowerResult;alarm?:AlarmResult;access?:AccessResult;network?:NetworkSnapshot; devices:Record<string,DeviceStatus>; cables:Record<string,CableStatus>; poe:Record<string,PoEStatus>; recorders:Record<string,RecorderStatus>; coverage:Coverage[]; issues:string[]; onlineCameras:number; recordingCameras:number; requiredCameras:number; budgetUsedGhs:number; budgetGhs:number};
export type Rubric = {id:string; title:string; earned:number; max:number; details:string};
export type CompetencyCategory='equipment'|'coverage'|'network'|'recording'|'alarm'|'access'|'power'|'reliability'|'troubleshooting';
export type CompetencyArea={id:CompetencyCategory;title:string;earned:number;max:number;percent:number;objectiveIds:string[]};
export type AssessmentEvidence={id:string;category:CompetencyCategory;source:'scenario-rule'|'tracked-incident';title:string;actual:number;required:number;met:boolean;critical:boolean;details:string};
export type AssessmentFinding={id:string;severity:'critical'|'major'|'minor'|'information';category:CompetencyCategory;title:string;description:string;recommendation:string;objectiveId?:string};
export type AssessmentGate={id:string;met:boolean;title:string;description:string};
export type Assessment={score:number;passed:boolean;rubric:Rubric[];recommendations:string[];
 // Stage 11 additive structure; Stage 1-10 saved assessments remain readable.
 version?:2;method?:'local-simulation';scenarioVersion?:number;fingerprint?:string;
 summary?:string;level?:'not-yet-demonstrated'|'developing'|'criteria-not-met'|'simulated-proficiency';
 areas?:CompetencyArea[];evidence?:AssessmentEvidence[];findings?:AssessmentFinding[];gates?:AssessmentGate[];
};
export type AssessmentRecord={id:string;at:string;scenarioId:string;assessment:Assessment;
 projectId?:string;projectTitle?:string;source?:'local-simulation';
};
