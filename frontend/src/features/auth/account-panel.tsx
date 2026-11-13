"use client";

import { useState } from "react";
import { useAuth } from "./auth-context";
import styles from "../furniture/projects.module.css";

export function AccountPanel() {
  const {user,loading,configured,error:sessionError,signIn,signOut} = useAuth();
  const [error,setError] = useState<string | null>(null);
  const [notice,setNotice] = useState<string | null>(null);
  const [busy,setBusy] = useState(false);
  async function connect() {
    setError(null);setBusy(true);
    try {await signIn();setNotice("Finalizează conectarea în fereastra deschisă, apoi revino aici. Proiectul curent rămâne în această filă.");}
    catch(reason){setError(reason instanceof Error ? reason.message : "Autentificarea nu a reușit.");}
    finally{setBusy(false);}
  }
  async function disconnect() {
    setError(null);setBusy(true);
    try {await signOut();setNotice("Te-ai deconectat.");}
    catch(reason){setError(reason instanceof Error ? reason.message : "Deconectarea nu a reușit.");}
    finally{setBusy(false);}
  }
  return <section className={styles.card} aria-label="Cont FORMA">
    <h2>{user ? "Contul tău" : "Salvează proiectele în contul tău"}</h2>
    {!configured ? <p>Autentificarea online nu este încă activată pentru această instalare. Câmpurile pot fi completate, dar salvarea online necesită configurarea serviciului gratuit.</p> : loading ? <p role="status">Verificăm sesiunea…</p> : user ? <>
      <p>Conectat: {user.email || "Cont Google"}. Proiectele tale sunt private și disponibile pe dispozitivele pe care folosești același cont.</p>
      <button type="button" className={styles.secondary} disabled={busy} onClick={()=>void disconnect()}>Deconectare</button>
    </> : <>
      <p>Conectează-te pentru a salva și redeschide proiectele pe telefon sau calculator. Contul FORMA este creat la prima conectare.</p>
      <button type="button" className={styles.primary} disabled={busy} onClick={()=>void connect()}>{busy ? "Conectăm…" : "Continuă cu Google"}</button>
    </>}
    {(error || sessionError) && <p role="alert" className={styles.error}>{error || sessionError}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
