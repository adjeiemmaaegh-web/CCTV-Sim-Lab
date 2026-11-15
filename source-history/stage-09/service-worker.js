/* Offline shell. Installation caches all required modules; activation is user-controlled on updates. */
const CACHE='securitylab-v0.2.0';
const ASSETS=['/','/index.html','/styles.css','/assets/icon.svg','/manifest.webmanifest',
 '/ui/app.js','/domain/catalog.js','/domain/types.js','/engine/geometry.js',
 '/engine/network.js','/engine/simulator.js','/engine/assessment.js',
 '/scenarios/index.js','/persistence/projects.js','/state/history.js','/state/autosave.js','/state/crosstab.js'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('securitylab-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 // Never transform a missing JS module into a misleading HTML navigation response.
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>response.ok?response:Promise.reject(new Error('Navigation failed'))).catch(()=>caches.match('/index.html')));
  return;
 }
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
  return response;
 })));
});
