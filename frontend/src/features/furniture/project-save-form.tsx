"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWardrobeProject } from "./wardrobe-project-context";
import { invalidPricing, pricingFingerprint, projectCapabilities, projectHref, projectPayload, restorePricing, saveProject, type ProjectCapabilities } from "./project-api";
import { validateWardrobeDraft } from "./wardrobe-configuration";
import styles from "./projects.module.css";
import { useAuth } from "../auth/auth-context";
import { AccountPanel } from "../auth/account-panel";
import { browserStorageNotice, getProjectStorageMode } from "../../config/project-storage";
import { migrateManualSnapshots, snapshotFingerprint } from "./project-price-snapshot";

export function ProjectSaveForm({ available }: {available?: boolean}) {
  const { confirmed, draft, pricing, savedProject, markSaved,priceSnapshots } = useWardrobeProject();
  const {user,loading:authLoading} = useAuth();
  const [capability, setCapability] = useState<ProjectCapabilities | null>(() => available ? {enabled:true, reason:null,storage:getProjectStorageMode() === "browser" ? "browser" : undefined} : null);
  const [name, setName] = useState(savedProject?.name || "");
  const [description, setDescription] = useState(savedProject?.description || "");
  const [status, setStatus] = useState<"draft" | "completed">(savedProject?.status || "draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const signature = JSON.stringify({confirmed, pricing, name, description, status,priceSnapshots});
  const dirty = savedProject ? name.trim() !== savedProject.name || description.trim() !== (savedProject.description || "") || status !== savedProject.status ||
    JSON.stringify(draft ? validateWardrobeDraft(draft).configuration : null) !== JSON.stringify(savedProject.confirmed_configuration) ||
    pricingFingerprint(pricing) !== pricingFingerprint(restorePricing(savedProject)) || snapshotFingerprint(priceSnapshots || []) !== snapshotFingerprint(migrateManualSnapshots(savedProject.manual_price_catalog,savedProject.price_snapshots)) : !!name.trim();
  const nameError = name.trim().length === 0 ? "Dă un nume proiectului." : name.trim().length > 120 ? "Folosește cel mult 120 de caractere." : null;
  const needsLogin = capability?.requires_auth === true && (!user || authLoading);
  useEffect(() => {
    if (available) return;
    let active = true;
    projectCapabilities().then(value => {if (active) setCapability(value);});
    return () => {active = false;};
  }, [available, checkAttempt, user?.id]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault();};
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (!confirmed || nameError || invalidPricing(pricing) || !capability?.enabled || needsLogin) return;
    setBusy(true); setError(null);
    try {
      const payload = projectPayload(confirmed, pricing, {name, description, status}, savedProject,priceSnapshots);
      const result = await saveProject(payload, savedProject);
      markSaved(result);
      setSavedSignature(signature);
    } catch (reason) {setError(reason instanceof Error ? reason.message : "Proiectul nu a putut fi salvat.");}
    finally {setBusy(false);}
  }

  return <section className={styles.card} aria-labelledby="save-project-title">
    <div className={styles.sectionHeading}><span className={styles.eyebrow}>{capability?.storage === "browser" ? "SALVARE ÎN BROWSER" : capability?.storage === "local" ? "PROIECT LOCAL" : "PROIECTUL TĂU"}</span><h2 id="save-project-title">{savedProject ? "Salvează modificările" : "Salvează proiectul"}</h2></div>
    <p>Salvăm configurația și prețurile. Imaginea originală nu este salvată permanent.</p>
    {getProjectStorageMode() === "browser" && <p className={styles.notice}>{browserStorageNotice}</p>}
    {!capability && <p role="status">Verificăm disponibilitatea salvării…</p>}
    {capability && !capability.enabled && <div role="status"><p>{capability.reason}</p><button type="button" className={styles.secondary} onClick={() => setCheckAttempt(value => value + 1)}>Verifică din nou</button></div>}
    {needsLogin && <AccountPanel />}
    <form noValidate onSubmit={event => {event.preventDefault(); if (!busy) void save();}}>
      <fieldset disabled={busy} className={styles.fields}>
        <label htmlFor="project-name">Numele proiectului<input id="project-name" value={name} maxLength={120} onChange={event => setName(event.target.value)} aria-invalid={!!nameError} aria-describedby={nameError ? "project-name-error" : undefined} required /></label>
        {nameError && <p id="project-name-error" className={styles.error}>{nameError}</p>}
        <label htmlFor="project-description">Descriere <span>· opțional</span><textarea id="project-description" rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
        <label htmlFor="project-status">Stare<select id="project-status" value={status} onChange={event => setStatus(event.target.value as "draft" | "completed")}><option value="draft">În lucru</option><option value="completed">Finalizat</option></select></label>
        <button type="submit" className={styles.primary} disabled={!confirmed || !!nameError || invalidPricing(pricing) || !capability?.enabled || needsLogin || busy}>{busy ? "Salvăm…" : savedProject ? "Salvează modificările" : "Salvează proiectul"}</button>
      </fieldset>
    </form>
    {!confirmed && <p>Confirmă configurația modificată înainte de salvare.</p>}
    {savedProject && dirty && <p role="status">Ai modificări nesalvate. Salvează înainte de a părăsi editorul.</p>}
    {invalidPricing(pricing) && <p className={styles.error}>Corectează prețurile și procentele înainte de salvare. Prețurile necompletate sunt permise într-un deviz incomplet.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {savedSignature && savedProject && <div role="status"><p>{savedSignature === signature ? "Proiectul a fost salvat." : "Versiunea anterioară a fost salvată. Ai modificări nesalvate."}</p><Link className={styles.textLink} href={projectHref(savedProject.id)}>Deschide proiectul salvat</Link></div>}
  </section>;
}
