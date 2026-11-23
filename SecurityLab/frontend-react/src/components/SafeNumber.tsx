import React,{useEffect,useId,useState} from 'react';
export function numericError(raw:string,min?:number,max?:number){
 if(raw.trim()==='')return 'Enter a number; blank values are not applied.';
 const n=Number(raw);if(!Number.isFinite(n))return 'Enter a finite number.';
 if(min!==undefined&&n<min)return `Minimum: ${min}.`;
 if(max!==undefined&&n>max)return `Maximum: ${max}.`;
 return '';
}
/** Local draft: a blank or invalid edit never reaches the project model. */
export function SafeNumber({value,onApply,disabled,min,max,step=1,label}:{value:number;onApply:(n:number)=>void;disabled:boolean;min?:number;max?:number;step?:number;label:string}){
 const [raw,setRaw]=useState(String(value));const id=useId();
 useEffect(()=>setRaw(String(value)),[value]);
 const error=numericError(raw,min,max),dirty=raw!==String(value);
 return <div className="safe-number"><input aria-label={label} type="number" disabled={disabled} min={min} max={max} step={step} value={raw} aria-invalid={!!error} aria-describedby={error?id:undefined} onChange={e=>setRaw(e.target.value)}/>{error&&<small id={id} role="status">{error}</small>}{dirty&&<div className="number-actions"><button type="button" disabled={disabled||!!error} onClick={()=>{onApply(Number(raw));}}>Apply</button><button type="button" onClick={()=>setRaw(String(value))}>Cancel</button></div>}</div>;
}
