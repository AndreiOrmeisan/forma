"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { emptyCompanyProfile, loadCompanyProfile, readCompanyLogo, saveCompanyProfile, type CompanyProfile } from "./company-profile";
import styles from "../catalog/catalog.module.css";

const fields: [keyof Omit<CompanyProfile,"logo"|"validity_days">,string,number][]=[
  ["display_name","Nume firmă sau atelier",160],["contact_person","Persoană de contact · opțional",120],
  ["phone","Telefon · opțional",60],["email","E-mail · opțional",254],["address","Adresă · opțional",500],
  ["website","Website · opțional",1000],["registration_info","Nr. de înregistrare · opțional",200],
  ["tax_info","CUI / identificare fiscală · opțional",120],
];
export function CompanySettings(){
  const [profile,setProfile]=useState(emptyCompanyProfile),[validity,setValidity]=useState(""),[ready,setReady]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;Promise.resolve().then(()=>{if(!mounted.current)return;try{const saved=loadCompanyProfile();if(saved){setProfile(saved);setValidity(saved.validity_days===null ? "":String(saved.validity_days));}setReady(true);}catch(reason){setError(reason instanceof Error ? reason.message:"Profil indisponibil.");}});return()=>{mounted.current=false;};},[]);
  async function logo(file:File|undefined){if(!file)return;setBusy(true);setError("");setNotice("");try{const value=await readCompanyLogo(file);if(mounted.current)setProfile(p=>({...p,logo:value}));}catch(reason){if(mounted.current)setError(reason instanceof Error ? reason.message:"Logo invalid.");}finally{if(mounted.current)setBusy(false);}}
  function save(){setError("");setNotice("");try{if(validity && !/^\d+$/.test(validity))throw new Error("Valabilitatea trebuie să fie un număr întreg de zile.");const saved=saveCompanyProfile({...profile,validity_days:validity ? Number(validity):null});setProfile(saved);setNotice("Datele firmei au fost salvate în acest browser.");}catch(reason){setError(reason instanceof Error ? reason.message:"Salvarea nu a reușit.");}}
  return <main id="main-content" className={styles.page} style={{maxWidth:850,paddingLeft:24,paddingRight:24}}>
    <Link className={styles.link} href="/">← Domenii</Link><div className={styles.heading}><div><h1>Datele firmei</h1><p>Un profil reutilizabil pentru documentele tale FORMA.</p></div></div>
    <p className={styles.notice}>Salvare doar în acest browser, fără sincronizare. Datele și logo-ul nu sunt trimise către servicii de generare PDF. Verifică informațiile înainte de a trimite documentele unui client.</p>
    <form className={styles.form} noValidate onSubmit={e=>{e.preventDefault();if(ready && !busy)save();}}><fieldset disabled={!ready || busy} style={{border:0,padding:0,margin:0}}><div className={styles.fields}>
      {fields.map(([key,label,max])=><label key={key} className={styles.field}>{label}<input value={profile[key]} maxLength={max} required={key==="display_name"} type={key==="email" ? "email":key==="website" ? "url":key==="phone" ? "tel":"text"} onChange={e=>{setProfile(p=>({...p,[key]:e.target.value}));setNotice("");}}/></label>)}
      <label className={styles.field}>Valabilitate implicită · zile, opțional<input inputMode="numeric" maxLength={3} value={validity} placeholder="Necompletată" onChange={e=>{setValidity(e.target.value);setNotice("");}}/></label>
    </div><label className={styles.field} style={{marginTop:20}}>Note implicite pentru client · opțional<textarea rows={5} maxLength={2000} value={profile.quotation_notes} onChange={e=>{setProfile(p=>({...p,quotation_notes:e.target.value}));setNotice("");}}/></label>
    <label className={styles.field} style={{marginTop:20}}>Logo · PNG sau JPEG, max. 128 KB și 2048 × 2048 px<input type="file" accept="image/png,image/jpeg" onChange={e=>{void logo(e.target.files?.[0]);e.target.value="";}}/></label>
    {profile.logo && <div className={styles.toolbar} style={{marginTop:16}}>{/* User-supplied bounded data URL; no optimizer or network request. */}
      <Image unoptimized src={profile.logo.data_url} width={100} height={70} style={{objectFit:"contain"}} alt="Logo-ul firmei"/><button type="button" className={styles.secondary} onClick={()=>{setProfile(p=>({...p,logo:null}));setNotice("");}}>Elimină logo-ul din formular</button></div>}
    <p>Notele apar în devizul pentru client. Nu include costuri de achiziție, marjă sau alte informații interne. Nu aplicăm automat TVA pe baza datelor fiscale.</p>
    <button className={styles.primary} style={{marginTop:20}} disabled={!ready || busy}>{busy ? "Verificăm logo-ul…":"Salvează datele firmei"}</button></fieldset>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status">{notice}</p>}</form>
  </main>;
}
