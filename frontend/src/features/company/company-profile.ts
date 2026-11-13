import { assertNoPendingRestore } from "../storage/restore-transaction";
export const companyProfileKey = "forma:company-profile:v1";
export const companyProfileRoute = "/setari/date-firma";
export const logoMaxBytes = 128 * 1024;
export type CompanyLogo = {data_url:string;format:"PNG"|"JPEG";width:number;height:number};
export type CompanyProfile = {
  display_name:string;contact_person:string;phone:string;email:string;address:string;website:string;
  registration_info:string;tax_info:string;quotation_notes:string;validity_days:number|null;logo:CompanyLogo|null;
};
export const emptyCompanyProfile=():CompanyProfile=>({display_name:"",contact_person:"",phone:"",email:"",address:"",website:"",registration_info:"",tax_info:"",quotation_notes:"",validity_days:null,logo:null});
const lengths={display_name:160,contact_person:120,phone:60,email:254,address:500,website:1000,registration_info:200,tax_info:120,quotation_notes:2000} as const;
export function logoFormat(bytes:Uint8Array):"PNG"|"JPEG"|null {
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return "PNG";
  if(bytes[0]===255 && bytes[1]===216 && bytes[2]===255)return "JPEG";
  return null;
}
export function validateLogo(value:unknown):CompanyLogo {
  const v=value as CompanyLogo;
  if(!v || typeof v!=="object" || Object.keys(v).some(k=>!["data_url","format","width","height"].includes(k)) || ![v.width,v.height].every(n=>Number.isInteger(n) && n>0 && n<=2048) ||
    !["PNG","JPEG"].includes(v.format) || typeof v.data_url!=="string" || v.data_url.length>Math.ceil(logoMaxBytes/3)*4+30)throw new Error("Logo invalid. Folosește PNG sau JPEG, max. 128 KB și 2048 × 2048 px.");
  const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v.data_url);
  if(!match || match[2].length%4!==0)throw new Error("Conținutul logo-ului nu este valid.");
  const raw=atob(match[2]);
  if(raw.length>logoMaxBytes || logoFormat(Uint8Array.from(raw,c=>c.charCodeAt(0)))!==v.format || (match[1]==="png" ? "PNG":"JPEG")!==v.format)throw new Error("Formatul logo-ului nu corespunde conținutului.");
  return structuredClone(v);
}
export function validateCompanyProfile(value:unknown):CompanyProfile {
  if(!value || typeof value!=="object" || Array.isArray(value))throw new Error("Datele firmei sunt invalide.");
  const v=value as CompanyProfile;
  if(Object.keys(v).some(k=>![...Object.keys(lengths),"validity_days","logo"].includes(k)))throw new Error("Profilul firmei conține câmpuri neacceptate.");
  for(const [key,max] of Object.entries(lengths)){
    const text=v[key as keyof typeof lengths];
    if(typeof text!=="string" || text.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))throw new Error(`Verifică datele firmei; câmpurile au lungime limitată (${max} caractere).`);
  }
  if(!v.display_name.trim())throw new Error("Completează numele firmei sau al atelierului.");
  if(v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))throw new Error("Introdu o adresă de e-mail validă.");
  if(v.website){try{const url=new URL(v.website);if(!["http:","https:"].includes(url.protocol) || !url.hostname || url.username || url.password)throw new Error();}catch{throw new Error("Website-ul trebuie să fie un URL http:// sau https:// valid.");}}
  if(v.validity_days!==null && (!Number.isInteger(v.validity_days) || v.validity_days<1 || v.validity_days>365))throw new Error("Valabilitatea trebuie să fie între 1 și 365 de zile sau necompletată.");
  return {...v,display_name:v.display_name.trim(),logo:v.logo===null ? null:validateLogo(v.logo)};
}
export function loadCompanyProfile():CompanyProfile|null {
  if(typeof window==="undefined")return null;
  let raw:string|null;
  try{raw=window.localStorage.getItem(companyProfileKey);}catch{throw new Error("Browserul nu permite citirea datelor firmei.");}
  assertNoPendingRestore(window.localStorage);
  if(raw===null)return null;
  try{return decodeCompanyProfile(raw);}
  catch{throw new Error("Profilul salvat este invalid sau incompatibil. Datele existente nu au fost șterse.");}
}
export function decodeCompanyProfile(raw: string): CompanyProfile {
  const envelope = JSON.parse(raw);
  if (!envelope || envelope.schema_version !== 1 || Object.keys(envelope).some(key => !["schema_version", "profile"].includes(key))) throw new Error("Profilul firmei este incompatibil.");
  return validateCompanyProfile(envelope.profile);
}
export function saveCompanyProfile(profile:CompanyProfile):CompanyProfile {
  const valid=validateCompanyProfile(profile);
  assertNoPendingRestore(window.localStorage);
  try{window.localStorage.setItem(companyProfileKey,JSON.stringify({schema_version:1,profile:valid}));}
  catch{throw new Error("Profilul nu a putut fi salvat. Spațiul browserului poate fi plin sau blocat; datele anterioare sunt păstrate.");}
  return valid;
}
export async function readCompanyLogo(file:File):Promise<CompanyLogo> {
  if(file.size>logoMaxBytes || !["image/png","image/jpeg"].includes(file.type))throw new Error("Alege un logo PNG sau JPEG de maximum 128 KB. WebP nu este acceptat pentru logo.");
  const bytes=new Uint8Array(await file.arrayBuffer()),format=logoFormat(bytes);
  if(!format || (file.type==="image/png" ? "PNG":"JPEG")!==format)throw new Error("Fișierul nu conține o imagine PNG/JPEG validă.");
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;await image.decode();
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("Logo-ul nu poate fi citit."));reader.onload=()=>resolve(String(reader.result));reader.readAsDataURL(file);});
    return validateLogo({data_url:data,format,width:image.naturalWidth,height:image.naturalHeight});
  }catch(error){throw new Error(error instanceof Error && /2048/.test(error.message) ? error.message:"Logo-ul este corupt sau nu poate fi decodat. Alege o altă imagine.");}
  finally{URL.revokeObjectURL(url);}
}
