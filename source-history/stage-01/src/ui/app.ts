import type {Cable,Device,Point,Project,Room,Wall} from '../domain/types.js';
import {createDevice,profile,PROFILES} from '../domain/catalog.js';
import {SCENARIOS,newProject,exampleProject} from '../scenarios/index.js';
import {simulate,triggerMotion,injectFault} from '../engine/simulator.js';
import {assess} from '../engine/assessment.js';
import {coveragePolygon} from '../engine/geometry.js';
import {getProject,listProjects,removeProject,saveProject,validateProject} from '../persistence/projects.js';
const app=document.getElementById('app');if(!app)throw new Error('SecurityLab requires #app');
const root=app;
const esc=(s:unknown):string=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]||x));
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const fmt=(n:number)=>Number(n.toFixed(1)).toLocaleString();
type Mode='select'|'cable'|'wall'|'room'|'pan'|'test';type Selection={kind:'device'|'cable'|'room'|'wall';id:string}|null;
let project:Project=newProject(),selected:Selection=null,mode:Mode='select',placingProfile:string|null=null,cableStart:string|null=null;
let viewport={x:0,y:0,w:1000,h:650},workspace:'floor'|'topology'='floor',consoleTab:'diagnostics'|'events'|'assessment'='diagnostics';
let showCoverage=true,showTargets=true,showProjectList=false,savedProjects:Project[]=[],lastAssessment:ReturnType<typeof assess>|null=null;
let notice='',saveProblem='';
let drag:{kind:'device'|'pan'|'wall'|'room';id?:string;start:Point;origin:Point;current:Point;moved:boolean;clientStart?:Point}|null=null;
const touch=(p:Project):Project=>({...p,updatedAt:new Date().toISOString()});
const selectedDevice=()=>selected?.kind==='device'?project.devices.find(d=>d.id===selected?.id):undefined;
const selectedCable=()=>selected?.kind==='cable'?project.cables.find(d=>d.id===selected?.id):undefined;
const notify=(s:string)=>{notice=s;render();};
function commit(next:Project,message?:string){project=touch(next);lastAssessment=null;if(message)notice=message;render();
 void saveProject(project).then(()=>{saveProblem='';}).catch(e=>{saveProblem=`Auto-save failed: ${String(e?.message||e)}. Export the project as a backup.`;render();});
}
function worldPoint(evt:{clientX:number;clientY:number}):Point|null{
 const svg=document.getElementById('stage') as unknown as SVGSVGElement|null;if(!svg)return null;
 const matrix=svg.getScreenCTM();if(!matrix)return null;
 const p=svg.createSVGPoint();p.x=evt.clientX;p.y=evt.clientY;
 const q=p.matrixTransform(matrix.inverse());return {x:clamp(q.x,-100,1100),y:clamp(q.y,-100,750)};
}
function viewBox(){return `${viewport.x} ${viewport.y} ${viewport.w} ${viewport.h}`;}
function setZoom(factor:number){const nw=clamp(viewport.w/factor,250,1500);const nh=nw*0.65;
 const cx=viewport.x+viewport.w/2,cy=viewport.y+viewport.h/2;viewport={x:cx-nw/2,y:cy-nh/2,w:nw,h:nh};render();}
