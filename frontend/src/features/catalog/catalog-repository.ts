import { CatalogError, emptyCatalog, isObject, itemFields, onlyKeys, supplierFields, validDate, validateCatalog, validateItem, validateSupplier,
  type CatalogItemInput, type CatalogState, type SupplierInput } from "./catalog-model";

export const legacyCatalogStorageKey="forma:supplier-catalog:v1";
export function catalogStorageKeyFor(domainId:string):string {
  if(!/^[a-z][a-z0-9_-]{0,49}$/.test(domainId))throw new CatalogError("Domeniul catalogului este invalid.");
  return `forma:supplier-catalog:${domainId}:v1`;
}
export const catalogStorageKey=catalogStorageKeyFor("furniture");
export type CatalogBackup={format:"forma-supplier-catalog";schema_version:1;domain_id:string;exported_at:string;suppliers:CatalogState["suppliers"];items:CatalogState["items"]};
export type ImportMode="merge"|"replace";
export interface CatalogRepository {
  load():Promise<CatalogState>;
  saveSupplier(input:SupplierInput,id:string|null,revision:number):Promise<CatalogState>;
  deleteSupplier(id:string,revision:number):Promise<CatalogState>;
  saveItem(input:CatalogItemInput,id:string|null,revision:number):Promise<CatalogState>;
  deleteItem(id:string,revision:number):Promise<CatalogState>;
  importBackup(backup:CatalogBackup,mode:ImportMode,revision:number):Promise<CatalogState>;
}
function storage():Storage {
  try{if(typeof window==="undefined")throw new Error();return window.localStorage;}
  catch{throw new CatalogError("Browserul nu permite accesul la catalog. Permite datele site-ului sau folosește o fereastră normală.");}
}
function read(domainId:string):CatalogState {
  let raw:string|null;
  try{
    raw=storage().getItem(catalogStorageKeyFor(domainId));
    // The previous global catalog supported furniture only. Read without rewriting
    // or deleting it; the next explicit edit saves the domain-scoped copy.
    if(raw===null && domainId==="furniture")raw=storage().getItem(legacyCatalogStorageKey);
  }catch{throw new CatalogError("Catalogul nu poate fi citit din acest browser.");}
  if(raw===null)return emptyCatalog();
  try{return validateCatalog(JSON.parse(raw));}
  catch{throw new CatalogError("Catalogul salvat este invalid sau are o versiune neacceptată. Nu am șters și nu am înlocuit datele. Păstrează o copie înainte de recuperare.");}
}
async function change(domainId:string,revision:number,apply:(state:CatalogState)=>CatalogState):Promise<CatalogState> {
  const action=async()=>{
    const current=read(domainId);
    if(current.revision!==revision)throw new CatalogError("Catalogul a fost modificat în altă filă. Reîncarcă lista înainte de a confirma din nou; formularul nu a fost șters.");
    const next=validateCatalog({...apply(structuredClone(current)),revision:current.revision+1});
    try{storage().setItem(catalogStorageKeyFor(domainId),JSON.stringify(next));}
    catch{throw new CatalogError("Catalogul nu a putut fi salvat. Spațiul browserului poate fi plin sau blocat. Datele anterioare au rămas păstrate.");}
    return next;
  };
  const lockName=domainId==="furniture" ? "forma:catalog-writes:v1" : `forma:catalog-writes:${domainId}:v1`;
  return typeof navigator!=="undefined" && navigator.locks ? navigator.locks.request(lockName,action) : action();
}
const stamp=(previous?:string)=>new Date(Math.max(Date.now(),previous ? Date.parse(previous)+1 : 0)).toISOString();
function withoutMeta<T extends object>(value:T,fields:string[]){return Object.fromEntries(fields.map(key=>[key,value[key as keyof T]]));}

