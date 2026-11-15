import {afterEach,describe,expect,it} from 'vitest';
import {EN,FR,LOCALES,translate,interpolate,setLocale,getLocale,t,loadSavedLocale} from '../src/i18n/index.js';

const vars=(s:string)=>[...s.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort().join(',');
afterEach(()=>{setLocale('en',false);});

describe('i18n (feature 18)',()=>{
 it('every locale defines exactly the English keys with the same placeholders',()=>{
  for(const [id,l] of Object.entries(LOCALES)){
   expect(Object.keys(l.dict).sort(),id).toEqual(Object.keys(EN).sort());
   for(const k of Object.keys(EN) as (keyof typeof EN)[]){expect(vars(l.dict[k]!),`${id}:${k}`).toBe(vars(EN[k]));expect(l.dict[k]!.trim().length).toBeGreaterThan(0);}
  }
  expect(Object.keys(FR).length).toBe(Object.keys(EN).length);
 });
 it('French differs from English for visible labels (not a copy)',()=>{
  const same=(Object.keys(EN) as (keyof typeof EN)[]).filter(k=>EN[k]===FR[k]);
  expect(same.length).toBeLessThan(5);
 });
 it('interpolation fills named values and leaves unknown placeholders visible',()=>{
  expect(interpolate('{a}/{b} x',{a:1,b:'z'})).toBe('1/z x');expect(interpolate('{a} {missing}',{a:2})).toBe('2 {missing}');
  expect(translate('fr','lesson.steps',{done:2,total:5})).toBe('2/5 étapes');
 });
 it('falls back to English for unknown locales and switches with setLocale',()=>{
  expect(translate('xx','top.new')).toBe('New');
  setLocale('fr',false);expect(getLocale()).toBe('fr');expect(t('top.save')).toBe('Enregistrer le projet');
  expect(()=>setLocale('klingon')).toThrow();
 });
 it('storage failures never break language switching',()=>{
  const real=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}}});
  try{expect(()=>setLocale('fr')).not.toThrow();expect(loadSavedLocale()).toBe('fr');}
  finally{if(real)Object.defineProperty(globalThis,'localStorage',real);else delete (globalThis as {localStorage?:unknown}).localStorage;}
 });
});
