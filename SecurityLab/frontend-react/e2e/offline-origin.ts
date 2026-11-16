import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';

/**
 * Isolated production-build origin, intentionally shut down after PWA precache.
 * This tests a real unavailable server (not Playwright's offline interception).
 * It is NOT a replacement for actual Wi-Fi-off installed-PWA device testing.
 */
export async function disposableStaticPreview():Promise<{url:string;stop:()=>Promise<void>}>{
 const root=resolve(process.cwd(),'../dist-react');
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
   const content=await readFile(file);
   res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});
   res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
 });
 await new Promise<void>((done,fail)=>{
  server.once('error',fail);
  server.listen(0,'127.0.0.1',()=>{server.off('error',fail);done();});
 });
 const address=server.address();
 if(!address||typeof address==='string')throw new Error('Cannot determine local preview port');
 return {
  url:`http://127.0.0.1:${address.port}/`,
  stop:async()=>{
   if(!server.listening)return;
   // Do not leave a keep-alive socket able to serve a reload after outage.
   server.closeAllConnections();
   await new Promise<void>((done,fail)=>server.close(err=>err?fail(err):done()));
  }
 };
}
