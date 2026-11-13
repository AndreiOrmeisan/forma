"use client";

import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { companyProfileRoute, loadCompanyProfile, type CompanyProfile } from "../company/company-profile";
import { useWardrobeProject } from "../furniture/wardrobe-project-context";
import { priceItems, type Estimate } from "../furniture/wardrobe-pricing";
import type { WardrobeConfiguration } from "../furniture/wardrobe-configuration";
import { pdfFilename, preparePdfData, quotationAvailable, sameConfiguration, type PdfKind } from "./pdf-data";
import styles from "./pdf-export.module.css";

export function PdfExportActions({configuration,estimate,blocked=false}:{configuration:WardrobeConfiguration;estimate:Estimate|null;blocked?:boolean}){
  const {calculation,projectName,savedProject,pricing,priceSnapshots}=useWardrobeProject();
  const [open,setOpen]=useState(false),[company,setCompany]=useState<CompanyProfile|null>(null),[busy,setBusy]=useState<PdfKind|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const lock=useRef(false),request=useRef<AbortController|null>(null);
  const signature=JSON.stringify({configuration,estimate,projectName,pricing,priceSnapshots,company});
  useEffect(()=>()=>request.current?.abort(),[signature,blocked]);
  const technicalReady=!!calculation && sameConfiguration(configuration,calculation.input_configuration);
  const named=!!projectName?.trim() && projectName.trim().length<=120;
  const quoted=quotationAvailable(estimate,configuration);
  function reloadCompany(){setError("");try{setCompany(loadCompanyProfile());}catch(reason){setCompany(null);setError(reason instanceof Error ? reason.message:"Datele firmei nu pot fi citite.");}}
  async function download(kind:PdfKind){
    if(lock.current || blocked || !company || !named || (kind==="quotation" ? !quoted:!technicalReady))return;
    lock.current=true;setBusy(kind);setError("");setNotice("");
    const controller=new AbortController();request.current=controller;
    const timeout=window.setTimeout(()=>controller.abort(),30000);
    try{
      const data=preparePdfData({kind,company,configuration,calculation,estimate,projectName,projectId:savedProject?.id || null});
      const [{generatePdf},{loadPdfFonts}]=await Promise.all([import("./generate-pdf"),import("./pdf-fonts")]);
      const fonts=await loadPdfFonts(controller.signal);
      if(controller.signal.aborted)return;
      const bytes=generatePdf(data,fonts);
      if(controller.signal.aborted)return;
      const url=URL.createObjectURL(new Blob([bytes],{type:"application/pdf"})),anchor=document.createElement("a");
      anchor.href=url;anchor.download=pdfFilename(data);document.body.appendChild(anchor);anchor.click();anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),60000);
      setNotice("PDF-ul a fost pregătit pentru descărcare. Pe telefon, verifică și lista de descărcări a browserului.");
    }catch(reason){setError(controller.signal.aborted ? "Exportul a fost întrerupt sau datele s-au schimbat. Încearcă din nou.":reason instanceof Error ? reason.message:"PDF-ul nu a putut fi generat. Încearcă din nou.");}
    finally{window.clearTimeout(timeout);lock.current=false;setBusy(null);request.current=null;}
  }
  return <section className={styles.panel} aria-label="Export documente PDF">
    <div className={styles.heading}><div><h3>Pregătit de trimis sau de executat.</h3><p>Două documente, fiecare cu informațiile potrivite.</p></div><button type="button" className={styles.primary} aria-expanded={open} aria-controls="pdf-export-options" disabled={!!busy} onClick={()=>{if(!open)reloadCompany();setOpen(v=>!v);}}><Download size={18} aria-hidden="true"/>Exportă PDF</button></div>
    {open && <div id="pdf-export-options">
      <div className={styles.toolbar}><Link href={companyProfileRoute} target="_blank" rel="noopener noreferrer">Datele firmei ↗</Link><button type="button" className={styles.link} disabled={!!busy} onClick={reloadCompany}>Reîncarcă datele firmei</button></div>
      <p className={styles.hint}>Setările se deschid într-o filă nouă pentru a păstra proiectul curent. După salvare, reîncarcă datele firmei aici.</p>
      {!company && <p role="status" className={styles.warning}>Configurează și salvează numele firmei înainte de export.</p>}
      {!named && <p role="status" className={styles.warning}>Completează numele în secțiunea de salvare a proiectului. Nu este obligatoriu să salvezi proiectul pentru export.</p>}
      {!quoted && <p role="status" className={styles.warning}>{estimate?.missing_item_codes.length ? `Deviz incomplet. Lipsesc prețurile: ${estimate.missing_item_codes.map(code=>priceItems.find(([id])=>id===code)?.[1] || code).join(", ")}.`:"Generează un deviz complet și actualizat pentru exportul către client."} Fișa tehnică nu necesită prețuri.</p>}
      <div className={styles.options}>
        <div className={styles.option}><FileText size={22} aria-hidden="true"/><h4>Deviz pentru client</h4><p>Configurație și preț final fără TVA. Fără costuri de achiziție, furnizori sau adaos.</p><button type="button" className={styles.primary} disabled={!!busy || blocked || !company || !named || !quoted} onClick={()=>void download("quotation")}>{busy==="quotation" ? "Generăm devizul…":"Descarcă devizul"}</button></div>
        <div className={styles.option}><FileText size={22} aria-hidden="true"/><h4>Fișă tehnică pentru atelier</h4><p>Desen cotat, debitare, canturi ABS, feronerie și ipoteze. Fără informații financiare.</p><button type="button" className={styles.secondary} disabled={!!busy || blocked || !company || !named || !technicalReady} onClick={()=>void download("workshop")}>{busy==="workshop" ? "Generăm fișa…":"Descarcă fișa tehnică"}</button></div>
      </div>
      {!technicalReady && <p role="status">Așteaptă calculul tehnic pentru configurația confirmată.</p>}
    </div>}
    {busy && <p role="status" aria-live="polite">Pregătim documentul local. Te rugăm să aștepți.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
