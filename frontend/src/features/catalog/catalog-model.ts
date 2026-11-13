import { priceItems, pricingError } from "../furniture/wardrobe-pricing";

export type ItemCode = typeof priceItems[number][0];
export type CalculationUnit = typeof priceItems[number][2];
export type Category = "PAL" | "HDF" | "ABS" | "hinges" | "shelf_supports" | "handles" | "cabinet_connectors" | "hdf_fasteners";
export const categories: Record<Category,string> = {PAL:"PAL",HDF:"HDF",ABS:"ABS",hinges:"Balamale",shelf_supports:"Suporți polițe",handles:"Mânere",cabinet_connectors:"Conectori carcasă",hdf_fasteners:"Fixare HDF"};
export const catalogDefinitions = priceItems.map(([code,name,unit])=>({code,name,unit,
  category:(code === "pal_18" ? "PAL" : code === "hdf_3" ? "HDF" : code.startsWith("abs_") ? "ABS" : code) as Category,
  thickness:code === "pal_18" ? 18 : code === "hdf_3" ? 3 : code === "abs_2" ? 2 : code === "abs_0_4" ? 0.4 : null,
}));
export const catalogRoute = "/setari/furnizori";
export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isObject=(v:unknown):v is Record<string,unknown>=>!!v && typeof v === "object" && !Array.isArray(v);
export const onlyKeys=(v:unknown,keys:string[])=>isObject(v) && Object.keys(v).every(key=>keys.includes(key));
export const validDate=(v:unknown):v is string=>typeof v === "string" && /(Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
export class CatalogError extends Error {}
export type SupplierInput={name:string;website_url:string|null;contact_details:string|null;notes:string|null};
export type Supplier=SupplierInput & {id:string;created_at:string;updated_at:string};
export type CatalogItemInput={item_code:ItemCode;name:string;category:Category;supplier_id:string|null;supplier_sku:string|null;
  material_type:string|null;thickness_mm:number|null;color_or_finish:string|null;sheet_width_mm:number|null;sheet_length_mm:number|null;
  purchase_unit:"m²"|"m"|"buc."|"sheet";calculation_unit:CalculationUnit;unit_price_ron:string;conversion_factor:string;
  product_url:string|null;source_type:"manual";is_active:boolean;is_preferred:boolean};
export type CatalogItem=CatalogItemInput & {id:string;updated_at:string};
export type CatalogState={schema_version:1;revision:number;suppliers:Supplier[];items:CatalogItem[]};
export const emptyCatalog=():CatalogState=>({schema_version:1,revision:0,suppliers:[],items:[]});
export const supplierFields=["name","website_url","contact_details","notes"];
export const itemFields=["item_code","name","category","supplier_id","supplier_sku","material_type","thickness_mm","color_or_finish","sheet_width_mm","sheet_length_mm","purchase_unit","calculation_unit","unit_price_ron","conversion_factor","product_url","source_type","is_active","is_preferred"];

function text(value:unknown,max:number,required=false):boolean {
  return value === null ? !required : typeof value === "string" && value.length<=max && (!required || value.trim().length>0);
}
export function validUrl(value:unknown):boolean {
  if(value === null || value === "")return true;
  if(typeof value !== "string" || value.length>2000)return false;
  try {const url=new URL(value);return ["http:","https:"].includes(url.protocol) && !!url.hostname && !url.username && !url.password;}
  catch{return false;}
}
export function validateSupplier(value:unknown):SupplierInput {
  if(!onlyKeys(value,supplierFields))throw new CatalogError("Datele furnizorului sunt invalide.");
  const v=value as SupplierInput;
  if(!text(v.name,120,true))throw new CatalogError("Numele furnizorului trebuie să aibă 1–120 de caractere.");
  if(!validUrl(v.website_url))throw new CatalogError("Adresa furnizorului trebuie să fie un URL http:// sau https:// valid, fără date de autentificare.");
  if(!text(v.contact_details,500) || !text(v.notes,2000))throw new CatalogError("Contactul poate avea maximum 500 de caractere, iar notele maximum 2000.");
  return {...v,name:v.name.trim(),website_url:v.website_url?.trim() || null,contact_details:v.contact_details?.trim() || null,notes:v.notes?.trim() || null};
}

export function canonicalPrice(value:string):string {
  const v=value.trim().replace(",", ".");
  if(v.length>32 || pricingError(v))throw new CatalogError("Introdu un preț între 0 și 1.000.000.000 RON, cu maximum 6 zecimale.");
  const [whole,fraction=""]=v.split(".");
  const rest=fraction.replace(/0+$/,"");
  return `${BigInt(whole)}${rest ? "."+rest : ""}`;
}
function scaled(value:string):bigint {
  const [whole,fraction=""]=canonicalPrice(value).split(".");
  return BigInt(whole)*BigInt(1000000)+BigInt((fraction+"000000").slice(0,6));
}
function decimal(value:bigint):string {
  const whole=value/BigInt(1000000),fraction=String(value%BigInt(1000000)).padStart(6,"0").replace(/0+$/,"");
  return `${whole}${fraction ? "."+fraction : ""}`;
}
export function sheetArea(width:number,length:number):string {
  if(![width,length].every(v=>Number.isSafeInteger(v) && v>=1 && v<=10000))throw new CatalogError("Dimensiunile plăcii trebuie să fie numere întregi între 1 și 10000 mm.");
  return decimal(BigInt(width)*BigInt(length));
}
export function normalizedPrice(item:Pick<CatalogItemInput,"purchase_unit"|"unit_price_ron"|"sheet_width_mm"|"sheet_length_mm">):string {
  const price=canonicalPrice(item.unit_price_ron);
  if(item.purchase_unit !== "sheet")return price;
  sheetArea(item.sheet_width_mm ?? 0,item.sheet_length_mm ?? 0);
  const denominator=BigInt(item.sheet_width_mm!)*BigInt(item.sheet_length_mm!);
  const numerator=scaled(price)*BigInt(1000000);
  const rounded=numerator/denominator + (numerator%denominator*BigInt(2)>=denominator ? BigInt(1):BigInt(0));
  if(rounded === BigInt(0) && scaled(price)>BigInt(0))throw new CatalogError("Tariful echivalent este prea mic pentru precizia de 6 zecimale; verifică unitățile.");
  return canonicalPrice(decimal(rounded));
}
export function validateItem(value:unknown):CatalogItemInput {
  if(!onlyKeys(value,itemFields))throw new CatalogError("Datele ofertei sunt invalide.");
  const v=value as CatalogItemInput,definition=catalogDefinitions.find(d=>d.code===v.item_code);
  if(!definition || v.category!==definition.category || v.calculation_unit!==definition.unit)throw new CatalogError("Codul, categoria și unitatea de calcul nu corespund articolului.");
  if(!text(v.name,200,true) || !text(v.supplier_sku,100) || !text(v.material_type,100) || !text(v.color_or_finish,100))throw new CatalogError("Completează numele și respectă lungimea câmpurilor ofertei.");
  if(v.supplier_id!==null && (typeof v.supplier_id!=="string" || !uuidPattern.test(v.supplier_id)))throw new CatalogError("Furnizorul selectat este invalid.");
  if(v.thickness_mm!==null && v.thickness_mm!==definition.thickness)throw new CatalogError("Grosimea trebuie să corespundă codului și profilului POC actual.");
  if(!validUrl(v.product_url) || v.source_type!=="manual" || typeof v.is_active!=="boolean" || typeof v.is_preferred!=="boolean" || (v.is_preferred && !v.is_active))throw new CatalogError("Verifică URL-ul produsului, starea activă și preferința ofertei.");
  if(v.purchase_unit!==definition.unit && !(v.purchase_unit==="sheet" && ["PAL","HDF"].includes(v.category)))throw new CatalogError("Unitate neacceptată. Rolele și pachetele nu sunt suportate în acest sprint.");
  const unit_price_ron=canonicalPrice(v.unit_price_ron);
  const factor=v.purchase_unit==="sheet" ? sheetArea(v.sheet_width_mm ?? 0,v.sheet_length_mm ?? 0) : "1";
  if(v.conversion_factor!==factor || (v.purchase_unit!=="sheet" && (v.sheet_width_mm!==null || v.sheet_length_mm!==null)))throw new CatalogError("Conversia sau dimensiunile plăcii sunt invalide.");
  normalizedPrice({...v,unit_price_ron});
  return {...v,name:v.name.trim(),unit_price_ron,product_url:v.product_url?.trim() || null};
}
export function validateCatalog(value:unknown):CatalogState {
  if(!onlyKeys(value,["schema_version","revision","suppliers","items"]))throw new CatalogError("Catalogul nu poate fi citit. Datele existente nu au fost șterse.");
  const v=value as CatalogState;
  if(v.schema_version!==1 || !Number.isSafeInteger(v.revision) || v.revision<0 || !Array.isArray(v.suppliers) || !Array.isArray(v.items) || v.suppliers.length>500 || v.items.length>3000)throw new CatalogError("Versiunea sau structura catalogului nu este suportată.");
  const supplierIds=new Set<string>(),itemIds=new Set<string>(),preferred=new Set<string>();
  for(const supplier of v.suppliers){
    if(!onlyKeys(supplier,[...supplierFields,"id","created_at","updated_at"]) || !uuidPattern.test(supplier.id) || !validDate(supplier.created_at) || !validDate(supplier.updated_at) || supplierIds.has(supplier.id))throw new CatalogError("Furnizor duplicat sau invalid în catalog.");
    const {id,created_at,updated_at,...input}=supplier;void created_at;void updated_at;validateSupplier(input);supplierIds.add(id);
  }
  for(const item of v.items){
    if(!onlyKeys(item,[...itemFields,"id","updated_at"]) || !uuidPattern.test(item.id) || !validDate(item.updated_at) || itemIds.has(item.id))throw new CatalogError("Ofertă duplicată sau invalidă în catalog.");
    const {id,updated_at,...input}=item;void updated_at;validateItem(input);itemIds.add(id);
    if(item.supplier_id && !supplierIds.has(item.supplier_id))throw new CatalogError("O ofertă indică un furnizor care nu există.");
    if(item.is_preferred){if(preferred.has(item.item_code))throw new CatalogError("Poate exista o singură ofertă implicită activă pentru fiecare cod.");preferred.add(item.item_code);}
  }
  return structuredClone(v);
}
