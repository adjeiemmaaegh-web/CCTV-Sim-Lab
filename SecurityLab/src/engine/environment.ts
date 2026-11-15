/**
 * Feature 7: simplified environmental effects for training. These are documented heuristics, not
 * physical measurements: visibility range multipliers for weather/glare, PIR derating near body
 * temperature, and battery capacity derating by temperature.
 */
import type {Device,Environment,Project} from '../domain/types.js';
import {profile} from '../domain/catalog.js';

export const DEFAULT_ENVIRONMENT:Environment={weather:'clear',ambientC:25,glare:false};
const WEATHER_RANGE:Record<Environment['weather'],number>={clear:1,rain:0.8,fog:0.55,dust:0.7};

export function batteryTemperatureFactor(ambientC:number):number{
 if(ambientC<=-10)return 0.5;
 if(ambientC<=0)return 0.7;
 if(ambientC<15)return 0.7+(ambientC/15)*0.3;
 if(ambientC<=35)return 1;
 if(ambientC<=50)return 1-((ambientC-35)/15)*0.2;
 return 0.75;
}
export function cameraRangeFactor(env:Environment,night:boolean,infrared:boolean):number{
 let f=WEATHER_RANGE[env.weather];
 if(night&&infrared&&(env.weather==='fog'||env.weather==='rain'))f*=0.8; // IR backscatter off droplets
 if(!night&&env.glare)f*=0.85;
 return f;
}
export function pirRangeFactor(env:Environment):number{
 // PIR contrast collapses when ambient temperature approaches skin temperature.
 return env.ambientC>=30&&env.ambientC<=37?0.9:env.ambientC>37?0.8:1;
}
export function describeEnvironment(env:Environment,night:boolean):string[]{
 const out:string[]=[];
 out.push(`Camera range x${cameraRangeFactor(env,night,true).toFixed(2)} (with IR at night) / x${cameraRangeFactor(env,night,false).toFixed(2)} (no IR)`);
 out.push(`PIR detection range x${pirRangeFactor(env).toFixed(2)}`);
 out.push(`Battery capacity x${batteryTemperatureFactor(env.ambientC).toFixed(2)} at ${env.ambientC} °C`);
 return out;
}
/** Device copy as seen under the project's environment (read-only use; never persist the result). */
export function adjustDevice(project:Project,d:Device):Device{
 const env=project.environment;if(!env)return d;
 const k=profile(d.profileId).kind;
 if(k==='camera')return {...d,range:d.range*cameraRangeFactor(env,project.night,!!d.infraredEnabled)};
 if(k==='alarm-sensor')return {...d,range:d.range*pirRangeFactor(env)};
 if(k.startsWith('power-')&&d.powerConfig&&(k==='power-battery'||k==='power-ups')){
  const f=batteryTemperatureFactor(env.ambientC);
  return {...d,powerConfig:{...d.powerConfig,chargeWh:d.powerConfig.chargeWh*f,capacityWh:d.powerConfig.capacityWh*f}};
 }
 return d;
}
export function applyEnvironment(project:Project):Project{
 if(!project.environment)return project;
 return {...project,devices:project.devices.map(d=>adjustDevice(project,d))};
}
