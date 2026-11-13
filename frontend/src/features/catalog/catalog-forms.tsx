"use client";

import { useState } from "react";
import { catalogDefinitions, canonicalPrice, sheetArea, normalizedPrice, validateItem, validateSupplier, type CatalogItem, type CatalogItemInput, type CatalogState, type ItemCode, type Supplier, type SupplierInput } from "./catalog-model";
import { formatExactDecimal } from "../furniture/calculate-wardrobe";
import styles from "./catalog.module.css";

export function SupplierForm({initial,busy,onSave,onCancel}:{initial:Supplier|null;busy:boolean;onSave:(input:SupplierInput)=>Promise<void>;onCancel:()=>void}){
  const [name,setName]=useState(initial?.name || ""),[website,setWebsite]=useState(initial?.website_url || ""),[contact,setContact]=useState(initial?.contact_details || ""),[notes,setNotes]=useState(initial?.notes || ""),[error,setError]=useState<string|null>(null);
  async function submit(){
    try{const input=validateSupplier({name,website_url:website.trim() || null,contact_details:contact || null,notes:notes || null});setError(null);await onSave(input);}
    catch(reason){setError(reason instanceof Error ? reason.message:"Furnizorul nu a putut fi salvat.");}
  }
  return <form className={styles.form} noValidate onSubmit={event=>{event.preventDefault();if(!busy)void submit();}}>
    <h3>{initial ? "Editează furnizorul":"Furnizor nou"}</h3><div className={styles.fields}>
      <label className={styles.field}>Nume furnizor<input value={name} maxLength={120} required disabled={busy} onChange={event=>setName(event.target.value)} /></label>
      <label className={styles.field}>Website · opțional<input type="url" value={website} placeholder="https://..." maxLength={2000} disabled={busy} onChange={event=>setWebsite(event.target.value)} /></label>
      <label className={styles.field}>Contact · opțional<textarea value={contact} maxLength={500} rows={3} disabled={busy} onChange={event=>setContact(event.target.value)} /></label>
      <label className={styles.field}>Note · opțional<textarea value={notes} maxLength={2000} rows={3} disabled={busy} onChange={event=>setNotes(event.target.value)} /></label>
    </div>{error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.toolbar}><button className={styles.primary} disabled={busy}>{busy ? "Salvăm…":"Salvează furnizorul"}</button><button className={styles.secondary} type="button" disabled={busy} onClick={onCancel}>Renunță</button></div>
  </form>;
}

