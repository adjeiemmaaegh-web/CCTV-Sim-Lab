import React from 'react';

/** Small inline stroke icons (24x24 grid). Decorative: always aria-hidden; the owning control carries the label. */
const P:Record<string,React.ReactNode>={
 equipment:<><path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/></>,
 network:<><circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v4.3M12 11.5 5.8 17M12 11.5l6.2 5.5"/></>,
 alarm:<><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
 access:<><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-2 5.5-2 6 0M14 10h4M14 14h3"/></>,
 power:<path d="M13 2 5 13h6l-1 9 8-11h-6z"/>,
 scenarios:<><circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5z"/></>,
 assessment:<><rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12.5 3 3 5-6"/></>,
 settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
 help:<><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/></>,
 folder:<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,
 camera:<><path d="M3 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m15 11 6-3v8l-6-3"/></>,
 recorder:<><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="7.5" cy="12" r="1"/><path d="M12 12h6"/></>,
 router:<><rect x="3" y="13" width="18" height="6" rx="2"/><path d="M7 16h.01M11 16h.01M8 10a5.5 5.5 0 0 1 8 0M5.5 7.5a9 9 0 0 1 13 0"/></>,
 switch:<><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M7 12h.01M10 12h.01M13 12h.01M16 12h.01"/></>,
 siren:<><path d="M7 18v-5a5 5 0 0 1 10 0v5"/><path d="M5 18h14v3H5zM12 3v2M4.5 6.5 6 8M19.5 6.5 18 8"/></>,
 keypad:<><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9.5 8h.01M12 8h.01M14.5 8h.01M9.5 12h.01M12 12h.01M14.5 12h.01M9.5 16h.01M12 16h.01M14.5 16h.01"/></>,
 lock:<><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
 battery:<><rect x="3" y="8" width="16" height="9" rx="2"/><path d="M21 11v3M7 12.5h6"/></>,
 sensor:<><circle cx="12" cy="12" r="3"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4"/></>,
 select:<path d="m5 3 14 8-6 1.5L10 19z"/>,
 pan:<path d="M9 11V5a1.5 1.5 0 0 1 3 0v5m0-3a1.5 1.5 0 0 1 3 0v4m0-2a1.5 1.5 0 0 1 3 0v6a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-3l-3-4a1.5 1.5 0 0 1 2.5-1.7L9 15"/>,
 cable:<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></>,
 wall:<path d="M3 6h18v12H3zM3 12h18M9 6v6M15 12v6"/>,
 room:<rect x="4" y="5" width="16" height="14" rx="1" strokeDasharray="3 2"/>,
 door:<><path d="M6 21V4h9v17M3 21h18"/><path d="M12 12h.01"/></>,
 window:<><rect x="5" y="4" width="14" height="16" rx="1"/><path d="M12 4v16M5 12h14"/></>,
 measure:<><path d="m3 17 4-4 4 4M3 17l14-14 4 4L7 21z"/><path d="m8 9 2 2M11 6l2 2M14 3l2 2"/></>,
 test:<><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></>,
 trash:<><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></>,
 grid:<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>,
 undo:<path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 0 12"/>,
 redo:<path d="m15 7 5 5-5 5M20 12H10a6 6 0 0 0 0 12"/>,
 search:<><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/></>,
 chevron:<path d="m6 9 6 6 6-6"/>,
 close:<path d="M6 6l12 12M18 6 6 18"/>,
 play:<path d="M8 5v14l11-7z"/>,
 pause:<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>,
 realtime:<path d="M3 12h4l3-7 4 14 3-7h4"/>,
 events:<><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
 diagnostics:<path d="M3 12h4l3-7 4 14 3-7h4"/>,
 console:<><path d="m5 8 4 4-4 4M12 17h7"/></>,
 tools:<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z"/>,
 more:<path d="M5 12h.01M12 12h.01M19 12h.01"/>,
 floorplan:<><path d="M4 4h16v16H4z"/><path d="M4 11h7v9M14 4v7h6"/></>,
 focus:<path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6"/>,
 restore:<><path d="M3 10h7V3M21 10h-7V3M3 14h7v7M21 14h-7v7"/></>,
 topology:<><rect x="9" y="3" width="6" height="5" rx="1"/><rect x="3" y="16" width="6" height="5" rx="1"/><rect x="15" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M6 16v-4h12v4"/></>,
 shield:<path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/>,
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></>,
 gate:<path d="M3 20h18M5 20V6m14 14V6M5 9h14M5 14h14"/>,
 label:<><path d="M4 12V5h7l9 9-7 7z"/><circle cx="8" cy="9" r="1"/></>,
 image:<><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/></>,
 file:<><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></>,
};
export type IconName=keyof typeof P;
export function Icon({name,size=20}:{name:string;size?:number}){
 return <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]??P.equipment}</svg>;
}
/** Icon for a device kind in the library and properties panel. */
export function kindIcon(kind:string):string{
 if(kind==='camera')return 'camera';if(kind==='nvr'||kind==='dvr'||kind==='server'||kind==='access-server')return 'recorder';
 if(kind==='router'||kind==='ap')return 'router';if(kind==='switch')return 'switch';
 if(kind==='alarm-output')return 'siren';if(kind==='alarm-keypad')return 'keypad';if(kind.startsWith('alarm-sensor')||kind==='alarm-sensor')return 'sensor';if(kind.startsWith('alarm'))return 'alarm';
 if(kind==='access-lock')return 'lock';if(kind.startsWith('access'))return 'access';
 if(kind==='power-battery')return 'battery';if(kind.startsWith('power'))return 'power';
 return 'equipment';
}