export function exportCatalog(state:CatalogState,domainId="furniture"):CatalogBackup {
  catalogStorageKeyFor(domainId);
  const valid=validateCatalog(state);
  return {format:"forma-supplier-catalog",schema_version:1,domain_id:domainId,exported_at:stamp(),suppliers:valid.suppliers,items:valid.items};
}
export function parseCatalogBackup(text:string,domainId="furniture"):CatalogBackup {
  if(text.length>2*1024*1024)throw new CatalogError("Fișierul JSON poate avea maximum 2 MB.");
  let value:unknown;
  try{value=JSON.parse(text);}catch{throw new CatalogError("Fișierul nu conține JSON valid.");}
  if(!onlyKeys(value,["format","schema_version","domain_id","exported_at","suppliers","items"]) || !isObject(value) || value.format!=="forma-supplier-catalog" || value.schema_version!==1 || !validDate(value.exported_at))throw new CatalogError("Fișierul nu este un backup FORMA compatibil.");
  const incomingDomain=value.domain_id===undefined ? "furniture":value.domain_id;
  if(incomingDomain!==domainId)throw new CatalogError("Backup-ul aparține altui domeniu și nu poate fi importat aici.");
  const state=validateCatalog({schema_version:1,revision:0,suppliers:value.suppliers,items:value.items});
  return {format:"forma-supplier-catalog",schema_version:1,domain_id:domainId,exported_at:value.exported_at,suppliers:state.suppliers,items:state.items};
}
export function previewImport(current:CatalogState,backup:CatalogBackup,mode:ImportMode,domainId="furniture"){
  validateCatalog(current);
  const incoming=parseCatalogBackup(JSON.stringify(backup),domainId);
  if(mode!=="merge" && mode!=="replace")throw new CatalogError("Alege modul de import.");
  if(mode==="replace")return {next:{...current,suppliers:incoming.suppliers,items:incoming.items},addedSuppliers:incoming.suppliers.length,addedItems:incoming.items.length,
    skipped:0,removed:current.suppliers.length+current.items.length,warnings:["Catalogul curent va fi înlocuit integral. Proiectele și copiile lor de prețuri nu sunt modificate."]};
  const supplierIds=new Set(current.suppliers.map(s=>s.id)),itemIds=new Set(current.items.map(i=>i.id));
  const suppliers=incoming.suppliers.filter(s=>!supplierIds.has(s.id));
  const items=incoming.items.filter(i=>!itemIds.has(i.id)).map(item=>({...item}));
  const preferred=new Set(current.items.filter(i=>i.is_preferred).map(i=>i.item_code));
  const warnings:string[]=[];
  for(const item of items){
    if(item.is_preferred && preferred.has(item.item_code)){item.is_preferred=false;warnings.push(`Pentru ${item.item_code} păstrăm oferta implicită existentă; oferta importată va fi nepreferată.`);}
    else if(item.is_preferred)preferred.add(item.item_code);
  }
  const skipped=incoming.suppliers.length-suppliers.length+incoming.items.length-items.length;
  if(skipped)warnings.push(`${skipped} înregistrări cu ID existent nu vor fi suprascrise, chiar dacă fișierul are valori mai noi.`);
  return {next:{...current,suppliers:[...current.suppliers,...suppliers],items:[...current.items,...items]},addedSuppliers:suppliers.length,addedItems:items.length,skipped,removed:0,warnings};
}

export function createLocalCatalogRepository(domainId:string):CatalogRepository {
  catalogStorageKeyFor(domainId);
  const mutate=(revision:number,apply:(state:CatalogState)=>CatalogState)=>change(domainId,revision,apply);
  return {
  async load(){return read(domainId);},
  saveSupplier(input,id,revision){return mutate(revision,state=>{
    const valid=validateSupplier(input),existing=id ? state.suppliers.find(s=>s.id===id) : null;
    if(id && !existing)throw new CatalogError("Furnizorul nu mai există.");
    const now=stamp(existing?.updated_at),supplier={...valid,id:id || crypto.randomUUID(),created_at:existing?.created_at || now,updated_at:now};
    return {...state,suppliers:existing ? state.suppliers.map(s=>s.id===id ? supplier:s) : [...state.suppliers,supplier]};
  });},
  deleteSupplier(id,revision){return mutate(revision,state=>{
    if(!state.suppliers.some(s=>s.id===id))throw new CatalogError("Furnizorul nu mai există.");
    if(state.items.some(i=>i.supplier_id===id))throw new CatalogError("Furnizorul are oferte asociate. Reasignează sau șterge explicit ofertele înainte de a-l șterge.");
    return {...state,suppliers:state.suppliers.filter(s=>s.id!==id)};
  });},
  saveItem(input,id,revision){return mutate(revision,state=>{
    const valid=validateItem(input),existing=id ? state.items.find(i=>i.id===id) : null;
    if(id && !existing)throw new CatalogError("Oferta nu mai există.");
    const item={...valid,id:id || crypto.randomUUID(),updated_at:stamp(existing?.updated_at)};
    const items=state.items.filter(i=>i.id!==id).map(i=>item.is_preferred && i.item_code===item.item_code ? {...i,is_preferred:false,updated_at:stamp(i.updated_at)} : i);
    return {...state,items:[...items,item]};
  });},
  deleteItem(id,revision){return mutate(revision,state=>{
    if(!state.items.some(i=>i.id===id))throw new CatalogError("Oferta nu mai există.");
    return {...state,items:state.items.filter(i=>i.id!==id)};
  });},
  importBackup(backup,mode,revision){return mutate(revision,state=>previewImport(state,backup,mode,domainId).next);},
  };
}

// The only implemented domain. Future domains must also provide their own item
// validation and price source; scoping storage does not enable new calculators.
export const localCatalogRepository=createLocalCatalogRepository("furniture");

export const supplierInput=(value:CatalogState["suppliers"][number])=>withoutMeta(value,supplierFields) as SupplierInput;
export const itemInput=(value:CatalogState["items"][number])=>withoutMeta(value,itemFields) as CatalogItemInput;
