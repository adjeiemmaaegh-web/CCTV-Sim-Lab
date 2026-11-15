export type TabMessage={type:'project-saved'|'project-deleted';id:string;revision:number;writerId:string};
/** BroadcastChannel improves UX; IndexedDB compare-and-swap is the actual conflict authority. */
export function createTabMessenger(writerId:string,onExternal:(msg:TabMessage)=>void){
 const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('securitylab-project-updates-v2'):null;
 if(channel)channel.onmessage=ev=>{
  const x=ev.data as Partial<TabMessage>;
  if(!x||x.writerId===writerId||typeof x.id!=='string'||!Number.isSafeInteger(x.revision)||!['project-saved','project-deleted'].includes(String(x.type)))return;
  onExternal(x as TabMessage);
 };
 return {
  announce:(msg:Omit<TabMessage,'writerId'>)=>channel?.postMessage({...msg,writerId}),
  close:()=>channel?.close()
 };
}
