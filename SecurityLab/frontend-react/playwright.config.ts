import {defineConfig,devices} from '@playwright/test';
// Chromium runs everything. Firefox/WebKit run the app, UI and fallback-save tests;
// files.spec.ts needs Chromium's File System Access API (other browsers use the download fallback).
const shared=['app.spec.ts','ui.spec.ts','tools.spec.ts','shell.spec.ts'];
export default defineConfig({
 testDir:'./e2e',timeout:60_000,retries:0,workers:1,
 use:{baseURL:'http://127.0.0.1:4173',acceptDownloads:true},
 webServer:{command:'npm run preview',url:'http://127.0.0.1:4173',reuseExistingServer:true,timeout:60_000},
 projects:[
  {name:'chromium',use:{...devices['Desktop Chrome']}},
  ...(process.env.CROSS_BROWSER?[
   {name:'firefox',use:{...devices['Desktop Firefox']},testMatch:shared},
   {name:'webkit',use:{...devices['Desktop Safari']},testMatch:shared},
  ]:[])
 ],
 reporter:[['list']]
});
