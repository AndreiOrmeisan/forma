"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWardrobeProject } from "../furniture/wardrobe-project-context";
import { localCatalogRepository } from "../catalog/catalog-repository";
import type { Supplier } from "../catalog/catalog-model";
import { incompleteProfile, manufacturingRoute, type ManufacturingProfile, type ManufacturingSnapshot } from "./manufacturing-model";
import { loadManufacturingProfiles, snapshotManufacturingProfile, supplierAssociation } from "./manufacturing-repository";
import { calculateManufacturing, manufacturingSignature, readinessLabels, type ManufacturingResult } from "./manufacturing-api";
import type { WardrobeConfiguration } from "../furniture/wardrobe-configuration";
import styles from "./manufacturing.module.css";
import { profileComparison } from "./manufacturing-display";

export function ManufacturingSelector() {
  const {manufacturingSnapshot = null, selectManufacturing, saving} = useWardrobeProject();
  const [profiles, setProfiles] = useState<ManufacturingProfile[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [candidate, setCandidate] = useState<ManufacturingSnapshot | null | undefined>(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  async function reload() {
    setError("");
    try {
      setProfiles(loadManufacturingProfiles().profiles);
      setSuppliers((await localCatalogRepository.load()).suppliers); setReady(true);
    } catch (reason) {setError(reason instanceof Error ? reason.message : "Profilurile nu pot fi citite.");}
  }
  useEffect(() => {let active = true; Promise.resolve().then(() => {if (active) void reload();}); return () => {active = false;};}, []);
  const current = manufacturingSnapshot?.profile;
  const live = current ? profiles.find(p => p.id === current.id) : undefined;
  const warnings = current ? supplierAssociation(current, suppliers).warning : null;
  return <section className={styles.card} aria-labelledby="manufacturing-selector">
    <p className={styles.eyebrow}>OPȚIONAL / PRELUCRARE</p><h2 id="manufacturing-selector">Cum pregătește atelierul piesele?</h2>
    <p>Prețurile rămân independente. Fără profil, păstrăm estimarea legacy provizorie și nu inventăm dimensiuni brute.</p>
    <div className={styles.actions}><Link href={manufacturingRoute} target="_blank" rel="noopener noreferrer" className={styles.link}>Gestionează profilurile ↗</Link>
      <button type="button" className={styles.secondary} disabled={saving} onClick={() => void reload()}>Reîncarcă profilurile</button></div>
    <label className={styles.field}>Propune un profil de prelucrare<select disabled={!ready || saving} value={candidate === undefined ? current?.id ?? "" : candidate?.profile.id ?? ""} onChange={event => {
      const value = profiles.find(p => p.id === event.target.value); setConfirmed(false); setError("");
      try {setCandidate(value ? snapshotManufacturingProfile(value, suppliers) : null);} catch (reason) {setError(reason instanceof Error ? reason.message : "Profil invalid.");}
    }}><option value="">Fără profil · estimare simplă</option>
      {current && !profiles.some(p => p.id === current.id && p.status !== "archived") && <option value={current.id}>Copie păstrată: {current.name}</option>}
      {profiles.filter(p => p.status !== "archived").map(p => <option key={p.id} value={p.id}>{p.name} · rev. {p.revision}{p.status === "draft" ? " · ciornă" : " · setări validate"}</option>)}
    </select></label>
    {current && <><p>Copie aplicată: <strong>{current.name}</strong> · schema v{current.schema_version} · revizia {current.revision} · {manufacturingSnapshot.supplier_name_at_selection || "Atelier independent / referință indisponibilă"}.</p>
      <p>Stare la selectare: {manufacturingSnapshot.approval_status === "validated" ? "setări validate, fără dovadă de execuție" : manufacturingSnapshot.approval_status === "draft" ? "ciornă" : "arhivat"}.</p>
      {ready && (!live || JSON.stringify(live) !== JSON.stringify(current)) && <p role="status">Profilul curent din catalog diferă sau nu mai este disponibil. Copia proiectului rămâne neschimbată.</p>}
      {live && live.status !== "archived" && <button type="button" disabled={saving} className={styles.secondary} onClick={() => {setCandidate(snapshotManufacturingProfile(live, suppliers)); setConfirmed(false);}}>Compară cu profilul actual</button>}
      {warnings && ready && <p role="status">{warnings}</p>}</>}
    {candidate !== undefined && <div className={styles.notice}>
      <h3>Compară înainte de aplicare</h3>
      <p>Actual: {current?.name || "Fără profil"} → Propus: {candidate?.profile.name || "Fără profil · revenire la estimare legacy"}. Prețurile și revizia proiectului nu sunt modificate aici. Salvează explicit proiectul după confirmare.</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Compararea setărilor de prelucrare"><table className={styles.table}>
        <thead><tr><th>Setare</th><th>Aplicată acum</th><th>Propusă</th></tr></thead><tbody>{profileComparison(current, candidate?.profile).map(row => <tr key={row[0]}>{row.map((value, index) => <td key={index}>{value}</td>)}</tr>)}</tbody>
      </table></div>
      {candidate && <ul>{incompleteProfile(candidate.profile).map(issue => <li key={issue}>{issue}</li>)}</ul>}
      <label className={styles.check}><input type="checkbox" disabled={saving} checked={confirmed} onChange={event => setConfirmed(event.target.checked)}/>Confirm aplicarea acestei copii a regulilor. Nu reprezintă aprobare fizică de atelier.</label>
      <div className={styles.actions}><button type="button" className={styles.primary} disabled={!confirmed || saving} onClick={() => {selectManufacturing(candidate); setCandidate(undefined); setConfirmed(false);}}>Aplică profilul</button>
        <button type="button" className={styles.secondary} disabled={saving} onClick={() => setCandidate(undefined)}>Anulează</button></div>
    </div>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}

export function ManufacturingProjectPanel({configuration, financialComplete}: {configuration: WardrobeConfiguration; financialComplete: boolean}) {
  const {manufacturingSnapshot = null, manufacturingResult = null, acceptManufacturing} = useWardrobeProject();
  const signature = manufacturingSignature(configuration, manufacturingSnapshot);
  const [status, setStatus] = useState<{signature: string; error: string; busy: boolean} | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!manufacturingSnapshot) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    Promise.resolve().then(() => {if (!controller.signal.aborted) setStatus({signature, error: "", busy: true});});
    calculateManufacturing(configuration, manufacturingSnapshot, controller.signal).then(result => {
      if (!controller.signal.aborted) {acceptManufacturing(signature, result); setStatus({signature, error: "", busy: false});}
    }).catch(reason => {if (!controller.signal.aborted) setStatus({signature, error: reason instanceof Error ? reason.message : "Calcul indisponibil.", busy: false});
      else if (!disposed) setStatus({signature, error: "Calculul de prelucrare a expirat. Verifică backend-ul și reîncearcă; datele sunt păstrate.", busy: false});
    }).finally(() => clearTimeout(timeout));
    let disposed = false;
    return () => {disposed = true; clearTimeout(timeout); controller.abort();};
  }, [configuration, manufacturingSnapshot, signature, acceptManufacturing, attempt]);
  const result = manufacturingResult?.signature === signature ? manufacturingResult.result : null;
  return <>
    <ManufacturingSelector/>
    <section className={styles.card} aria-labelledby="manufacturing-status"><h2 id="manufacturing-status">Estimare și pregătire de atelier</h2>
      <p><strong>Financiar:</strong> {financialComplete ? "complet" : "incomplet"}. <strong>Fabricație:</strong> {result ? readinessLabels[result.readiness] : manufacturingSnapshot ? "în verificare / neconfirmată" : readinessLabels.legacy_provisional}.</p>
      <p>Un deviz complet nu aprobă fabricația. Suprafețele PAL și lungimile ABS păstrează baza nominală legacy pentru prețuri; nu înlocuim consumul financiar cu dimensiunile brute.</p>
      {!manufacturingSnapshot && <p>Adâncime carcasă: {configuration.depth_mm} mm. Adâncime totală neconfigurată. Dimensiunile legacy nu sunt cote brute aprobate de debitare.</p>}
      {status?.signature === signature && status.busy && <p role="status">Calculăm separat dimensiunile finite și brute…</p>}
      {status?.signature === signature && status.error && <div role="alert" className={styles.error}><p>{status.error}</p><button type="button" className={styles.secondary} onClick={() => setAttempt(value => value + 1)}>Reîncearcă calculul de prelucrare</button></div>}
      {result && <ManufacturingDimensions result={result}/>}
    </section>
  </>;
}

