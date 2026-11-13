"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, FileCheck2, ShieldCheck, Undo2 } from "lucide-react";
import { applyRestorePlan, buildRestorePlan, captureLocalData, exportFormaBackup, inspectLocalData, localStorageSource, parseFormaBackup, rawRecoveryText,
  type FormaBackup, type LocalSnapshot, type RestoreMode, type RestorePlan, type RestoreSelection } from "./forma-backup";
import { fullBackupMaxBytes } from "./size-policy";
import { restoreJournalKey, rollbackRestore, withLocalRestoreLocks } from "./restore-transaction";
import styles from "./backup.module.css";

const labels = {projects: "Proiecte", catalogs: "Furnizori și prețuri · Mobilier", company_profile: "Datele firmei și logo", manufacturing_profiles: "Profiluri de prelucrare · Mobilier"};
const none: RestoreSelection = {projects: false, catalogs: false, company_profile: false, manufacturing_profiles: false};

export function downloadLocalFile(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], {type: "application/json;charset=utf-8"}));
  try {
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
  } finally {setTimeout(() => URL.revokeObjectURL(url), 1000);}
}

export function BackupPage() {
  const [data, setData] = useState<LocalSnapshot | null>(null);
  const [backup, setBackup] = useState<FormaBackup | null>(null);
  const [selection, setSelection] = useState<RestoreSelection>(none);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [plan, setPlan] = useState<RestorePlan | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rollbackConfirmed, setRollbackConfirmed] = useState(false);
  const request = useRef({selection: 0});
  function reload() {try {setData(captureLocalData());} catch (reason) {setError(message(reason));}}
  useEffect(() => {
    let active = true;
    const sequence = request.current;
    Promise.resolve().then(() => {if (active) reload();});
    return () => {active = false; sequence.selection++;};
  }, []);
  function invalidate() {setPlan(null); setConfirmed(false); setNotice("");}
  async function run(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try {await action();} catch (reason) {setError(message(reason));}
    finally {setBusy(false); reload();}
  }
  async function select(file: File | undefined) {
    if (!file) return;
    const current = ++request.current.selection;
    invalidate(); setBackup(null); setError(""); setBusy(true);
    try {
      if (file.size > fullBackupMaxBytes) throw new Error("Alege un backup de maximum 32 MB (UTF-8).");
      const parsed = parseFormaBackup(await file.text());
      if (current !== request.current.selection) return;
      setBackup(parsed);
      setSelection({projects: "projects" in parsed.sections, catalogs: "catalogs" in parsed.sections, company_profile: "company_profile" in parsed.sections, manufacturing_profiles: "manufacturing_profiles" in parsed.sections});
    } catch (reason) {if (current === request.current.selection) setError(message(reason));}
    finally {if (current === request.current.selection) setBusy(false);}
  }
  const records = data ? inspectLocalData(data) : [];
  const corrupted = records.filter(record => record.error);
  const pending = data && restoreJournalKey in data;
  const incomingCatalog = backup?.sections.catalogs?.[0]?.catalog;
  return <main id="main-content" className={styles.page}>
    <Link href="/domenii/mobilier/profil" className={styles.back}>← Profil și setări</Link>
    <header><p className={styles.eyebrow}>DATELE TALE, ÎN SIGURANȚĂ</p><h1>Backup și restaurare</h1>
      <p>O copie locală pentru proiectele și datele atelierului.</p></header>
    <p className={styles.notice}>Totul se generează și se verifică în browser. Backupurile nu sunt criptate și pot conține prețuri de achiziție și date de contact. Păstrează-le într-un loc sigur.</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    <section className={styles.card} aria-labelledby="full-backup"><ShieldCheck aria-hidden="true" size={23}/><h2 id="full-backup">Backup complet</h2>
      <p>Proiectele salvate local, configurațiile, copiile istorice de prețuri și prelucrare, furnizorii, ofertele, profilurile de prelucrare și profilul firmei cu logo.</p>
      <p>Fotografiile schițelor, drafturile nesalvate, PDF-urile și conturile nu sunt incluse. Proiectele dintr-un serviciu online nu sunt exportate.</p>
      <button className={styles.primary} disabled={busy || data === null || Boolean(pending) || corrupted.length > 0} onClick={() => void run(async () => {
        const text = await exportFormaBackup(); downloadLocalFile(text, `FORMA_Backup_${new Date().toISOString().slice(0, 10)}.json`);
        setNotice("Backup verificat pentru reimport. Fișierul a fost pregătit pentru descărcare; verifică salvarea lui pe dispozitiv.");
      })}><Download size={18} aria-hidden="true"/> Exportă backup FORMA</button>
      {corrupted.length > 0 && <p>Backupul complet este blocat până la recuperarea datelor deteriorate. Poți descărca separat înregistrările brute mai jos.</p>}
    </section>
    <section className={styles.card} aria-labelledby="restore-backup"><h2 id="restore-backup">Restaurare din fișier</h2>
      <p>JSON FORMA, maximum 32 MB. Acceptăm și backupurile existente ale catalogului (maximum 16 MB). Verificarea nu modifică datele.</p>
      <label className={styles.field}>Alege backupul<input type="file" accept="application/json,.json" disabled={busy || Boolean(pending)} onChange={event => {
        void select(event.target.files?.[0]); event.target.value = "";
      }}/></label>
      {backup && <>
        <p>Creat: {new Date(backup.created_at).toLocaleString("ro-RO")} · Format: FORMA v{backup.schema_version}</p>
        <p>{backup.sections.projects?.length ?? 0} proiecte · {incomingCatalog?.suppliers.length ?? 0} furnizori · {incomingCatalog?.items.length ?? 0} oferte · {backup.sections.manufacturing_profiles?.profiles.length ?? 0} profiluri de prelucrare · Profil firmă: {backup.sections.company_profile ? "prezent" : "absent"}</p>
        <fieldset disabled={busy}><legend>Secțiuni selectate pentru restaurare</legend>
          {(Object.keys(labels) as (keyof RestoreSelection)[]).map(section => <label className={styles.check} key={section}>
            <input type="checkbox" checked={selection[section]} disabled={!(section in backup.sections)} onChange={event => {setSelection({...selection, [section]: event.target.checked}); invalidate();}}/>{labels[section]}
          </label>)}
        </fieldset>
        <label className={styles.field}>Mod de restaurare<select value={mode} disabled={busy} onChange={event => {setMode(event.target.value as RestoreMode); invalidate();}}>
          <option value="merge">Combină · păstrează conflictele existente</option><option value="replace">Înlocuiește secțiunile selectate</option>
        </select></label>
        <button className={styles.secondary} disabled={busy || Boolean(pending)} onClick={() => {
          setError(""); invalidate();
          try {const current = captureLocalData(); setData(current); setPlan(buildRestorePlan(backup, current, selection, mode));}
          catch (reason) {setError(message(reason));}
        }}><FileCheck2 size={18} aria-hidden="true"/> Verifică backupul</button>
      </>}
      {plan && <div className={styles.preview}>
        <h3>Previzualizarea restaurării</h3>
        {selection.manufacturing_profiles && <p>Profiluri de prelucrare existente afectate: {plan.affected.manufacturing_profiles ?? "număr necunoscut"}. Copiile din proiecte nu sunt actualizate automat.</p>}
        <p>Înregistrări invalide în fișier: 0. {plan.changes.length} chei locale vor fi modificate. {plan.conflicts.length} conflicte vor fi ignorate.</p>
        {mode === "replace" && <p>Secțiuni locale afectate: {selection.projects ? `${plan.affected.projects} proiecte; ` : ""}{selection.catalogs ? `${plan.affected.catalogs ?? "număr necunoscut de"} furnizori/oferte; ` : ""}{selection.company_profile ? `${plan.affected.company_profile} profil firmă` : ""}. Datele care lipsesc din secțiunea importată vor fi eliminate din secțiunea înlocuită.</p>}
        {plan.conflicts.length > 0 && <details><summary>Înregistrări păstrate și ignorate la import</summary><ul>{plan.conflicts.map((conflict, index) => <li key={index}>{conflict}</li>)}</ul></details>}
        {plan.warnings.map((warning, index) => <p key={index}>{warning}</p>)}
        {plan.requiresConfirmation && <label className={styles.check}><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>Confirm înlocuirea secțiunilor selectate, inclusiv datele deteriorate. Am păstrat o copie a datelor necesare.</label>}
        <div className={styles.actions}>
          <button className={styles.primary} disabled={busy || (plan.requiresConfirmation && !confirmed)} onClick={() => void run(async () => {
            const result = await applyRestorePlan(plan, confirmed);
            setNotice(`Restaurare încheiată: ${result.written} chei modificate; ${result.skipped.length} conflicte păstrate. Redeschide proiectele și filele de catalog pentru a încărca datele restaurate.`);
            setPlan(null); setBackup(null); setConfirmed(false);
          })}>Restaurează</button>
          <button className={styles.secondary} disabled={busy} onClick={() => {invalidate(); setBackup(null);}}>Anulează</button>
        </div>
      </div>}
    </section>
    <section className={styles.card} aria-labelledby="local-data"><h2 id="local-data">Date salvate local</h2>
      <p>{data === null ? "Datele locale nu au fost încă citite; starea lor nu este confirmată." : `${records.filter(record => record.section === "projects" && !record.error).length} proiecte citibile · ${corrupted.length} înregistrări care necesită atenție.`}</p>
      <p>Datele aparțin acestui browser și acestei adrese. Ștergerea datelor site-ului sau pierderea dispozitivului le poate elimina. Backupul este manual, fără sincronizare.</p>
      <button className={styles.secondary} disabled={busy} onClick={() => {setError(""); invalidate(); reload();}}>Reverifică datele locale</button>
    </section>
    <section className={styles.card} aria-labelledby="recovery"><h2 id="recovery">Recuperare date deteriorate</h2>
      {data === null ? <p>Citirea datelor locale trebuie să reușească înainte de verificarea integrității.</p> : corrupted.length === 0 ? <p>Nu am detectat înregistrări deteriorate în datele locale citite.</p> : <>
        <p>Datele locale nu pot fi citite integral. Descarcă fiecare înregistrare afectată înainte de înlocuire. Fișierele brute sunt pentru diagnostic, nu pentru import automat.</p>
        {corrupted.map(record => <article className={styles.record} key={record.key}><h3>{record.section ? labels[record.section] : "Jurnal de recuperare"}</h3><code>{record.key}</code><p>{record.error}</p>
          <button className={styles.secondary} disabled={busy} onClick={() => {
            try {downloadLocalFile(rawRecoveryText(record.key), `FORMA_Recuperare_${record.section || "jurnal"}.json`);} catch (reason) {setError(message(reason));}
          }}>Descarcă datele pentru recuperare</button>
        </article>)}
        <a className={styles.back} href="#restore-backup">Restaurează din backup ↑</a>
      </>}
      {pending && <div className={styles.preview}><p>O restaurare a fost întreruptă sau rulează în altă filă. Închide celelalte file FORMA înainte de recuperare. Scrierile normale sunt blocate până la recuperarea jurnalului.</p>
        <label className={styles.check}><input type="checkbox" disabled={busy} checked={rollbackConfirmed} onChange={event => setRollbackConfirmed(event.target.checked)}/>Confirm revenirea la datele anterioare din jurnal.</label>
        <button className={styles.secondary} disabled={busy || !rollbackConfirmed} onClick={() => void run(async () => {
          await withLocalRestoreLocks(() => rollbackRestore(localStorageSource())); invalidate(); setNotice("Datele anterioare au fost recuperate. Verifică-le înainte de o nouă restaurare."); setRollbackConfirmed(false);
        })}><Undo2 size={18} aria-hidden="true"/> Revino la datele anterioare</button>
      </div>}
    </section>
    {busy && <p role="status" aria-live="polite">Verificăm datele locale… Nu închide această filă.</p>}
  </main>;
}
function message(reason: unknown) {return reason instanceof Error ? reason.message : "Operația nu a reușit. Datele nu au fost confirmate ca salvate.";}
