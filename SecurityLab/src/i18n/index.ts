/**
 * Feature 18: lightweight translation layer. English is the source language; every other locale must define
 * exactly the same keys and placeholders (enforced by tests). Missing keys fall back to English. The preference
 * is the only thing stored in the browser (not project data) and storage failures are ignored.
 */
export const EN={
 'top.new':'New','top.open':'Open JSON','top.save':'Save Project','top.saveAs':'Save As','top.export':'Export Backup','top.checkpoints':'Checkpoints','top.import':'Import Copy','top.assess':'Assess Installation',
 'top.language':'Language','top.fieldReview':'Field Review','top.briefing':'Briefing',
 'tool.cli':'Network CLI','tool.trace':'Packet trace','tool.view':'Camera view','tool.lens':'Lens calculator','tool.anpr':'ANPR','tool.cable':'Cabling','tool.storage':'Storage','tool.scale':'Plan scale','tool.env':'Environment','tool.review':'Good practice','tool.lessons':'Lessons','tool.faults':'Fault exercise','tool.quote':'Quotation','tool.report':'Report / PDF','tool.audit':'Audit trail','tool.instructor':'Instructor',
 'floor.add':'＋ Add floor','floor.rename':'Rename','floor.remove':'Remove floor','floor.ground':'Ground floor',
 'lesson.steps':'{done}/{total} steps','lesson.complete':'lesson complete','lesson.why':'Why','lesson.hint':'Hint',
 'speak.read':'Read aloud','speak.stop':'Stop reading',
 'review.pass':'{n} pass','review.warn':'{n} warn','review.fail':'{n} fail',
} as const;
export type Key=keyof typeof EN;
export const FR:Record<Key,string>={
 'top.new':'Nouveau','top.open':'Ouvrir un JSON','top.save':'Enregistrer le projet','top.saveAs':'Enregistrer sous','top.export':'Exporter une sauvegarde','top.checkpoints':'Points de restauration','top.import':'Importer une copie','top.assess':'Évaluer l’installation',
 'top.language':'Langue','top.fieldReview':'Revue terrain','top.briefing':'Consignes',
 'tool.cli':'Console réseau','tool.trace':'Trace de paquets','tool.view':'Vue caméra','tool.lens':'Calculateur d’objectif','tool.anpr':'Lecture de plaques','tool.cable':'Câblage','tool.storage':'Stockage','tool.scale':'Échelle du plan','tool.env':'Environnement','tool.review':'Bonnes pratiques','tool.lessons':'Leçons','tool.faults':'Exercice de panne','tool.quote':'Devis','tool.report':'Rapport / PDF','tool.audit':'Journal des actions','tool.instructor':'Formateur',
 'floor.add':'＋ Ajouter un étage','floor.rename':'Renommer','floor.remove':'Supprimer l’étage','floor.ground':'Rez-de-chaussée',
 'lesson.steps':'{done}/{total} étapes','lesson.complete':'leçon terminée','lesson.why':'Pourquoi','lesson.hint':'Indice',
 'speak.read':'Lire à voix haute','speak.stop':'Arrêter la lecture',
 'review.pass':'{n} conformes','review.warn':'{n} avertissements','review.fail':'{n} échecs',
};
export const LOCALES:Record<string,{name:string;dict:Partial<Record<Key,string>>;speech:string}>={
 en:{name:'English',dict:EN,speech:'en-GB'},
 fr:{name:'Français',dict:FR,speech:'fr-FR'},
};
const STORAGE_KEY='securitylab.locale';
let current='en';
const listeners=new Set<()=>void>();

export function interpolate(template:string,vars?:Record<string,string|number>):string{
 return template.replace(/\{(\w+)\}/g,(m,k)=>vars&&k in vars?String(vars[k]):m);
}
export function translate(locale:string,key:Key,vars?:Record<string,string|number>):string{
 const text=LOCALES[locale]?.dict[key]??EN[key];
 return interpolate(text,vars);
}
export const t=(key:Key,vars?:Record<string,string|number>)=>translate(current,key,vars);
export const getLocale=()=>current;
export function setLocale(locale:string,persist=true):void{
 if(!LOCALES[locale])throw new Error(`Unsupported language ${locale}`);
 current=locale;
 if(persist){try{globalThis.localStorage?.setItem(STORAGE_KEY,locale);}catch{/* storage unavailable: preference lasts for this session only */}}
 listeners.forEach(l=>l());
}
export function loadSavedLocale():string{
 try{const s=globalThis.localStorage?.getItem(STORAGE_KEY);if(s&&LOCALES[s])current=s;}catch{/* ignore */}
 return current;
}
export const subscribe=(l:()=>void)=>{listeners.add(l);return ()=>{listeners.delete(l);};};
export const speechLang=()=>LOCALES[current].speech;