export function ManufacturingDimensions({result}: {result: ManufacturingResult}) {
  return <>
    <p>Adâncime carcasă: {result.carcass_depth_mm} mm · Spate: {result.back_projection_mm ?? "neconfigurat"} mm · Front: {result.front_projection_mm ?? "neconfigurat"} mm.</p>
    <p><strong>{result.overall_depth_mm === null ? "Adâncime totală neconfigurată" : `Adâncime totală calculată: ${result.overall_depth_mm} mm · de verificat fizic`}</strong></p>
    <div className={styles.notice}><strong>Dimensiuni brute neconfirmate — verificare în atelier necesară.</strong><ul>{[...result.issues, ...result.warnings].map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>
    <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Dimensiuni finite și brute"><table className={styles.table}>
      <caption>Dimensiuni de panou L × l. Sus/jos afectează L; stânga/dreapta afectează l. Orientarea fibrei nu este dedusă.</caption>
      <thead><tr><th>Piesă / buc.</th><th>Finit · mm</th><th>Brut exact · mm</th><th>Cotă la pasul configurat · mm</th></tr></thead>
      <tbody>{result.panels.map(p => <tr key={p.panel_id}><td>{p.name} · {p.quantity}</td><td>{p.finished_length_mm} × {p.finished_width_mm}</td><td>{p.raw_length_mm ?? "?"} × {p.raw_width_mm ?? "?"}</td><td>{p.cutting_length_mm ?? "neconfigurat"} × {p.cutting_width_mm ?? "neconfigurat"}</td></tr>)}</tbody>
    </table></div>
  </>;
}
