"use client";

import { useState } from "react";
import { exportCatalog, localCatalogRepository, parseCatalogBackup, previewImport, type CatalogBackup, type ImportMode } from "./catalog-repository";
import type { CatalogState } from "./catalog-model";
import styles from "./catalog.module.css";
import { catalogBackupMaxBytes } from "../storage/size-policy";

export function CatalogBackupPanel({catalog,onChange}:{catalog:CatalogState;onChange:(state:CatalogState)=>void}) {
  const [backup,setBackup]=useState<CatalogBackup|null>(null),[mode,setMode]=useState<ImportMode>("merge"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const plan=backup ? previewImport(catalog,backup,mode):null;
  function download(){
    try {
    const url=URL.createObjectURL(new Blob([JSON.stringify(exportCatalog(catalog))],{type:"application/json;charset=utf-8"}));
    const anchor=document.createElement("a");anchor.href=url;anchor.download="forma-mobilier-catalog.json";anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(error) {setMessage(error instanceof Error ? error.message:"Exportul nu a reușit.");}
  }
  async function select(file:File|undefined){
    setBackup(null);setMessage("");if(!file)return;
    try{if(file.size>catalogBackupMaxBytes)throw new Error("Fișierul poate avea maximum 16 MB (UTF-8).");setBackup(parseCatalogBackup(await file.text()));}
    catch(error){setMessage(error instanceof Error ? error.message:"Import invalid.");}
  }
  async function confirm(){
    if(!backup)return;setBusy(true);
    try{onChange(await localCatalogRepository.importBackup(backup,mode,catalog.revision));setBackup(null);setMessage("Catalog importat. Proiectele existente nu au fost modificate.");}
    catch(error){setMessage(error instanceof Error ? error.message:"Importul nu a reușit.");}finally{setBusy(false);}
  }
  return <section className={styles.backup} aria-label="Backup catalog"><h2>O copie pentru siguranță</h2>
    <p>Exportă furnizorii și ofertele de mobilier într-un fișier JSON. Backup manual pentru acest domeniu, fără fotografii sau proiecte și fără sincronizare între dispozitive.</p>
    <button className={styles.secondary} onClick={download}>Exportă catalogul</button>
    <label className={styles.field}>Importă un backup JSON · max. 16 MB<input type="file" accept="application/json,.json" disabled={busy} onChange={event=>void select(event.target.files?.[0])}/></label>
    {plan && <div className={styles.preview}><h3>Verifică importul</h3>
      <label className={styles.field}>Mod de import<select value={mode} disabled={busy} onChange={event=>setMode(event.target.value as ImportMode)}><option value="merge">Combină · păstrează înregistrările existente</option><option value="replace">Înlocuiește întregul catalog</option></select></label>
      <p>{plan.addedSuppliers} furnizori și {plan.addedItems} oferte de adăugat. {plan.skipped} înregistrări ignorate. {plan.removed} înregistrări curente înlocuite.</p>
      {plan.warnings.map((warning,index)=><p key={index}>{warning}</p>)}
      <div className={styles.toolbar}><button className={styles.primary} disabled={busy} onClick={()=>void confirm()}>{busy ? "Importăm…":"Confirmă importul"}</button><button className={styles.secondary} disabled={busy} onClick={()=>setBackup(null)}>Renunță</button></div>
    </div>}{message && <p role="status">{message}</p>}
  </section>;
}
