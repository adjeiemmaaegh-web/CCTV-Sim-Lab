/**
 * Offline activation safety: never replace the active editor while a project
 * is still saving, blocked, or unable to flush its IndexedDB write queue.
 * This frontend owns the update handshake; the SW only performs cache I/O.
 */
export type SafeUpdate = () => Promise<boolean>;

export function setupOffline(canUpdate: SafeUpdate): () => void {
 if (!('serviceWorker' in navigator) ||
     !(location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  return () => {};
 }
 let disposed = false;
 let cleanupController = () => {};
 let banner: HTMLElement | null = null;

 void navigator.serviceWorker.register('/service-worker.js').then(reg => {
  if (disposed) return;
  const onControllerChange = () => { if (!disposed) location.reload(); };
  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  cleanupController = () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  const offerUpdate = () => {
   if (disposed || !reg.waiting || banner) return;
   const element = document.createElement('div');
   element.id = 'securitylab-update-ready'; element.className = 'toast'; element.role = 'status';
   const explanation = document.createElement('span');
   explanation.textContent = 'A new SecurityLab build is available. Save your current work before activating it. ';
   element.appendChild(explanation);
   const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Save & update';
   button.onclick = async () => {
    button.disabled = true;
    try {
     const safe = await canUpdate();
     if (!safe) { explanation.textContent = 'Cannot update until this project is safely saved. Export your work or resolve the save error. '; return; }
     const waiting = reg.waiting;
     if (waiting) waiting.postMessage({type:'ACTIVATE_UPDATE'});
    } catch (error) {
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
 return () => { disposed = true; cleanupController(); banner?.remove(); banner = null; };
}
