import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';
const dir=process.env.SECURITYLAB_DIST_REACT?path.resolve(process.env.SECURITYLAB_DIST_REACT):path.resolve('..','dist-react');
const assets=[];
async function collect(folder){for(const entry of await readdir(folder,{withFileTypes:true})){
 const pathname=path.join(folder,entry.name);
 if(entry.isDirectory())await collect(pathname);
 else if(entry.isFile()&&!pathname.endsWith('service-worker.js')&&!pathname.endsWith('.map'))assets.push('/'+path.relative(dir,pathname).split(path.sep).join('/'));
}}
await collect(dir);
if(!assets.includes('/index.html')||!assets.some(x=>/\.(?:js|css)$/.test(x)))throw new Error('Build incomplete: cannot generate offline precache');
const digest=createHash('sha256');for(const url of assets.sort()){digest.update(url);digest.update(await readFile(path.join(dir,url.slice(1))));}
const cache=`securitylab-react-${digest.digest('hex').slice(0,16)}`;
const sw=`/* SecurityLab deterministic production shell precache. */\nconst CACHE=${JSON.stringify(cache)};const ASSETS=${JSON.stringify(assets)};\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('securitylab-react-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});\nself.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;\nif(request.mode==='navigate'){event.respondWith(fetch(request).then(r=>r.ok?r:Promise.reject(new Error('Offline'))).catch(()=>caches.match('/index.html')));return;}\nevent.respondWith(caches.match(request).then(cached=>cached||fetch(request)));});\n`;
await writeFile(path.join(dir,'service-worker.js'),sw);
console.log(`Offline precache ${cache}: ${assets.length} files`);
