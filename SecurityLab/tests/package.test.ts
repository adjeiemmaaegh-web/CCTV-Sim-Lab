import {describe,expect,it} from 'vitest';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';

const script=resolve(__dirname,'..','frontend-react','scripts-package.mjs');
const cwd=resolve(__dirname,'..','frontend-react');
function fakeDist(){
 const d=mkdtempSync(join(tmpdir(),'sl-dist-'));mkdirSync(join(d,'assets'));
 writeFileSync(join(d,'index.html'),'<html></html>');writeFileSync(join(d,'service-worker.js'),'// sw');writeFileSync(join(d,'manifest.webmanifest'),'{}');
 writeFileSync(join(d,'assets','app.js'),'console.log(1)');writeFileSync(join(d,'assets','app.js.map'),'SECRET-SOURCEMAP');
 return d;
}
const run=(dist:string,out:string,version='9.9.9-test')=>execFileSync(process.execPath,[script],{cwd,env:{...process.env,SECURITYLAB_DIST_REACT:dist,SECURITYLAB_RELEASE_DIR:out,SECURITYLAB_VERSION:version},encoding:'utf8'});
const sha=(b:Buffer|Uint8Array)=>createHash('sha256').update(b).digest('hex');

describe('release packaging (feature 19)',()=>{
 it('creates a deterministic archive, checksums and manifest; excludes source maps; never uploads',()=>{
  const dist=fakeDist(),o1=mkdtempSync(join(tmpdir(),'sl-rel-')),o2=mkdtempSync(join(tmpdir(),'sl-rel-'));
  try{
   run(dist,o1);run(dist,o2);
   const z1=readFileSync(join(o1,'securitylab-9.9.9-test-static.zip')),z2=readFileSync(join(o2,'securitylab-9.9.9-test-static.zip'));
   expect(sha(z1)).toBe(sha(z2)); // reproducible
   const files=unzipSync(new Uint8Array(z1));expect(Object.keys(files).sort()).toEqual(['assets/app.js','index.html','manifest.webmanifest','service-worker.js']);
   const man=JSON.parse(readFileSync(join(o1,'RELEASE_MANIFEST.json'),'utf8'));
   expect(man.signed).toBe(false);expect(man.archiveSha256).toBe(sha(z1));
   for(const f of man.files)expect(f.sha256).toBe(sha(files[f.path]));
   expect(readFileSync(join(o1,'SHA256SUMS.txt'),'utf8').trim()).toBe(`${sha(z1)}  securitylab-9.9.9-test-static.zip`);
   expect(readdirSync(o1).sort()).toEqual(['RELEASE_MANIFEST.json','SHA256SUMS.txt','securitylab-9.9.9-test-static.zip']);
  }finally{for(const d of [dist,o1,o2])rmSync(d,{recursive:true,force:true});}
 });
 it('refuses an incomplete build and unsafe version strings',()=>{
  const d=mkdtempSync(join(tmpdir(),'sl-dist-')),o=mkdtempSync(join(tmpdir(),'sl-rel-'));
  try{
   writeFileSync(join(d,'index.html'),'x');
   expect(()=>run(d,o)).toThrow();
   const ok=fakeDist();
   try{expect(()=>run(ok,o,'1.0/../../evil')).toThrow();}finally{rmSync(ok,{recursive:true,force:true});}
  }finally{rmSync(d,{recursive:true,force:true});rmSync(o,{recursive:true,force:true});}
 });
});
