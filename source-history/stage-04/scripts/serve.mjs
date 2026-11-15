import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const dist=path.resolve('dist');const port=Number(process.env.PORT)||4173;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
createServer(async(req,res)=>{
 try{
  const u=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  const pathname=decodeURIComponent(u.pathname);
  const resolved=path.resolve(dist,`.${pathname==='/'?'/index.html':pathname}`);
  if(!resolved.startsWith(dist+path.sep)&&resolved!==dist){res.writeHead(403);res.end('Forbidden');return;}
  let requested=resolved;
  try{const s=await stat(requested);if(!s.isFile())throw Error('not file');}
  catch{if(path.extname(requested)){res.writeHead(404);res.end('Not found');return;}requested=path.join(dist,'index.html');}
  const body=await readFile(requested);res.writeHead(200,{'Content-Type':types[path.extname(requested)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(body);
 }catch(e){res.writeHead(500);res.end(`Error loading SecurityLab: ${String(e)}`);}
}).listen(port,'127.0.0.1',()=>console.log(`SecurityLab: http://localhost:${port}`));