type ItemDraft={code:ItemCode;name:string;supplier:string;sku:string;material:string;thickness:string;finish:string;purchase:string;price:string;width:string;length:string;url:string;active:boolean;preferred:boolean};
export function itemDraft(initial:CatalogItem|null):ItemDraft {
  return {code:initial?.item_code || "pal_18",name:initial?.name || "",supplier:initial?.supplier_id || "",sku:initial?.supplier_sku || "",material:initial?.material_type || "",thickness:String(initial ? initial.thickness_mm ?? "" : 18),finish:initial?.color_or_finish || "",purchase:initial?.purchase_unit || "m²",price:initial?.unit_price_ron || "",width:String(initial?.sheet_width_mm ?? ""),length:String(initial?.sheet_length_mm ?? ""),url:initial?.product_url || "",active:initial?.is_active ?? true,preferred:initial?.is_preferred ?? false};
}
export function itemFromDraft(draft:ItemDraft):CatalogItemInput {
  const definition=catalogDefinitions.find(d=>d.code===draft.code)!;
  const width=draft.purchase==="sheet" && /^\d+$/.test(draft.width) ? Number(draft.width):null;
  const length=draft.purchase==="sheet" && /^\d+$/.test(draft.length) ? Number(draft.length):null;
  return validateItem({item_code:draft.code,name:draft.name,category:definition.category,supplier_id:draft.supplier || null,supplier_sku:draft.sku || null,material_type:draft.material || null,
    thickness_mm:draft.thickness ? Number(draft.thickness.replace(",",".")):null,color_or_finish:draft.finish || null,sheet_width_mm:width,sheet_length_mm:length,
    purchase_unit:draft.purchase as CatalogItemInput["purchase_unit"],calculation_unit:definition.unit,unit_price_ron:canonicalPrice(draft.price),conversion_factor:draft.purchase==="sheet" ? sheetArea(width || 0,length || 0):"1",
    product_url:draft.url.trim() || null,source_type:"manual",is_active:draft.active,is_preferred:draft.active && draft.preferred});
}
export function CatalogItemForm({initial,catalog,busy,onSave,onCancel}:{initial:CatalogItem|null;catalog:CatalogState;busy:boolean;onSave:(input:CatalogItemInput)=>Promise<void>;onCancel:()=>void}){
  const [draft,setDraft]=useState(()=>itemDraft(initial)),[error,setError]=useState<string|null>(null);
  const set=(key:keyof ItemDraft,value:string|boolean)=>setDraft(previous=>({...previous,[key]:value}));
  const definition=catalogDefinitions.find(d=>d.code===draft.code)!;
  let equivalent:string|null=null;
  try{if(draft.purchase==="sheet")equivalent=normalizedPrice(itemFromDraft({...draft,name:draft.name || "Verificare conversie"}));}catch{/* Inline submit error explains invalid fields. */}
  async function submit(){try{setError(null);await onSave(itemFromDraft(draft));}catch(reason){setError(reason instanceof Error ? reason.message:"Oferta nu a putut fi salvată.");}}
  const input=(key:keyof ItemDraft,label:string,maxLength=100,inputMode?:"decimal"|"numeric")=><label className={styles.field}>{label}<input value={String(draft[key])} maxLength={maxLength} inputMode={inputMode} disabled={busy} onChange={event=>set(key,event.target.value)} /></label>;
  return <form className={styles.form} noValidate onSubmit={event=>{event.preventDefault();if(!busy)void submit();}}>
    <h3>{initial ? "Editează oferta":"Ofertă nouă"}</h3>
    <div className={styles.fields}>
      <label className={styles.field}>Articol calculat<select value={draft.code} disabled={busy} onChange={event=>{const value=catalogDefinitions.find(d=>d.code===event.target.value)!;setDraft(previous=>({...previous,code:value.code,purchase:value.unit,thickness:String(value.thickness ?? ""),width:"",length:"",preferred:false}));}}>{catalogDefinitions.map(d=><option key={d.code} value={d.code}>{d.name} · {d.unit}</option>)}</select></label>
      {input("name","Denumire ofertă",200)}
      <label className={styles.field}>Furnizor · opțional<select value={draft.supplier} disabled={busy} onChange={event=>set("supplier",event.target.value)}><option value="">Fără furnizor</option>{catalog.suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className={styles.field}>Unitate de cumpărare<select value={draft.purchase} disabled={busy} onChange={event=>setDraft(previous=>({...previous,purchase:event.target.value,width:"",length:""}))}><option value={definition.unit}>{definition.unit}</option>{["PAL","HDF"].includes(definition.category) && <option value="sheet">Placă întreagă</option>}</select></label>
      {input("price",`Preț manual · RON/${draft.purchase==="sheet" ? "placă":draft.purchase}`,32,"decimal")}
      {draft.purchase==="sheet" && <>{input("width","Lățime placă · mm",5,"numeric")}{input("length","Lungime placă · mm",5,"numeric")}</>}
    </div>
    {draft.purchase==="sheet" && <p className={styles.notice}>{equivalent!==null ? `${formatExactDecimal(equivalent)} RON/m² · tarif echivalent de suprafață. `:"Completează prețul și dimensiunile plăcii. "}Nu reprezintă costul cumpărării unui număr întreg de plăci. Nu calculăm optimizarea sau numărul de plăci.</p>}
    <details><summary>Detalii produs · opțional</summary><div className={styles.fields}>{input("sku","Cod produs furnizor")}{input("material","Tip material")}{input("thickness","Grosime · mm",10,"decimal")}{input("finish","Culoare / finisaj")}{input("url","URL produs",2000)}</div></details>
    <label className={styles.check}><input type="checkbox" checked={draft.active} disabled={busy} onChange={event=>setDraft(previous=>({...previous,active:event.target.checked,preferred:event.target.checked && previous.preferred}))} /> Ofertă activă</label>
    <label className={styles.check}><input type="checkbox" checked={draft.preferred} disabled={busy || !draft.active} onChange={event=>set("preferred",event.target.checked)} /> Folosește ca ofertă implicită pentru {definition.name}</label>
    <p>Nu alegem automat oferta cea mai ieftină. Rolele și pachetele nu sunt suportate. Folosește tarife fără TVA pentru devizul actual; transportul nu este inclus automat.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.toolbar}><button className={styles.primary} disabled={busy}>{busy ? "Salvăm…":"Salvează oferta"}</button><button className={styles.secondary} type="button" disabled={busy} onClick={onCancel}>Renunță</button></div>
  </form>;
}
