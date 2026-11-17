/**
 * A user-initiated PWA update is allowed only after this editor confirms a
 * real local-file save AND every same-origin SecurityLab client cooperatively
 * reports no unsaved or blocked work. The waiting service worker polls all
 * clients and fails closed if one does not respond.
 *
 * This is an origin/client-level guard. It cannot lock another browser profile,
 * OS file editor, or guarantee that a peer cannot edit after its response.
 */
export type SafeUpdate = () => Promise<boolean>;
export type PeerSafe = () => boolean;

const updateTimeoutMs=6_000;
function requestActivation(worker:ServiceWorker):Promise<boolean>{
 return new Promise(resolve=>{
  const pair=new MessageChannel();
  let finished=false;
  const done=(safe:boolean)=>{
   if(finished)return;
   finished=true;clearTimeout(timeout);
   pair.port1.close();resolve(safe);
  };
  const timeout=setTimeout(()=>done(false),updateTimeoutMs);
  pair.port1.onmessage=event=>{
   const data=event.data;
   done(data?.type==='SECURITYLAB_UPDATE_ACTIVATION_RESULT'&&data.safe===true);
  };
  try{worker.postMessage({type:'ACTIVATE_UPDATE'},[pair.port2]);}
  catch{done(false);}
 });
}

export function setupOffline(canUpdate: SafeUpdate, peerSafe: PeerSafe): () => void {
 if (!('serviceWorker' in navigator) ||
     !(location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  return () => {};
 }
 let disposed = false;
 let authorizedUpdate = false;
 let cleanupController = () => {};
 let banner: HTMLElement | null = null;

 const safeNow=()=>{
  try{return !disposed && peerSafe()===true;}
  catch{return false;}
 };
 const onSafetyCheck=(event:MessageEvent)=>{
  if(event.data?.type!=='SECURITYLAB_UPDATE_SAFETY_CHECK')return;
  // Never silently save or discard another tab's draft in response to an
  // update request. Only a read-only status answer is permitted.
  event.ports[0]?.postMessage({type:'SECURITYLAB_UPDATE_SAFETY_RESULT',safe:safeNow()});
 };
 navigator.serviceWorker.addEventListener('message',onSafetyCheck);

 void navigator.serviceWorker.register('/service-worker.js').then(reg => {
  if (disposed) return;
  const onControllerChange = () => {
   if(!disposed && authorizedUpdate && safeNow())location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange',onControllerChange);
  cleanupController = () => navigator.serviceWorker.removeEventListener('controllerchange',onControllerChange);
  const offerUpdate = () => {
   if (disposed || !reg.waiting || banner) return;
   const element = document.createElement('div');
   element.id = 'securitylab-update-ready'; element.className = 'toast'; element.role = 'status';
   const explanation = document.createElement('span');
   explanation.textContent = 'A new SecurityLab build is available. Save your project to a local file before activating it. ';
   element.appendChild(explanation);
   const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Save & update';
   button.onclick = async () => {
    button.disabled = true;
    try {
     const safe = await canUpdate();
     if (!safe) {
      explanation.textContent = 'Cannot update until this project is safely saved. Export your work or resolve the save error. ';
      return;
     }
     const waiting=reg.waiting;
     if(!waiting){
      explanation.textContent='The waiting update is no longer available. Refresh only after saving your work. ';
      return;
     }
     // Only the consenting tab may reload on controllerchange. Set before
     // sending because activation can race the MessagePort acknowledgement.
     // The new worker must still obtain consent from *all* open app tabs.
     authorizedUpdate=true;
     const accepted=await requestActivation(waiting);
     if(!accepted){
      authorizedUpdate=false;
      explanation.textContent='Update deferred: another open SecurityLab tab has unsaved work or could not confirm safety. Save all open tabs and retry. ';
     }
    } catch (error) {
     authorizedUpdate=false;
     explanation.textContent = `Update blocked: ${String(error)}. Export your project first. `;
    } finally { button.disabled = false; }
   };
   element.appendChild(button); document.body.appendChild(element); banner = element;
  };
  const onUpdateFound = () => {
   const installing = reg.installing;
   installing?.addEventListener('statechange', () => {
    if (installing.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
   });
  };
  reg.addEventListener('updatefound', onUpdateFound);
  cleanupController = (() => { const previous = cleanupController; return () => {
    reg.removeEventListener('updatefound', onUpdateFound); previous();
   };})();
  offerUpdate();
 }).catch(error => { if (!disposed) console.warn('Offline cache registration unavailable', error); });
 return () => {
  disposed = true;
  navigator.serviceWorker.removeEventListener('message',onSafetyCheck);
  cleanupController(); banner?.remove(); banner = null;
 };
}
