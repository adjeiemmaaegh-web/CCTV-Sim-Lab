import {defineConfig} from 'vitest/config';
import {existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const sourceRoot=fileURLToPath(new URL('../src/',import.meta.url));
// Same .js -> .ts specifier resolution as vite.config.ts
const sourceModules={name:'securitylab-source-js-to-ts',enforce:'pre' as const,
 resolveId(source:string,importer:string|undefined){
  if(!importer||!source.endsWith('.js')||!source.startsWith('.'))return null;
  const abs=resolve(dirname(importer),source.slice(0,-3)+'.ts');
  return abs.startsWith(sourceRoot)&&existsSync(abs)?abs:null;
 }};
export default defineConfig({plugins:[sourceModules],test:{include:['../tests/**/*.test.ts'],root:fileURLToPath(new URL('.',import.meta.url)),environment:'node'},server:{fs:{allow:['..']}}});
