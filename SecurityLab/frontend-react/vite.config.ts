import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

// Stage 1/2 uses explicit .js ESM specifiers in TS source for native Node output.
// Vite has no emitted .js files inside ../src. Resolve these to matching .ts
// source files during the React migration, without changing the engine contracts.
const sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
const sourceModules={
 name:'securitylab-source-js-to-ts',enforce:'pre' as const,
 resolveId(source:string,importer:string|undefined){
  if(!importer||!source.endsWith('.js')||!source.startsWith('.'))return null;
  const absolute=resolve(dirname(importer),source.slice(0,-3)+'.ts');
  if(!absolute.startsWith(sourceRoot)&&absolute!==sourceRoot.slice(0,-1))return null;
  return existsSync(absolute)?absolute:null;
 }
};
export default defineConfig({
 plugins:[sourceModules,react()],
 server:{port:5173,strictPort:true,fs:{allow:['..']}},
 build:{outDir:'../dist-react',emptyOutDir:true,chunkSizeWarningLimit:700},
 base:'/'
});
