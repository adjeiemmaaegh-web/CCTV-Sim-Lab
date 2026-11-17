import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

/**
 * Local, disposable two-build SW update server for Playwright acceptance probes.
 *
 * The initial version serves the exact built production shell. The update
 * version changes only its service-worker script and cache identity. This is a
 * controlled, nonproduction update, never the Vercel production alias.
 */
export async function disposableUpdatePreview(options:{pauseAfterFirstPass?:boolean}={}):Promise<{
 url:string;
 publishUpdate:()=>void;
 stop:()=>Promise<void>;
}>{
 const root=resolve(process.cwd(),'../dist-react');
 let version:1|2=1;
 const mime:Record<string,string>={
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json',
  '.webmanifest':'application/manifest+json','.svg':'image/svg+xml',
  '.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'
 };
 const server=createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url??'/','http://127.0.0.1').pathname);
   const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   let content:Buffer=await readFile(file);
   if(pathname==='/service-worker.js'&&version===2){
    const original=content.toString('utf8');
    let modified=original.replace(/securitylab-react-[0-9a-f]{16}/,'securitylab-react-qa-update-v2');
    if(modified===original)throw new Error('Cannot locate the deterministic production SW cache version');
    if(options.pauseAfterFirstPass){
     // Test-only protocol hook: signal the first approval has completed,
     // then widen the tiny inter-pass gap. Never shipped by the production build.
     const marker='await new Promise(resolve=>setTimeout(resolve,125));';
     if(!modified.includes(marker))throw new Error('Cannot find the SW revalidation boundary');
     modified=modified.replace(marker,
      `for(const peer of await self.clients.matchAll({type:'window',includeUncontrolled:true})){peer.postMessage({type:'SECURITYLAB_QA_FIRST_PASS_DONE'});}
      await new Promise(resolve=>setTimeout(resolve,1200));`);
    }
    content=Buffer.from(modified+'\n// SecurityLab QA update version 2; never published to production.\n');
   }
   res.writeHead(200,{
    'Content-Type':mime[extname(file)]??'application/octet-stream',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
   });
   res.end(content);
  }catch(error){
   res.writeHead(404);res.end('Static test asset missing');
  }
 });
 await new Promise<void>((done,fail)=>{
  server.once('error',fail);
  server.listen(0,'127.0.0.1',()=>{server.off('error',fail);done();});
 });
 const address=server.address();
 if(!address||typeof address==='string')throw new Error('No test server address');
 return {
  url:`http://127.0.0.1:${address.port}/`,
  publishUpdate:()=>{version=2;},
  stop:async()=>{
   if(!server.listening)return;
   server.closeAllConnections();
   await new Promise<void>((done,fail)=>server.close(err=>err?fail(err):done()));
  }
 };
}
