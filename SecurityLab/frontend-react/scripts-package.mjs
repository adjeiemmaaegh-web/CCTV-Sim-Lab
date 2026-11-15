/**
 * Feature 19: reproducible static release package. Zips the built app (dist-react) with fixed timestamps and a
 * sorted file order so identical input gives an identical archive, and writes SHA256SUMS.txt plus a manifest.
 * It never uploads or deploys anything. Unsigned: a code-signing certificate is an owner decision.
 */
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {zipSync} from 'fflate';

const dist=path.resolve(process.env.SECURITYLAB_DIST_REACT||path.join('..','dist-react'));
const out=path.resolve(process.env.SECURITYLAB_RELEASE_DIR||path.join('..','..','release'));
const version=process.env.SECURITYLAB_VERSION||JSON.parse(await readFile('package.json','utf8')).version;
if(!/^[0-9A-Za-z.\-+]{1,40}$/.test(version))throw new Error('Unsafe version string');
const sha=buf=>createHash('sha256').update(buf).digest('hex');

async function collect(dir,base=dir,list=[]){
 for(const e of await readdir(dir,{withFileTypes:true})){
  const full=path.join(dir,e.name);
  if(e.isDirectory())await collect(full,base,list);
  else if(e.isFile()&&!e.name.endsWith('.map'))list.push(path.relative(base,full).split(path.sep).join('/'));
 }
 return list.sort();
}
const files=await collect(dist);
for(const need of ['index.html','service-worker.js','manifest.webmanifest'])if(!files.includes(need))throw new Error(`Build incomplete: ${need} missing. Run npm run build first.`);

const entries={},manifest=[];
for(const f of files){
 const data=new Uint8Array(await readFile(path.join(dist,f)));
 entries[f]=[data,{mtime:new Date(Date.UTC(1980,0,1)),level:9}];
 manifest.push({path:f,bytes:data.length,sha256:sha(data)});
}
const zip=zipSync(entries,{mtime:new Date(Date.UTC(1980,0,1))});
await mkdir(out,{recursive:true});
const name=`securitylab-${version}-static.zip`;
await writeFile(path.join(out,name),zip);
const zipHash=sha(zip);
await writeFile(path.join(out,'SHA256SUMS.txt'),`${zipHash}  ${name}\n`);
await writeFile(path.join(out,'RELEASE_MANIFEST.json'),JSON.stringify({name:'securitylab-static',version,archive:name,archiveSha256:zipHash,signed:false,files:manifest,
 notes:['Static offline-first web app. Serve over HTTPS (or localhost) for the service worker.','Unsigned package; no installer or code-signing certificate is included.']},null,2)+'\n');
console.log(`Packaged ${files.length} files -> ${path.join(out,name)}\nsha256 ${zipHash}`);
