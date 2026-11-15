export type DeviceKind = 'camera' | 'switch' | 'nvr';
export type Room = {id:string; name:string; x:number; y:number; w:number; h:number};
export type Wall = {id:string; kind:'wall'|'door'|'window'; x1:number; y1:number; x2:number; y2:number};
export type Point = {x:number; y:number};
export type Target = Point & {id:string; name:string; required:true};
export type Profile = {
  id:string; name:string; kind:DeviceKind; manufacturer:string; model:string; powerW:number;
  costGhs:number; ethernetPorts:number; poePorts:number; poeBudgetW:number; maxPortW:number;
  nvrChannels:number; defaultStorageGB:number; defaultFov:number; defaultRange:number;
  protocols:string[]; simulated:true; source?:string;
};
export type Device = {
  id:string; profileId:string; name:string; x:number; y:number; heading:number; fov:number; range:number;
  ip:string; mask:string; gateway:string; enabled:boolean; motionEnabled:boolean; recordingEnabled:boolean;
  poeBudgetW?:number; storageGB?:number; usedGB?:number; bitrateMbps?:number;
};
export type Cable = {id:string; a:string; b:string; connected:boolean; lengthMeters:number};
export type LabEvent = {id:string; at:string; kind:'info'|'motion'|'recorded'|'fault'|'warning'; message:string; x?:number; y?:number; deviceId?:string; recorded:boolean};
export type Scenario = {id:string; title:string; description:string; minCameras:number; budgetGhs:number; targets:Target[]; rooms:Room[]; walls:Wall[]; baseline:'empty'|'faulty'};
export type Project = {
  schemaVersion:1; id:string; title:string; scenarioId:string; createdAt:string; updatedAt:string;
  rooms:Room[]; walls:Wall[]; targets:Target[]; devices:Device[]; cables:Cable[]; events:LabEvent[];
  night:boolean; mainsOn:boolean; assisted:boolean; floorplanImage?:string; assessments?:AssessmentRecord[];
};
export type DeviceStatus = {id:string; powered:boolean; connected:boolean; networkOk:boolean; recordingReady:boolean; recorderId?:string; faults:string[]; poeSourceId?:string};
export type CableStatus = {id:string; up:boolean; reason:string};
export type PoEStatus = {id:string; budgetW:number; consumedW:number; allocatedCount:number; deniedIds:string[]};
export type Coverage = {name:string; id:string; covered:boolean; cameraIds:string[]};
export type SimResult = {devices:Record<string,DeviceStatus>; cables:Record<string,CableStatus>; poe:Record<string,PoEStatus>; coverage:Coverage[]; issues:string[]; onlineCameras:number; recordingCameras:number; requiredCameras:number; budgetUsedGhs:number; budgetGhs:number};
export type Rubric = {id:string; title:string; earned:number; max:number; details:string};
export type Assessment = {score:number; passed:boolean; rubric:Rubric[]; recommendations:string[]};

export type AssessmentRecord = {id:string; at:string; scenarioId:string; assessment:Assessment};
