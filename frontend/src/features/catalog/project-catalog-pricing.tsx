"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { catalogRoute } from "./catalog-model";
import { localCatalogRepository } from "./catalog-repository";
import { applyOffers, ManualCatalogPriceSource, requiredPriceCodes, type ResolvedOffer } from "./catalog-price-source";
import { useWardrobeProject } from "../furniture/wardrobe-project-context";
import { invalidPricing, saveProjectPrices } from "../furniture/project-api";
import { estimateWardrobe } from "../furniture/estimate-wardrobe";
import { priceItems } from "../furniture/wardrobe-pricing";
import { priceStateSignature } from "../furniture/project-price-snapshot";
import { formatExactDecimal } from "../furniture/calculate-wardrobe";
import type { WardrobeConfiguration } from "../furniture/wardrobe-configuration";
import styles from "./catalog.module.css";

type Preview={offers:ResolvedOffer[];revision:number};
export function ProjectCatalogPricing({configuration,onBusyChange}:{configuration:WardrobeConfiguration;onBusyChange?:(value:boolean)=>void}){
  const {calculation,pricing,priceSnapshots=[],savedProject,catalogInitialized,applyProjectPrices}=useWardrobeProject();
  const [error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null);
  const [unresolved,setUnresolved]=useState<ResolvedOffer[]>([]);
  const [preview,setPreview]=useState<Preview|null>(null),[retain,setRetain]=useState(true),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
  const action=useRef<AbortController|null>(null);
  const signature=priceStateSignature(configuration,pricing,priceSnapshots,savedProject?.id || null);
  const ready=!!calculation && JSON.stringify(calculation.input_configuration)===JSON.stringify(configuration);
  useEffect(()=>()=>action.current?.abort(),[]);
  useEffect(()=>{
    if(!ready || !calculation || savedProject || catalogInitialized || invalidPricing(pricing))return;
    const controller=new AbortController();let active=true;
    const timeout=window.setTimeout(()=>controller.abort(),20000);
    async function initialize(){
      try{
        const catalog=await localCatalogRepository.load();
        const offers=new ManualCatalogPriceSource().resolve(requiredPriceCodes(calculation!),catalog,new Date().toISOString());
        const next=applyOffers(pricing,priceSnapshots,offers,"initial");
        const estimate=await estimateWardrobe(configuration,next.pricing,next.snapshots,controller.signal);
        if(active){applyProjectPrices(next.pricing,next.snapshots,estimate,signature);setUnresolved(offers.filter(offer=>!offer.snapshot));setNotice("Prețurile implicite disponibile au fost aplicate acestui proiect. Cele lipsă se pot completa manual.");setError(null);}
      }catch{if(active)setError("Prețurile din catalog nu au putut fi aplicate automat. Poți completa manual sau încerca din nou; nu am înlocuit datele proiectului.");}
      finally{window.clearTimeout(timeout);}
    }
    void initialize();
    return ()=>{active=false;controller.abort();window.clearTimeout(timeout);};
  },[ready,calculation,savedProject,catalogInitialized,pricing,priceSnapshots,configuration,signature,applyProjectPrices,attempt]);

  async function openPreview(){
    if(!calculation || !ready || invalidPricing(pricing))return;
    setBusy(true);setError(null);setNotice(null);
    try{const catalog=await localCatalogRepository.load();setRetain(true);setPreview({revision:catalog.revision,offers:new ManualCatalogPriceSource().resolve(requiredPriceCodes(calculation),catalog,new Date().toISOString())});}
    catch(reason){setError(reason instanceof Error ? reason.message : "Catalogul nu poate fi citit.");}
    finally{setBusy(false);}
  }
  async function confirmRefresh(){
    if(!preview)return;
    setBusy(true);onBusyChange?.(true);setError(null);
    const controller=new AbortController();action.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),20000);
    try{
      const catalog=await localCatalogRepository.load();
      if(catalog.revision!==preview.revision)throw new Error("Catalogul s-a modificat. Închide previzualizarea și verifică din nou diferențele.");
      const next=applyOffers(pricing,priceSnapshots,preview.offers,"refresh",retain);
      const estimate=await estimateWardrobe(configuration,next.pricing,next.snapshots,controller.signal);
      if(controller.signal.aborted)return;
      const saved=savedProject ? await saveProjectPrices(savedProject,configuration,next.pricing,next.snapshots) : undefined;
      if(controller.signal.aborted)return;
      applyProjectPrices(next.pricing,next.snapshots,estimate,signature,saved);
      setUnresolved(preview.offers.filter(offer=>!offer.snapshot));setPreview(null);setNotice(saved ? "Copia de prețuri a fost actualizată și salvată. Alte modificări ale proiectului se salvează separat." : "Prețurile au fost actualizate și devizul recalculat. Salvează proiectul pentru a păstra copia de prețuri.");
    }catch(reason){setError(reason instanceof Error ? reason.message : "Prețurile nu au putut fi actualizate.");}
    finally{window.clearTimeout(timeout);setBusy(false);onBusyChange?.(false);action.current=null;}
  }
  const next=preview ? applyOffers(pricing,priceSnapshots,preview.offers,"refresh",retain) : null;
  return <section className={styles.projectCatalog} aria-label="Prețuri din catalogul personal">
    <div className={styles.toolbar}><Link className={styles.link} href={catalogRoute}>Furnizori și prețuri</Link>
      <button type="button" className={styles.secondary} disabled={busy || !ready || invalidPricing(pricing)} onClick={()=>void openPreview()}>Actualizează prețurile din catalog</button></div>
    <p>Catalogul este personal acestui browser. Proiectele păstrează o copie a prețurilor; modificările catalogului nu le actualizează automat.</p>
    {notice && <p role="status">{notice}</p>}
    {unresolved.length>0 && <details><summary>Articole fără ofertă implicită ({unresolved.length})</summary><ul className={styles.changes}>{unresolved.map(offer=><li key={offer.item_code}>{offer.message}</li>)}</ul></details>}
    {error && <div role="alert"><p className={styles.error}>{error}</p>{!savedProject && !catalogInitialized && <button type="button" className={styles.secondary} disabled={busy} onClick={()=>setAttempt(value=>value+1)}>Reîncearcă aplicarea inițială</button>}</div>}
    {preview && next && <div className={styles.preview}>
      <h3>Verifică diferențele înainte de aplicare</h3>
      <label className={styles.check}><input type="checkbox" checked={retain} disabled={busy} onChange={event=>setRetain(event.target.checked)} /> Păstrează prețurile suprascrise manual, inclusiv cele șterse</label>
      <ul className={styles.changes}>{preview.offers.map(offer=>{
        const previous=priceSnapshots.find(s=>s.item_code===offer.item_code),kept=retain && previous?.is_override;
        return <li key={offer.item_code}><strong>{priceItems.find(([code])=>code===offer.item_code)?.[1]}</strong>
          <span>{pricing[offer.item_code] ? formatExactDecimal(pricing[offer.item_code].replace(",","."))+" RON" : "Lipsă"} → {next.pricing[offer.item_code] ? formatExactDecimal(next.pricing[offer.item_code].replace(",","."))+" RON" : "Lipsă"}</span>
          <small>{kept ? "Suprascriere manuală păstrată" : offer.message}{offer.snapshot && !kept ? ` · ${offer.snapshot.supplier_name || "Fără furnizor"}` : ""}</small></li>;
      })}</ul>
      <p>O ofertă lipsă, inactivă sau fără preferință nu șterge un preț existent. Confirmarea recalculează prin backend și salvează numai prețurile dacă proiectul există deja.</p>
      <div className={styles.toolbar}><button type="button" className={styles.primary} disabled={busy} onClick={()=>void confirmRefresh()}>{busy ? "Aplicăm și recalculăm…" : "Confirmă actualizarea prețurilor"}</button><button type="button" className={styles.secondary} disabled={busy} onClick={()=>setPreview(null)}>Renunță</button></div>
    </div>}
    {priceSnapshots.length>0 && <details><summary>Sursele prețurilor proiectului</summary><ul className={styles.changes}>{priceSnapshots.map(snapshot=><li key={snapshot.item_code}>
      <strong>{priceItems.find(([code])=>code===snapshot.item_code)?.[1]}</strong><span>{snapshot.supplier_name || (snapshot.source_type==="manual_catalog" ? "Catalog personal":"Preț manual")}{snapshot.is_override ? " · suprascris manual":""}</span>
      <small>Aplicat {new Intl.DateTimeFormat("ro-RO",{dateStyle:"medium"}).format(new Date(snapshot.applied_at))}</small>
    </li>)}</ul></details>}
  </section>;
}
