const CACHE='securitylab-v0.1.0';
const ASSETS=['/','/index.html','/styles.css','/ui/app.js','/domain/catalog.js','/domain/types.js','/engine/geometry.js','/engine/network.js','/engine/simulator.js','/engine/assessment.js','/scenarios/index.js','/persistence/projects.js','/assets/icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const req=event.request;if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return response;}).catch(()=>caches.match(req).then(cached=>cached||caches.match('/index.html'))));
});
