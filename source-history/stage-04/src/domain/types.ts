export type DeviceKind = 'camera' | 'switch' | 'nvr' | 'dvr';
export type SignalType = 'ip' | 'analog';
export type CableMedia = 'ethernet' | 'coax';
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
export type Profile = {
  id:string; name:string; kind:DeviceKind; manufacturer:string; model:string; powerW:number;
  costGhs:number; ethernetPorts:number; poePorts:number; poeBudgetW:number; maxPortW:number;
  nvrChannels:number; defaultStorageGB:number; defaultFov:number; defaultRange:number;
  protocols:string[]; simulated:true; source?:string;
  signal?:SignalType; formFactor?:'bullet'|'dome'|'turret'|'ptz'|'box'; isPTZ?:boolean;
  megapixels?:number; maxBitrateMbps?:number; irRange?:number; maxZoom?:number;
  maxIncomingMbps?:number; coaxInputs?:number;
};
export type Device = {
  id:string; profileId:string; name:string; x:number; y:number; heading:number; fov:number; range:number;
  ip:string; mask:string; gateway:string; enabled:boolean; motionEnabled:boolean; recordingEnabled:boolean;
  poeBudgetW?:number; storageGB?:number; usedGB?:number; bitrateMbps?:number;
  recordingMode?:RecordingMode; recordingSchedule?:RecordingSchedule; motionZones?:MotionZone[]; motionSensitivity?:number;
  infraredEnabled?:boolean; opticalZoom?:number; tiltDegrees?:number; ptzPresets?:PTZPreset[];
  analogPowerConnected?:boolean; storageFailed?:boolean; incomingMbps?:number;
  resolution?:'720p'|'1080p'|'1440p'|'4K'; frameRate?:number; codec?:'H264'|'H265';
};
export type Cable = {id:string; a:string; b:string; connected:boolean; lengthMeters:number; medium?:CableMedia};
export type LabEvent = {id:string; at:string; kind:'info'|'motion'|'recorded'|'fault'|'warning'; message:string; x?:number; y?:number; deviceId?:string; recorded:boolean};
export type Scenario = {id:string; title:string; description:string; minCameras:number; budgetGhs:number; targets:Target[]; rooms:Room[]; walls:Wall[]; baseline:'empty'|'faulty'};
export type Project = {
  schemaVersion:2; id:string; title:string; scenarioId:string; createdAt:string; updatedAt:string;
  rooms:Room[]; walls:Wall[]; targets:Target[]; devices:Device[]; cables:Cable[]; events:LabEvent[];
  night:boolean; mainsOn:boolean; assisted:boolean; floorplanImage?:string; assessments?:AssessmentRecord[];
  // Stage 3 additive geometry fields: existing Stage 1/2 projects remain schemaVersion 2.
  unitsPerMeter?:number; siteElements?:SiteElement[]; floorplanSettings?:FloorplanSettings;
  clips?:RecordingClip[]; simulationDay?:number; simulationMinute?:number;
};
export type DeviceStatus = {id:string; powered:boolean; connected:boolean; networkOk:boolean; recordingReady:boolean; recorderId?:string; faults:string[]; poeSourceId?:string; channel?:number; signal?:SignalType; streamMbps?:number; scheduleActive?:boolean};
export type CableStatus = {id:string; up:boolean; reason:string};
export type PoEStatus = {id:string; budgetW:number; consumedW:number; allocatedCount:number; deniedIds:string[]};
export type RecorderStatus = {id:string; channelsTotal:number; channelsUsed:number; bandwidthLimitMbps:number; bandwidthUsedMbps:number; storageGB:number; usedGB:number; freeGB:number; estimatedRetentionHours:number; cameras:string[]; faults:string[]};
export type Coverage = {name:string; id:string; covered:boolean; cameraIds:string[]};
export type SimResult = {devices:Record<string,DeviceStatus>; cables:Record<string,CableStatus>; poe:Record<string,PoEStatus>; recorders:Record<string,RecorderStatus>; coverage:Coverage[]; issues:string[]; onlineCameras:number; recordingCameras:number; requiredCameras:number; budgetUsedGhs:number; budgetGhs:number};
export type Rubric = {id:string; title:string; earned:number; max:number; details:string};
export type Assessment = {score:number; passed:boolean; rubric:Rubric[]; recommendations:string[]};

export type AssessmentRecord = {id:string; at:string; scenarioId:string; assessment:Assessment};
