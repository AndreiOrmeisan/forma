"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categories, normalizedPrice, type CatalogItem, type CatalogState, type Supplier } from "./catalog-model";
import { itemInput, localCatalogRepository } from "./catalog-repository";
import { CatalogItemForm, SupplierForm } from "./catalog-forms";
import { CatalogBackupPanel } from "./catalog-backup";
import { CatalogConfirmDialog } from "./catalog-confirm-dialog";
import styles from "./catalog.module.css";

type Editor={kind:"supplier";value:Supplier|null}|{kind:"item";value:CatalogItem|null};
export function CatalogPage(){
  const [catalog,setCatalog]=useState<CatalogState|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[tab,setTab]=useState("items"),[editor,setEditor]=useState<Editor|null>(null),[deletion,setDeletion]=useState<{kind:"supplier"|"item";id:string;name:string}|null>(null);
  const [search,setSearch]=useState(""),[category,setCategory]=useState("all"),[active,setActive]=useState("all");
  const [success,setSuccess]=useState("");
  async function load(){try{setCatalog(await localCatalogRepository.load());setError("");}catch(reason){setError(reason instanceof Error ? reason.message:"Catalog indisponibil.");}}
  useEffect(()=>{let live=true;localCatalogRepository.load().then(value=>{if(live)setCatalog(value);}).catch(reason=>{if(live)setError(reason instanceof Error ? reason.message:"Catalog indisponibil.");});return()=>{live=false;};},[]);
  async function mutate(action:()=>Promise<CatalogState>){setBusy(true);setError("");setSuccess("");try{setCatalog(await action());setEditor(null);setDeletion(null);setSuccess("Catalogul a fost actualizat în acest browser.");}catch(reason){setError(reason instanceof Error ? reason.message:"Operația nu a reușit.");throw reason;}finally{setBusy(false);}}
  const suppliers=catalog?.suppliers || [];
  const items=(catalog?.items || []).filter(item=>(category==="all" || item.category===category) && (active==="all" || item.is_active===(active==="active")) && [item.name,item.item_code,item.supplier_sku,suppliers.find(s=>s.id===item.supplier_id)?.name].join(" ").toLocaleLowerCase("ro").includes(search.toLocaleLowerCase("ro")));
  return <main id="main-content" className={styles.page}>
    <Link href="/" className={styles.link}>← Domenii</Link><div className={styles.heading}><div><h1>Furnizori și prețuri</h1><p>Ofertele tale, pregătite pentru următorul proiect.</p></div><button className={styles.secondary} disabled={busy} onClick={()=>void load()}>Reîncarcă lista</button></div>
    <div className={styles.notice}>Catalog personal, salvat doar în acest browser. Nu este sincronizat între dispozitive și se poate pierde la ștergerea datelor site-ului. Fără prețuri de piață sau acces automat la furnizori.</div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {success && <p role="status">{success}</p>}
    {!catalog ? <p role="status">{error ? "Datele existente nu au fost înlocuite.":"Încărcăm catalogul…"}</p>:<>
      <div className={styles.tabs} aria-label="Secțiuni catalog"><button aria-pressed={tab==="items"} onClick={()=>{setTab("items");setEditor(null);}}>Catalog de prețuri ({catalog.items.length})</button><button aria-pressed={tab==="suppliers"} onClick={()=>{setTab("suppliers");setEditor(null);}}>Furnizori ({suppliers.length})</button></div>
      {editor?.kind==="supplier" && <SupplierForm key={editor.value?.id || "new-supplier"} initial={editor.value} busy={busy} onCancel={()=>setEditor(null)} onSave={input=>mutate(()=>localCatalogRepository.saveSupplier(input,editor.value?.id || null,catalog.revision))}/>}
      {editor?.kind==="item" && <CatalogItemForm key={editor.value?.id || "new-item"} initial={editor.value} catalog={catalog} busy={busy} onCancel={()=>setEditor(null)} onSave={input=>mutate(()=>localCatalogRepository.saveItem(input,editor.value?.id || null,catalog.revision))}/>}
      <section className={styles.section}><div className={styles.sectionHeader}><h2>{tab==="items" ? "Ofertele tale":"Furnizorii tăi"}</h2><button className={styles.primary} disabled={busy} onClick={()=>setEditor(tab==="items" ? {kind:"item",value:null}:{kind:"supplier",value:null})}>{tab==="items" ? "+ Adaugă ofertă":"+ Adaugă furnizor"}</button></div>
      {tab==="suppliers" ? <div className={styles.grid}>{suppliers.map(s=><article className={styles.card} key={s.id}><h3>{s.name}</h3>{s.website_url && <a className={styles.link} href={s.website_url} target="_blank" rel="noopener noreferrer">Website furnizor ↗</a>}<p style={{whiteSpace:"pre-wrap"}}>{s.contact_details}</p><p style={{whiteSpace:"pre-wrap"}}>{s.notes}</p><p className={styles.muted}>{catalog.items.filter(i=>i.supplier_id===s.id).length} oferte asociate</p><div className={styles.toolbar}><button className={styles.secondary} disabled={busy} onClick={()=>setEditor({kind:"supplier",value:s})}>Editează</button><button className={styles.danger} disabled={busy} onClick={()=>setDeletion({kind:"supplier",id:s.id,name:s.name})}>Șterge</button></div></article>)}</div>:<>
        <div className={styles.filters}><label>Caută ofertă sau furnizor<input value={search} onChange={e=>setSearch(e.target.value)} type="search"/></label><label>Categorie<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Toate</option>{Object.entries(categories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Stare<select value={active} onChange={e=>setActive(e.target.value)}><option value="all">Toate</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
        <p>O singură ofertă activă poate fi implicită pentru fiecare articol. Alegerea este explicită; nu selectăm automat cel mai mic preț.</p>
        <div className={styles.grid}>{items.map(item=><article className={styles.card} key={item.id}><div className={styles.cardTop}><span className={styles.muted}>{item.item_code}</span><span className={styles.badge}>{!item.is_active ? "Inactivă":item.is_preferred ? "Implicită":"Activă"}</span></div><h3>{item.name}</h3><p>{suppliers.find(s=>s.id===item.supplier_id)?.name || "Fără furnizor asociat"}</p><p className={styles.rate}>{item.unit_price_ron} RON / {item.purchase_unit==="sheet" ? "placă":item.purchase_unit}</p>{item.purchase_unit==="sheet" && <p>≈ {normalizedPrice(item)} RON / m² · {item.sheet_width_mm} × {item.sheet_length_mm} mm. Tarif echivalent, nu achiziție de plăci întregi.</p>}
          <details><summary>Detalii ofertă</summary><dl className={styles.details}>{[["Material",item.material_type],["Grosime",item.thickness_mm===null ? null:`${item.thickness_mm} mm`],["Finisaj",item.color_or_finish],["Cod furnizor",item.supplier_sku],["Actualizată",new Date(item.updated_at).toLocaleString("ro-RO")],["Sursă","Manuală"]].map(([label,value])=>value && <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{item.product_url && <a className={styles.link} href={item.product_url} target="_blank" rel="noopener noreferrer">Pagina produsului ↗</a>}</details>
          <div className={styles.toolbar}><button className={styles.secondary} disabled={busy} onClick={()=>setEditor({kind:"item",value:item})}>Editează</button>{item.is_active && !item.is_preferred && <button className={styles.secondary} disabled={busy} onClick={()=>void mutate(()=>localCatalogRepository.saveItem({...itemInput(item),is_preferred:true},item.id,catalog.revision)).catch(()=>{})}>Setează implicită</button>}<button className={styles.danger} disabled={busy} onClick={()=>setDeletion({kind:"item",id:item.id,name:item.name})}>Șterge</button></div>
        </article>)}</div></>}
      {(tab==="suppliers" ? !suppliers.length:!items.length) && <div className={`${styles.card} ${styles.empty}`}><h3>{tab==="suppliers" ? "Niciun furnizor încă.":"Nicio ofertă de afișat."}</h3><p>Adaugă propriile date. Catalogul pornește gol, fără exemple sau prețuri inventate.</p></div>}
      </section><CatalogBackupPanel catalog={catalog} onChange={setCatalog}/>
      {deletion && <CatalogConfirmDialog name={deletion.name} busy={busy} error={error} onCancel={()=>setDeletion(null)} onConfirm={()=>void mutate(()=>deletion.kind==="supplier" ? localCatalogRepository.deleteSupplier(deletion.id,catalog.revision):localCatalogRepository.deleteItem(deletion.id,catalog.revision)).catch(()=>{})}/>}
    </>}
  </main>;
}
