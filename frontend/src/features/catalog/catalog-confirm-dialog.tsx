"use client";
import { useEffect, useRef } from "react";
import styles from "./catalog.module.css";
export function CatalogConfirmDialog({name,busy,error,onCancel,onConfirm}:{name:string;busy:boolean;error?:string;onCancel:()=>void;onConfirm:()=>void}){
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="catalog-delete-title" onCancel={event=>{event.preventDefault();if(!busy)onCancel();}}>
    <h2 id="catalog-delete-title">Ștergi înregistrarea?</h2><p>„{name}” va fi eliminată din catalog. Copiile prețurilor din proiectele salvate rămân păstrate. Furnizorii cu oferte asociate nu pot fi șterși.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.toolbar}><button autoFocus className={styles.secondary} disabled={busy} onClick={onCancel}>Renunță</button><button className={styles.danger} disabled={busy} onClick={onConfirm}>{busy ? "Ștergem…":"Confirmă ștergerea"}</button></div>
  </dialog>;
}