function deviceIcon(d:Device):string{const k=profile(d.profileId).kind;return k==='camera'?'◉':k==='switch'?'▥':'▣';}
function kLabel(id:string){const d=project.devices.find(d=>d.id===id);return d?.name||'Unknown';}
function htmlOption(value:string,label:string,actual:string){return `<option value="${esc(value)}" ${value===actual?'selected':''}>${esc(label)}</option>`;}
function headerHtml(result:ReturnType<typeof simulate>){const s=SCENARIOS.find(x=>x.id===project.scenarioId)!;
 return `<header class="topbar"><div class="brand"><span class="brand-mark">⬡</span><span>SECURITY<span class="brand-accent">LAB</span><small>VIRTUAL ENGINEERING WORKSTATION</small></span></div>
 <div class="project-meta"><span class="tag">LOCAL SIMULATION</span><span class="project-title" title="${esc(project.title)}">${esc(project.title)}</span><span class="dim">/</span><span class="dim">${esc(s.title)}</span></div>
 <div class="top-actions"><button data-action="open" title="Open saved projects">Open</button><button data-action="save" class="btn-outline">Save project</button><button data-action="export" title="Download project JSON">Export</button><button data-action="import" title="Import a project JSON file">Import</button><button data-action="assess" class="btn-primary">Assess installation</button></div></header>
 <div class="menubar"><span class="menugroup">LABORATORY <b>/ CCTV ENGINEERING</b></span>
 <label class="scenario-select">Scenario <select data-action="scenario-select">${SCENARIOS.map(x=>htmlOption(x.id,x.title,project.scenarioId)).join('')}</select></label>
 <span class="menufiller"></span><span class="metric"><i class="dot ${result.onlineCameras?'on':''}"></i>${result.onlineCameras} online</span><span class="metric">${result.recordingCameras} recording</span><span class="metric">GHS ${result.budgetUsedGhs.toLocaleString()}</span>
 <label class="toggle"><input type="checkbox" data-field-global="night" ${project.night?'checked':''}/> Night</label><label class="toggle"><input type="checkbox" data-field-global="mainsOn" ${project.mainsOn?'checked':''}/> AC power</label></div>`;
}
function catalogHtml(){const groups=[['CAMERAS',PROFILES.filter(p=>p.kind==='camera')],['NETWORK & RECORDING',PROFILES.filter(p=>p.kind!=='camera')]] as const;
 return `<aside class="catalog"><div class="panel-title">EQUIPMENT LIBRARY <small>TRAINING PROFILES</small></div>
 <div class="catalog-scroller">${groups.map(([heading,entries])=>`<div class="section-label">${heading}</div>${entries.map(p=>`<div class="catalog-item" draggable="true" data-profile="${p.id}" title="Drag into the floor plan or click to place"><div class="catalog-symbol ${p.kind}">${p.kind==='camera'?'◉':p.kind==='switch'?'▥':'▣'}</div><div class="catalog-desc"><strong>${esc(p.name)}</strong><small>${p.kind==='camera'?`${p.powerW}W PoE · ${p.defaultFov}° FOV`:p.kind==='switch'?`${p.poePorts} PoE ports · ${p.poeBudgetW}W`: `${p.nvrChannels} channels · ${p.defaultStorageGB} GB`}</small></div><div class="catalog-price">₵${p.costGhs}</div></div>`).join('')}`).join('')}
 <div class="section-label">INSTALLATION TESTS</div><p class="hint">Click equipment to place it, or drag it onto the property. Use <b>Cable</b> to connect two devices.</p>
 <div class="field"><label for="fault-type">Inject a technical fault</label><select id="fault-type"><option value="disconnect">Unplug camera cable</option><option value="ipconflict">Duplicate IP address</option><option value="badsubnet">Incompatible subnet mask</option><option value="lowpoe">Insufficient PoE budget</option><option value="power">Switch power failure</option><option value="storage">Recorder storage full</option><option value="orientation">Wrong camera angle</option></select></div><button class="wide danger-outline" data-action="inject">Inject fault</button>
 <button class="wide" data-action="demo">Load assisted example</button><button class="wide" data-action="floorplan">Import floor-plan image</button>
 <div class="library-note"><strong>Model fidelity</strong><p>Generic training representations. NOT Hikvision, Dahua, TP-Link or other manufacturers' actual firmware.</p></div></div></aside>`;
}
function sceneFloorHtml(result:ReturnType<typeof simulate>){
 const grid='<defs><pattern id="grid-small" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#2a3950" stroke-width=".8"/></pattern><pattern id="grid-big" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#grid-small)"/><path d="M100 0H0V100" fill="none" stroke="#3a5064" stroke-width="1.2"/></pattern></defs>';
 const rooms=project.rooms.map(r=>`<g data-room="${esc(r.id)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" class="room ${selected?.id===r.id?'active':''}"/><text x="${r.x+12}" y="${r.y+22}" class="room-label">${esc(r.name)}</text></g>`).join('');
 const walls=project.walls.map(w=>{const active=selected?.id===w.id?' chosen':'';return `<line data-wall="${esc(w.id)}" x1="${w.x1}" y1="${w.y1}" x2="${w.x2}" y2="${w.y2}" class="wall ${w.kind}${active}"/>`;}).join('');
 const coverage=showCoverage?project.devices.filter(d=>profile(d.profileId).kind==='camera').map(d=>{
  const status=result.devices[d.id];const color=status.powered&&status.networkOk?'#35c0bc':'#ed8d69';
  const points=coveragePolygon(d,project.walls,project.night).map(p=>`${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  return `<polygon points="${points}" fill="${color}" opacity="${status.powered?'.13':'.04'}" stroke="${color}" stroke-width="1.4" stroke-dasharray="6 5" pointer-events="none"/>`;
 }).join(''):'';
 const links=project.cables.map(c=>{
  const a=project.devices.find(d=>d.id===c.a),b=project.devices.find(d=>d.id===c.b);if(!a||!b)return '';
  const ok=result.cables[c.id]?.up;
  return `<g data-cable="${esc(c.id)}" class="wire-group"><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="transparent" stroke-width="16"/><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="wire ${ok?'wire-up':'wire-down'} ${selected?.id===c.id?'wire-selected':''}"/></g>`;
 }).join('');
 const targets=showTargets?project.targets.map(t=>{const st=result.coverage.find(c=>c.id===t.id)!;return `<g pointer-events="none"><circle cx="${t.x}" cy="${t.y}" r="18" fill="${st.covered?'#43cc9a':'#f09b64'}" opacity=".15"/><circle cx="${t.x}" cy="${t.y}" r="9" class="target ${st.covered?'covered':'not-covered'}"/><text x="${t.x+17}" y="${t.y-15}" class="target-label">${esc(t.name)}</text></g>`;}).join(''):'';
 const devices=project.devices.map(d=>{const k=profile(d.profileId).kind,s=result.devices[d.id],color=s.recordingReady?'recording':s.networkOk?'online':s.powered?'powered':'offline';
  return `<g data-device="${esc(d.id)}" transform="translate(${d.x} ${d.y})" class="device ${selected?.id===d.id?'selected':''}" tabindex="0" role="button" aria-label="Select ${esc(d.name)}"><circle r="24" class="device-back ${color}"/><text y="7" text-anchor="middle" class="device-icon">${deviceIcon(d)}</text>${k==='camera'?`<line x1="0" y1="0" x2="${Math.cos(d.heading*Math.PI/180)*32}" y2="${Math.sin(d.heading*Math.PI/180)*32}" stroke="#e4f7ff" stroke-width="3" pointer-events="none"/>`:''}<text y="41" text-anchor="middle" class="device-label">${esc(d.name)}</text></g>`;
 }).join('');
 const bg=project.floorplanImage?`<image href="${esc(project.floorplanImage)}" x="65" y="55" width="820" height="550" preserveAspectRatio="xMidYMid meet" opacity=".28" pointer-events="none"/>`:'';
 return `<svg id="stage" viewBox="${viewBox()}" aria-label="Interactive SecurityLab floor plan"><rect x="-300" y="-300" width="1600" height="1250" fill="#101e31"/><rect x="-300" y="-300" width="1600" height="1250" fill="url(#grid-big)"/>${grid}${bg}${rooms}${coverage}${walls}${links}${targets}${devices}</svg>`;
}
function sceneTopologyHtml(result:ReturnType<typeof simulate>){
 const cameras=project.devices.filter(d=>profile(d.profileId).kind==='camera'),switches=project.devices.filter(d=>profile(d.profileId).kind==='switch'),nvrs=project.devices.filter(d=>profile(d.profileId).kind==='nvr');
 const pos=new Map<string,Point>();const place=(list:Device[],x:number)=>list.forEach((d,i)=>pos.set(d.id,{x,y:100+(i+1)*480/(list.length+1)}));
 place(nvrs,165);place(switches,470);place(cameras,795);
 const wires=project.cables.map(c=>{const a=pos.get(c.a),b=pos.get(c.b);if(!a||!b)return '';return `<g data-cable="${esc(c.id)}"><path d="M${a.x} ${a.y} L${b.x} ${b.y}" stroke="transparent" stroke-width="24"/><path d="M${a.x} ${a.y} L${b.x} ${b.y}" class="wire ${result.cables[c.id].up?'wire-up':'wire-down'}"/></g>`;}).join('');
 const nodes=project.devices.map(d=>{const p=pos.get(d.id)!;const st=result.devices[d.id];return `<g data-device="${esc(d.id)}" class="topo-node ${selected?.id===d.id?'active':''}"><rect x="${p.x-83}" y="${p.y-28}" width="166" height="56" rx="9" fill="#13253b" stroke="${st.recordingReady?'#54dfb0':st.networkOk?'#45c7cd':'#d87a67'}" stroke-width="2"/><text x="${p.x}" y="${p.y-5}" text-anchor="middle" fill="#f3f7ff" font-size="13" font-weight="700">${esc(d.name.slice(0,24))}</text><text x="${p.x}" y="${p.y+14}" text-anchor="middle" fill="#95abc0" font-size="12">${esc(d.ip||'Unmanaged')} · ${st.powered?'POWER':'OFF'}</text></g>`;}).join('');
 return `<svg id="topology" viewBox="0 0 970 650" aria-label="CCTV Ethernet network topology"><rect width="970" height="650" fill="#101e31"/><text x="165" y="62" class="topo-col">RECORDERS</text><text x="470" y="62" class="topo-col">SWITCHING</text><text x="795" y="62" class="topo-col">IP CAMERAS</text>${wires}${nodes}</svg>`;
}
function toolButton(value:Mode,label:string,icon:string){return `<button class="tool ${mode===value?'active':''}" data-action="tool" data-mode="${value}" title="${esc(label)}"><span>${icon}</span>${label}</button>`;}
function workspaceHtml(result:ReturnType<typeof simulate>){
 const s=SCENARIOS.find(x=>x.id===project.scenarioId)!;
 return `<main class="workbench"><div class="workspace-header"><div><strong>INSTALLATION CANVAS</strong><small>${esc(s.description)}</small></div><div class="workspace-actions"><button class="tab ${workspace==='floor'?'active':''}" data-action="view-floor">Floor plan</button><button class="tab ${workspace==='topology'?'active':''}" data-action="view-topology">Network topology</button></div></div>
 <div class="toolbar">${toolButton('select','Select','⌖')}${toolButton('cable','Cable','╱')}${toolButton('wall','Wall','▰')}${toolButton('room','Room','▦')}${toolButton('pan','Pan','✥')}${toolButton('test','Test motion','◎')}<span class="toolbar-gap"></span><label class="toggle"><input type="checkbox" data-field-view="coverage" ${showCoverage?'checked':''}/> Coverage</label><label class="toggle"><input type="checkbox" data-field-view="targets" ${showTargets?'checked':''}/> Targets</label><button data-action="zoom-in" title="Zoom in">＋</button><button data-action="zoom-out" title="Zoom out">−</button><button data-action="zoom-reset" title="Reset zoom">Fit</button></div>
 <div class="canvas-frame ${mode==='pan'?'panning':''} ${mode==='test'?'testing':''}">${workspace==='floor'?sceneFloorHtml(result):sceneTopologyHtml(result)}<div class="canvas-hint">${placingProfile?'CLICK PROPERTY TO PLACE DEVICE':mode==='cable'?cableStart?`CHOOSE SECOND DEVICE · ${esc(kLabel(cableStart))}`:'CHOOSE FIRST DEVICE':mode==='test'?'CLICK ANY POINT TO SIMULATE MOVEMENT':mode==='wall'?'DRAG ON CANVAS TO DRAW A WALL':mode==='room'?'DRAG ON CANVAS TO CREATE A ROOM':mode==='select'?'DRAG DEVICES · SELECT CABLE TO CONFIGURE':'DRAG TO PAN VIEW'}</div>
 <div class="scale-indicator">SCHEMATIC PLAN · 10 UNITS ≈ 1 M</div></div>
 <div class="status-strip"><span>CAMERAS <b>${result.requiredCameras}</b></span><span>ONLINE <b>${result.onlineCameras}</b></span><span>RECORDING <b>${result.recordingCameras}</b></span><span>COVERED TARGETS <b>${result.coverage.filter(c=>c.covered).length}/${result.coverage.length}</b></span><span class="right">${project.night?'NIGHT':'DAY'} · ${project.mainsOn?'AC ONLINE':'AC FAILURE'}</span></div></main>`;
}
function fieldText(label:string,key:string,value:unknown,type='text',opts=''){return `<div class="field"><label>${esc(label)}</label><input data-field="${key}" type="${type}" value="${esc(value)}" ${opts}/></div>`;}
function fieldCheck(label:string,key:string,value:boolean){return `<label class="checkline"><input type="checkbox" data-field="${key}" ${value?'checked':''}/>${esc(label)}</label>`;}
function inspectorHtml(result:ReturnType<typeof simulate>){const d=selectedDevice(),c=selectedCable();
 let detail='<div class="inspector-empty"><span class="empty-glyph">⌖</span><strong>No equipment selected</strong><p>Select a camera, NVR, switch or cable to inspect its live configuration and diagnostics.</p></div>';
 if(d){const p=profile(d.profileId),s=result.devices[d.id];detail=`<div class="selected-kind">${esc(p.manufacturer)} / ${esc(p.model)}</div><h3>${esc(d.name)}</h3><div class="status-pill ${s.recordingReady?'good':s.networkOk?'good':s.powered?'warn':'bad'}">${s.recordingReady?'READY TO RECORD':s.networkOk?'CONNECTED':s.powered?'POWERED':'OFFLINE'}</div>
 <div class="form-grid">${fieldText('Equipment name','name',d.name)}${fieldText('IPv4 address','ip',d.ip)}${fieldText('Subnet mask','mask',d.mask)}${fieldText('Gateway (reference)','gateway',d.gateway)}
 ${p.kind==='camera'?`${fieldText('Heading / degrees','heading',d.heading,'number','min="-360" max="360"')}${fieldText('Horizontal FOV / degrees','fov',d.fov,'number','min="10" max="180"')}${fieldText('Visibility range / plan units','range',d.range,'number','min="1" max="500"')}${fieldCheck('Detect simulated motion','motionEnabled',d.motionEnabled)}${fieldCheck('Enable NVR recording','recordingEnabled',d.recordingEnabled)}`:''}
 ${p.kind==='switch'?`${fieldText('PoE budget / Watts','poeBudgetW',d.poeBudgetW??p.poeBudgetW,'number','min="0" max="1000"')}<div class="spec-line">Allocated: <b>${fmt(result.poe[d.id]?.consumedW||0)} / ${fmt(result.poe[d.id]?.budgetW||0)} W</b></div><div class="spec-line">PoE ports: <b>${p.poePorts}</b></div>`:''}
 ${p.kind==='nvr'?`${fieldText('Storage capacity / GB','storageGB',d.storageGB??p.defaultStorageGB,'number','min="1" max="100000"')}${fieldText('Storage used / GB','usedGB',d.usedGB??0,'number','min="0" max="100000"')}<div class="spec-line">Channels: <b>${p.nvrChannels}</b></div>`:''}
 ${fieldCheck('Equipment enabled','enabled',d.enabled)}</div><div class="spec-section"><h4>TECHNICAL PROFILE</h4><div class="spec-line">Power draw <b>${p.powerW} W</b></div><div class="spec-line">Price <b>GHS ${p.costGhs}</b></div><div class="spec-line">Protocols <b>${esc(p.protocols.join(', '))}</b></div><div class="spec-line">X / Y <b>${fmt(d.x)} / ${fmt(d.y)}</b></div></div><div class="diagnostic-block"><h4>LIVE DIAGNOSTICS</h4>${s.faults.length?s.faults.map(f=>`<div class="diagnostic error">${esc(f)}</div>`).join(''):'<div class="diagnostic ok">No device errors detected</div>'}</div><button class="wide danger-outline" data-action="delete-selection">Remove equipment</button>`;}
 else if(c){const status=result.cables[c.id];detail=`<div class="selected-kind">ETHERNET CABLE</div><h3>${esc(kLabel(c.a))} → ${esc(kLabel(c.b))}</h3><div class="status-pill ${status.up?'good':'bad'}">${esc(status.reason)}</div>${fieldCheck('Cable plugged in','connected',c.connected)}${fieldText('Cable length / metres','lengthMeters',c.lengthMeters,'number','min="1" max="2000"')}<p class="hint">Copper Ethernet links over 100 metres are considered invalid in this training model.</p><button class="wide danger-outline" data-action="delete-selection">Remove cable</button>`;}
 else if(selected?.kind==='room'){
  const r=project.rooms.find(x=>x.id===selected!.id);if(r)detail=`<div class="selected-kind">ROOM GEOMETRY</div><h3>${esc(r.name)}</h3>${fieldText('Room name','name',r.name)}${fieldText('Width','w',r.w,'number')}${fieldText('Height','h',r.h,'number')}<button class="wide danger-outline" data-action="delete-selection">Remove room</button>`;
 }else if(selected?.kind==='wall'){const w=project.walls.find(x=>x.id===selected!.id);if(w)detail=`<div class="selected-kind">BARRIER GEOMETRY</div><h3>${esc(w.kind)}</h3><div class="field"><label>Barrier type</label><select data-field="kind">${['wall','door','window'].map(k=>htmlOption(k,k,w.kind)).join('')}</select></div><p class="hint">Solid walls block camera visibility; doors and windows are simplified openings.</p><button class="wide danger-outline" data-action="delete-selection">Remove segment</button>`;}
 return `<aside class="inspector"><div class="panel-title">PROPERTIES & DIAGNOSTICS<small>SELECTED OBJECT</small></div><div class="inspector-scroll">${detail}</div></aside>`;
}
function consoleHtml(result:ReturnType<typeof simulate>){const score=lastAssessment;let content='';
 if(consoleTab==='diagnostics')content=result.issues.length?result.issues.slice(0,22).map(x=>`<div class="console-line issue"><span class="console-marker">!</span>${esc(x)}</div>`).join(''):'<div class="console-line success">● All installed equipment and critical targets currently pass the checked rules.</div>';
 else if(consoleTab==='events')content=project.events.length?project.events.slice().reverse().slice(0,35).map(e=>`<div class="console-line ${e.recorded?'success':e.kind==='fault'?'issue':''}"><span class="console-time">${esc(e.at.replace('T',' ').slice(0,19))}</span><strong>${esc(e.kind.toUpperCase())}</strong> ${esc(e.message)}</div>`).join(''):'<div class="console-line">No events. Choose Test motion and click a location in the floor plan.</div>';
 else content=score?`<div class="score-row"><div class="big-score">${score.score}<small>/100</small></div><div><strong>${score.passed?'PASS · PRACTICAL VERIFICATION COMPLETE':'NOT PASSED · REVIEW REQUIRED'}</strong><p>${project.assisted?'Assisted build cannot receive a passing competency score.':'Pass: at least 80 points, all critical targets covered, a recorded test event and operational cameras.'}</p></div></div><div class="rubric-grid">${score.rubric.map(r=>`<div class="rubric-item"><span>${esc(r.title)}</span><b>${r.earned}/${r.max}</b><small>${esc(r.details)}</small></div>`).join('')}</div>${score.recommendations.length?`<p class="recommend">Next steps: ${esc(score.recommendations.join(' · '))}</p>`:''}<div class="assessment-history">${(project.assessments||[]).slice(-5).reverse().map(x=>`${esc(x.at.slice(0,16).replace('T',' '))}: ${x.assessment.score}/100 ${x.assessment.passed?'PASS':'INCOMPLETE'}`).join(' · ')}</div>`:'<div class="console-line">Run an assessment to see a rubric and measured technical outcomes.</div>';
 return `<section class="console"><div class="console-header"><span class="console-heading">SIMULATION CONSOLE</span><button class="console-tab ${consoleTab==='diagnostics'?'active':''}" data-action="console-diagnostics">Diagnostics <em>${result.issues.length}</em></button><button class="console-tab ${consoleTab==='events'?'active':''}" data-action="console-events">Event log <em>${project.events.length}</em></button><button class="console-tab ${consoleTab==='assessment'?'active':''}" data-action="console-assessment">Assessment</button><span class="menufiller"></span><button class="console-clear" data-action="clear-events">Clear events</button></div><div class="console-body">${content}</div></section>`;
}
function listModalHtml(){if(!showProjectList)return '';
 return `<div class="modal-back"><section class="modal" role="dialog" aria-label="Saved SecurityLab projects"><div class="modal-head"><h2>Saved local projects</h2><button data-action="close-modal">✕</button></div><p>Projects are stored in this browser using IndexedDB. Export a JSON backup before clearing browser data.</p>${savedProjects.length?savedProjects.map(p=>`<div class="saved-item"><div><strong>${esc(p.title)}</strong><small>${esc(SCENARIOS.find(s=>s.id===p.scenarioId)?.title||'Unknown scenario')} · ${esc(p.updatedAt.slice(0,16).replace('T',' '))}</small></div><button data-action="load" data-id="${esc(p.id)}">Open</button><button class="danger-outline" data-action="delete-project" data-id="${esc(p.id)}">Delete</button></div>`).join(''):'<div class="saved-item">No local projects saved yet.</div>'}<div class="modal-footer"><button data-action="new-project">New blank scenario</button><button data-action="close-modal" class="btn-primary">Close</button></div></section></div>`;
}
function render(){const result=simulate(project);result.budgetGhs=SCENARIOS.find(s=>s.id===project.scenarioId)?.budgetGhs||0;
 root.innerHTML=`${headerHtml(result)}<div class="lab-layout">${catalogHtml()}${workspaceHtml(result)}${inspectorHtml(result)}</div>${consoleHtml(result)}
 <div class="footer"><span>SIMULATION ENGINE v0.1</span><span>LOCAL-FIRST · NO REAL HARDWARE CONNECTED</span><span>TRAINING MODEL · NOT VENDOR FIRMWARE</span></div>
 ${notice?`<div class="toast" role="status">${esc(notice)}<button data-action="dismiss">×</button></div>`:''}${saveProblem?`<div class="save-error" role="alert">${esc(saveProblem)}</div>`:''}${listModalHtml()}
 <input type="file" id="import-file" accept=".json,application/json" hidden/><input type="file" id="floorplan-file" accept="image/png,image/jpeg,image/webp" hidden/>`;
}
function resetEditorState(){selected=null;drag=null;cableStart=null;placingProfile=null;mode='select';lastAssessment=null;viewport={x:0,y:0,w:1000,h:650};workspace='floor';}
function selectEndpoint(id:string){
 if(mode!=='cable'){selected={kind:'device',id};render();return;}
 if(!cableStart){cableStart=id;selected={kind:'device',id};notice='Select a second device to draw the Ethernet connection.';render();return;}
 const start=cableStart;cableStart=null;
 if(id===start){notify('Connection cancelled: select two different devices.');return;}
 if(project.cables.some(c=>(c.a===start&&c.b===id)||(c.a===id&&c.b===start))){notify('These devices already have a cable. Select it to change its state.');return;}
 const a=project.devices.find(d=>d.id===start)!,b=project.devices.find(d=>d.id===id)!;
 const c:Cable={id:crypto.randomUUID(),a:start,b:id,connected:true,lengthMeters:Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/10))};
 selected={kind:'cable',id:c.id};commit({...project,cables:[...project.cables,c]},`Cable added between ${a.name} and ${b.name}.`);
}
function deleteSelection(){if(!selected)return;
 const s=selected;selected=null;
 if(s.kind==='device')commit({...project,devices:project.devices.filter(d=>d.id!==s.id),cables:project.cables.filter(c=>c.a!==s.id&&c.b!==s.id)},'Device and its attached cables removed.');
 else if(s.kind==='cable')commit({...project,cables:project.cables.filter(c=>c.id!==s.id)},'Cable removed.');
 else if(s.kind==='room')commit({...project,rooms:project.rooms.filter(r=>r.id!==s.id)},'Room removed.');
 else if(s.kind==='wall')commit({...project,walls:project.walls.filter(w=>w.id!==s.id)},'Barrier removed.');
}
async function openProjectList(){try{savedProjects=await listProjects();showProjectList=true;render();}catch(e){notify(`Project list unavailable: ${String(e)}`);}}
root.addEventListener('click',async ev=>{
 const t=ev.target as HTMLElement;const act=t.closest<HTMLElement>('[data-action]');
 const profileEl=t.closest<HTMLElement>('.catalog-item[data-profile]');
 if(profileEl&&!act){placingProfile=profileEl.dataset.profile||null;mode='select';notice=`Click the floor plan to place ${profile(placingProfile!).name}.`;render();return;}
 if(!act)return;
 const action=act.dataset.action||'';
 try{
  switch(action){
   case 'tool':mode=act.dataset.mode as Mode;placingProfile=null;cableStart=null;notice='';render();break;
   case 'zoom-in':setZoom(1.25);break;case 'zoom-out':setZoom(0.8);break;
   case 'zoom-reset':viewport={x:0,y:0,w:1000,h:650};render();break;
   case 'view-floor':workspace='floor';render();break;case 'view-topology':workspace='topology';render();break;
   case 'console-diagnostics':consoleTab='diagnostics';render();break;
   case 'console-events':consoleTab='events';render();break;
   case 'console-assessment':consoleTab='assessment';render();break;
   case 'dismiss':notice='';render();break;
   case 'open':await openProjectList();break;
   case 'close-modal':showProjectList=false;render();break;
   case 'new-project':showProjectList=false;resetEditorState();commit(newProject(project.scenarioId),'New blank project created.');break;
   case 'save':await saveProject(project);notify('Saved successfully to this browser. Export JSON for a portable backup.');break;
   case 'export':{
    const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`securitylab-${project.scenarioId}-${project.id.slice(0,8)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;
   }
   case 'import':document.getElementById('import-file')?.click();break;
   case 'floorplan':document.getElementById('floorplan-file')?.click();break;
   case 'assess':{
    const score=assess(project),at=new Date().toISOString();
    const record={id:crypto.randomUUID(),at,scenarioId:project.scenarioId,assessment:score};
    consoleTab='assessment';commit({...project,assessments:[...(project.assessments||[]),record].slice(-50)},`Assessment recorded: ${score.score}/100 — ${score.passed?'PASS':'not yet passed'}.`);
    lastAssessment=score;render();break;
   }
   case 'inject':{
    const kind=(document.getElementById('fault-type') as HTMLSelectElement).value;
    const r=injectFault(project,kind);if(r.project===project)notify(r.message);else{consoleTab='diagnostics';commit(r.project,r.message);}break;
   }
   case 'demo':{
    if(project.devices.length&&!confirm('Replace the current equipment and cables with a worked example? Your current project is auto-saved first.'))break;
    selected=null;commit(exampleProject(project),'Assisted example loaded. Inspect and test it; assisted assessments cannot pass.');break;
   }
   case 'delete-selection':deleteSelection();break;
   case 'clear-events':commit({...project,events:[]},'Simulation event history cleared for this project.');break;
   case 'load':{
    const id=act.dataset.id;if(!id)break;
    const saved=await getProject(id);if(!saved)throw new Error('Saved project could not be found');
    project=validateProject(saved);showProjectList=false;resetEditorState();lastAssessment=project.assessments?.at(-1)?.assessment||null;notice=`Opened ${project.title}.`;render();break;
   }
   case 'delete-project':{
    const id=act.dataset.id;if(!id||!confirm('Permanently remove this locally saved project?'))break;
    await removeProject(id);await openProjectList();break;
   }
  }
 }catch(e){notify(`Operation failed: ${String((e as Error).message||e)}`);}
});
root.addEventListener('change',async ev=>{
 const t=ev.target as HTMLInputElement|HTMLSelectElement;
 try{
  if(t.id==='import-file'){
   const file=(t as HTMLInputElement).files?.[0];if(!file)return;
   if(file.size>3_500_000)throw new Error('Import file is too large (3.5 MB limit)');
   const parsed=validateProject(JSON.parse(await file.text()));
   const now=new Date().toISOString();project={...parsed,id:crypto.randomUUID(),title:`${parsed.title} (imported)`,createdAt:now,updatedAt:now};
   resetEditorState();commit(project,'Valid SecurityLab project imported as a separate local copy.');return;
  }
  if(t.id==='floorplan-file'){
   const file=(t as HTMLInputElement).files?.[0];if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2_000_000)throw new Error('Use a PNG, JPEG or WebP image no larger than 2 MB');
   const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Image read failed'));reader.readAsDataURL(file);});
   if(!/^data:image\/(png|jpeg|webp);base64,/.test(image))throw new Error('Unsupported floor-plan image encoding');
   commit({...project,floorplanImage:image},'Floor-plan reference imported. Geometry and devices remain editable.');return;
  }
  if(t.dataset.action==='scenario-select'){
   const id=t.value;if(id===project.scenarioId)return;
   resetEditorState();commit(newProject(id),`Loaded scenario: ${SCENARIOS.find(s=>s.id===id)?.title||id}.`);return;
  }
  if(t.dataset.fieldGlobal){const key=t.dataset.fieldGlobal as 'night'|'mainsOn';commit({...project,[key]:(t as HTMLInputElement).checked},key==='night'?'Lighting changed; coverage recalculated.':'AC power state changed; PoE and connectivity recalculated.');return;}
  if(t.dataset.fieldView){const value=(t as HTMLInputElement).checked;if(t.dataset.fieldView==='coverage')showCoverage=value;else showTargets=value;render();return;}
  const field=t.dataset.field;if(!field||!selected)return;
  const boolean=(t as HTMLInputElement).type==='checkbox',value:boolean|string|number=boolean?(t as HTMLInputElement).checked:((t as HTMLInputElement).type==='number'?Number(t.value):t.value);
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Please enter a valid number');
  if(selected.kind==='device'){
   const numeric=['heading','fov','range','poeBudgetW','storageGB','usedGB','bitrateMbps'];
   let actual=value;
   if(numeric.includes(field))actual=clamp(value as number,field==='fov'?10:field==='range'?1:field==='storageGB'?1:0,field==='fov'?180:field==='range'?500:field==='heading'?360:100000);
   if(field==='name')actual=String(value).slice(0,75)||'Device';
   if(['ip','mask','gateway'].includes(field))actual=String(value).slice(0,40);
   const devs=project.devices.map(d=>d.id===selected?.id?{...d,[field]:actual}:d);commit({...project,devices:devs},'Device parameters updated; simulation recalculated.');
  }else if(selected.kind==='cable'){
   const cables=project.cables.map(c=>c.id===selected?.id?{...c,[field]:value}:c);commit({...project,cables},'Cable configuration updated.');
  }else if(selected.kind==='room'){
   const rooms=project.rooms.map(r=>r.id===selected?.id?{...r,[field]:field==='name'?String(value).slice(0,75):Math.max(20,Number(value))}:r);commit({...project,rooms},'Room geometry updated.');
  }else if(selected.kind==='wall'){
   const walls=project.walls.map(w=>w.id===selected?.id?{...w,kind:value as Wall['kind']}:w);commit({...project,walls},'Wall/door/window permeability updated.');
  }
 }catch(e){notify(`Configuration rejected: ${String((e as Error).message||e)}`);}
});
root.addEventListener('dragstart',ev=>{
 const item=(ev.target as HTMLElement).closest<HTMLElement>('[data-profile]');if(item&&ev.dataTransfer){ev.dataTransfer.setData('text/securitylab-profile',item.dataset.profile||'');ev.dataTransfer.effectAllowed='copy';}
});
root.addEventListener('dragover',ev=>{if(workspace==='floor'&&(ev.target as Element).closest('#stage'))ev.preventDefault();});
root.addEventListener('drop',ev=>{
 if(workspace!=='floor'||!(ev.target as Element).closest('#stage'))return;ev.preventDefault();
 const id=ev.dataTransfer?.getData('text/securitylab-profile');if(!id||!PROFILES.some(p=>p.id===id))return;
 const p=worldPoint(ev);if(!p)return;const d=createDevice(id,p.x,p.y,project.devices);selected={kind:'device',id:d.id};mode='select';placingProfile=null;
 commit({...project,devices:[...project.devices,d]},`${profile(id).name} placed. Connect power and Ethernet to make it operational.`);
});
root.addEventListener('pointerdown',ev=>{
 const target=ev.target as Element;const svg=target.closest('#stage,#topology');if(!svg||ev.button!==0)return;
 const de=target.closest<SVGGElement>('[data-device]');const ce=target.closest<SVGGElement>('[data-cable]');
 if(workspace==='topology'){
  if(de?.dataset.device)selectEndpoint(de.dataset.device);
  else if(ce?.dataset.cable){selected={kind:'cable',id:ce.dataset.cable};render();}
  return;
 }
 const p=worldPoint(ev);if(!p)return;
 if(mode==='test'){
  const r=triggerMotion(project,p);consoleTab='events';commit(r.project,`Movement test: ${r.detected} camera(s) detected; ${r.recorded} clip(s) recorded.`);return;
 }
 if(placingProfile){const d=createDevice(placingProfile,p.x,p.y,project.devices);selected={kind:'device',id:d.id};
  const label=profile(placingProfile).name;placingProfile=null;mode='select';commit({...project,devices:[...project.devices,d]},`${label} installed at (${Math.round(p.x)}, ${Math.round(p.y)}).`);return;}
 if(mode==='cable'){if(de?.dataset.device)selectEndpoint(de.dataset.device);return;}
 if(mode==='pan'){drag={kind:'pan',start:p,origin:{x:viewport.x,y:viewport.y},current:p,moved:false,clientStart:{x:ev.clientX,y:ev.clientY}};return;}
 if(mode==='wall'||mode==='room'){drag={kind:mode,start:p,origin:p,current:p,moved:false};return;}
 if(de?.dataset.device){const id=de.dataset.device,d=project.devices.find(d=>d.id===id)!;
  selected={kind:'device',id};drag={kind:'device',id,start:p,origin:{x:d.x,y:d.y},current:p,moved:false};render();return;}
 if(ce?.dataset.cable){selected={kind:'cable',id:ce.dataset.cable};render();return;}
 const we=target.closest<SVGLineElement>('[data-wall]'),re=target.closest<SVGGElement>('[data-room]');
 if(we?.dataset.wall)selected={kind:'wall',id:we.dataset.wall};else if(re?.dataset.room)selected={kind:'room',id:re.dataset.room};else selected=null;
 render();
});
document.addEventListener('pointermove',ev=>{
 if(!drag)return;
 const p=worldPoint(ev);if(!p)return;
 drag.current=p;
 if(Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>3)drag.moved=true;
 if(drag.kind==='device'&&drag.id&&drag.moved){
  const x=clamp(drag.origin.x+p.x-drag.start.x,0,1000),y=clamp(drag.origin.y+p.y-drag.start.y,0,650);
  project={...project,devices:project.devices.map(d=>d.id===drag!.id?{...d,x,y}:d)};render();
 }else if(drag.kind==='pan'&&drag.moved){
  const svg=document.getElementById('stage') as unknown as SVGSVGElement|null;
  const rect=svg?.getBoundingClientRect();
  if(rect&&drag.clientStart){
   const dx=(ev.clientX-drag.clientStart.x)*viewport.w/rect.width,dy=(ev.clientY-drag.clientStart.y)*viewport.h/rect.height;
   viewport={...viewport,x:drag.origin.x-dx,y:drag.origin.y-dy};
   render();
  }
 }
});
document.addEventListener('pointerup',()=>{
 if(!drag)return;const op=drag;drag=null;
 if(op.kind==='device'&&op.moved){commit(project,'Equipment repositioned; camera coverage and cabling reevaluated.');}
 else if(op.kind==='wall'&&op.moved){
  const wall:Wall={id:crypto.randomUUID(),kind:'wall',x1:op.start.x,y1:op.start.y,x2:op.current.x,y2:op.current.y};selected={kind:'wall',id:wall.id};commit({...project,walls:[...project.walls,wall]},'Solid wall added to the property.');
 }else if(op.kind==='room'&&op.moved){
  const x=Math.min(op.start.x,op.current.x),y=Math.min(op.start.y,op.current.y),w=Math.abs(op.current.x-op.start.x),h=Math.abs(op.current.y-op.start.y);
  if(w>=20&&h>=20){const room:Room={id:crypto.randomUUID(),name:`Room ${project.rooms.length+1}`,x,y,w,h};selected={kind:'room',id:room.id};commit({...project,rooms:[...project.rooms,room]},'Room added. Edit its name and dimensions in Properties.');}
 }else if(op.kind==='pan')render();
});
root.addEventListener('wheel',ev=>{
 if((ev.target as Element).closest('#stage')&&workspace==='floor'){ev.preventDefault();setZoom(ev.deltaY<0?1.1:0.9);}
},{passive:false});
document.addEventListener('keydown',ev=>{
 const t=ev.target as HTMLElement;if(t.closest('input,select,textarea'))return;
 if(ev.key==='Escape'){mode='select';placingProfile=null;cableStart=null;selected=null;render();}
 if((ev.key==='Delete'||ev.key==='Backspace')&&selected){ev.preventDefault();deleteSelection();}
 if((ev.key==='Enter'||ev.key===' ')&&t.hasAttribute('data-device')){ev.preventDefault();selectEndpoint(t.dataset.device||'');}
});
async function boot(){
 try{savedProjects=await listProjects();if(savedProjects.length){project=validateProject(savedProjects[0]);lastAssessment=project.assessments?.at(-1)?.assessment||null;}else await saveProject(project);}catch(e){saveProblem=`Local storage unavailable: ${String((e as Error).message||e)}. Export JSON backups.`;}
 render();
 if('serviceWorker' in navigator&&location.protocol==='https:'||'serviceWorker' in navigator&&location.hostname==='localhost'){
  navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
 }
}
void boot();
