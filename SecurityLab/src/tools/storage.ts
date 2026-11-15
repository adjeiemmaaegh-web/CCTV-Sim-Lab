/** Feature 6: recorder storage and bandwidth planning, with RAID capacity and disk-failure behaviour. */
import type {Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';

export type Raid='none'|'raid0'|'raid1'|'raid5'|'raid6'|'raid10';
export type PlanCamera={name:string;bitrateMbps:number;duty:number};
export const DUTY={continuous:1,motion:0.25,scheduled:0.4,off:0} as const;

export const gbPerDay=(bitrateMbps:number,duty=1)=>bitrateMbps*1e6*86400*duty/8/1e9;
export function raidUsableTB(raid:Raid,disks:number,diskTB:number):number{
 if(!(disks>=1)||!(diskTB>0))throw new Error('Need at least one disk of positive size');
 switch(raid){
  case 'none':case 'raid0':return disks*diskTB;
  case 'raid1':if(disks<2)throw new Error('RAID 1 needs 2 disks');return diskTB*(disks%2===0?disks/2:1);
  case 'raid5':if(disks<3)throw new Error('RAID 5 needs 3+ disks');return (disks-1)*diskTB;
  case 'raid6':if(disks<4)throw new Error('RAID 6 needs 4+ disks');return (disks-2)*diskTB;
  case 'raid10':if(disks<4||disks%2)throw new Error('RAID 10 needs an even number of 4+ disks');return disks/2*diskTB;
 }
}
export const toleratedFailures=(raid:Raid,disks:number)=>raid==='raid1'?disks-1:raid==='raid5'?1:raid==='raid6'?2:raid==='raid10'?1:0;
export function diskFailureOutcome(raid:Raid,disks:number,failed:number){
 const t=toleratedFailures(raid,disks);
 if(failed<=0)return {state:'healthy' as const,message:'Array healthy'};
 if(failed<=t)return {state:'degraded' as const,message:`Degraded: still recording, rebuild required (${failed}/${t} tolerated failure(s) used)`};
 return {state:'failed' as const,message:'Array lost: recordings unavailable and recording stopped'};
}
export function plan(cameras:PlanCamera[],retentionDays:number,raid:Raid,disks:number,diskTB:number,overheadFraction=0.1){
 if(!(retentionDays>0))throw new Error('Retention must be positive');
 const perDay=cameras.reduce((n,c)=>n+gbPerDay(c.bitrateMbps,c.duty),0);
 const neededGB=perDay*retentionDays*(1+overheadFraction);
 const usableGB=raidUsableTB(raid,disks,diskTB)*1000;
 const totalMbps=cameras.reduce((n,c)=>n+c.bitrateMbps*(c.duty>0?1:0),0);
 return {gbPerDay:perDay,neededGB,usableGB,daysAchievable:perDay>0?usableGB/(perDay*(1+overheadFraction)):Infinity,ok:usableGB>=neededGB,peakInboundMbps:totalMbps,
  disksForNeed:(()=>{for(let n=1;n<=64;n++){try{if(raidUsableTB(raid,n,diskTB)*1000>=neededGB)return n;}catch{/* too few disks for this RAID level */}}return null;})()};
}
export function planFromProject(project:Project,retentionDays=14,raid:Raid='raid5',disks=4,diskTB=4){
 const cams:PlanCamera[]=project.devices.filter(d=>profile(d.profileId).kind==='camera').map(d=>({name:d.name,bitrateMbps:d.bitrateMbps??3,duty:DUTY[d.recordingMode??'motion']}));
 return {cameras:cams,...plan(cams,retentionDays,raid,disks,diskTB)};
}
