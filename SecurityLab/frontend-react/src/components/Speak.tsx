import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {getLocale,setLocale,speechLang,subscribe,t} from '../../../src/i18n/index.js';

/** Re-render when the language changes. */
export const useLocale=()=>useSyncExternalStore(subscribe,getLocale,getLocale);

const supported=()=>typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';

/** Feature 18: read-aloud using the browser's offline-capable speech engine. Hidden when unsupported. */
export function SpeakButton({text}:{text:string}){
 useLocale();
 const [speaking,setSpeaking]=useState(false);
 useEffect(()=>()=>{if(supported())window.speechSynthesis.cancel();},[]);
 if(!supported())return null;
 const toggle=()=>{
  const s=window.speechSynthesis;
  if(speaking){s.cancel();setSpeaking(false);return;}
  const u=new SpeechSynthesisUtterance(text);u.lang=speechLang();u.onend=()=>setSpeaking(false);u.onerror=()=>setSpeaking(false);
  setSpeaking(true);s.speak(u);
 };
 return <button type="button" className="speak-btn" onClick={toggle} aria-pressed={speaking} aria-label={speaking?t('speak.stop'):t('speak.read')} title={speaking?t('speak.stop'):t('speak.read')}>{speaking?'⏹':'🔊'}</button>;
}

export function LanguageSelect({locales}:{locales:{id:string;name:string}[]}){
 const current=useLocale();
 return <label>{t('top.language')} <select aria-label={t("top.language")} value={current} onChange={e=>setLocale(e.currentTarget.value)}>{locales.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>;
}
