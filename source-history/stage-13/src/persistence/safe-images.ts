/**
 * Floor-plan image boundary. Imported images are user-supplied local references,
 * never uploaded. Decode before embedding; do not trust File.type alone.
 * SVG/HTML and animated formats are intentionally not accepted.
 */
const MAX_IMAGE_BYTES=2_000_000;
const MAX_IMAGE_SIDE=10_000;
const MAX_IMAGE_PIXELS=24_000_000;
export type SafeImage={dataUrl:string;width:number;height:number;mime:'image/png'|'image/jpeg'|'image/webp'};
function headerMime(bytes:Uint8Array):SafeImage['mime']|null{
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
async function dimensions(file:File):Promise<{width:number;height:number}>{
 if(typeof createImageBitmap==='function'){
  const bitmap=await createImageBitmap(file);
  try{return {width:bitmap.width,height:bitmap.height};}finally{bitmap.close();}
 }
 // Safari and older browsers may lack createImageBitmap. Object URLs are revoked.
 return await new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{const {naturalWidth:width,naturalHeight:height}=img;URL.revokeObjectURL(url);resolve({width,height});};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Image could not be decoded'));};
  img.src=url;
 });
}
export async function readSafeFloorplanImage(file:File):Promise<SafeImage>{
 if(file.size===0||file.size>MAX_IMAGE_BYTES)throw new Error('Choose an image no larger than 2 MB');
 const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const mime=headerMime(bytes);
 if(!mime||(file.type&&file.type!==mime))throw new Error('Invalid image signature: use a genuine PNG, JPEG or WebP file');
 let size:{width:number;height:number};
 try{size=await dimensions(file);}catch{throw new Error('Floor-plan image failed decoding');}
 if(!size.width||!size.height||size.width>MAX_IMAGE_SIDE||size.height>MAX_IMAGE_SIDE||
    size.width*size.height>MAX_IMAGE_PIXELS)throw new Error('Floor-plan dimensions exceed the safe limit (24 million pixels)');
 const dataUrl=await new Promise<string>((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Floor-plan image read failed'));reader.readAsDataURL(new Blob([file],{type:mime}));
 });
 if(!dataUrl.startsWith(`data:${mime};base64,`))throw new Error('Invalid decoded floor-plan data');
 return {dataUrl,width:size.width,height:size.height,mime};
}
