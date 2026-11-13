"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWardrobeProject } from "./wardrobe-project-context";
import { hasUnsavedProject } from "./unsaved-project";
import { invalidPricing } from "./project-api";
import { protectProjectNavigation, type PendingNavigation } from "./navigation-protection";
import styles from "./project-navigation.module.css";

export function ProjectNavigationGuard({ children }: { children: ReactNode }) {
  const project = useWardrobeProject();
  const router = useRouter();
  const dirty = hasUnsavedProject(project);
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef({ dirty, project, router });
  const saveAttempt = useRef(false);
  const continuing = useRef(false);

  useLayoutEffect(() => { latest.current = { dirty, project, router }; });
  useEffect(() => protectProjectNavigation(window, {
    dirty: () => latest.current.dirty,
    saving: () => latest.current.project.saving,
    leave: () => {
      latest.current.project.resetDraft();
      setPending(null);
      setSaved(false);
    },
    request: navigation => {
      continuing.current = false;
      setSaved(false);
      setError("");
      setPending(navigation);
    },
    navigate: href => {
      const target = new URL(href);
      if (target.origin === window.location.origin) {
        const base = process.env.NEXT_PUBLIC_ASSET_BASE_PATH || "";
        const path = base && target.pathname.startsWith(base + "/") ? target.pathname.slice(base.length) : target.pathname;
        latest.current.router.push(path + target.search + target.hash);
      } else window.location.assign(href);
    },
  }), []);

  useEffect(() => {
    if (!pending) return;
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, [pending]);

  useEffect(() => {
    if (pending && saved && !dirty && !continuing.current) {
      continuing.current = true;
      pending.resume();
    }
  }, [pending, saved, dirty]);

  async function saveAndContinue() {
    if (saveAttempt.current) return;
    saveAttempt.current = true;
    setError("");
    setSaved(false);
    try {
      await project.saveDraft();
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Proiectul nu a putut fi salvat. Datele sunt păstrate.");
    } finally {
      saveAttempt.current = false;
    }
  }

  const canSave = Boolean(project.confirmed) && !invalidPricing(project.pricing) &&
    Boolean(project.projectName.trim()) && project.projectName.trim().length <= 120;
  return <>
    {children}
    {pending && <dialog ref={dialog} className={styles.dialog} aria-labelledby="unsaved-project-title"
      aria-describedby="unsaved-project-description" onCancel={event => {
        event.preventDefault();
        if (!project.saving) setPending(null);
      }}>
      <h2 id="unsaved-project-title">Ai un proiect nesalvat</h2>
      <p id="unsaved-project-description">Salvează proiectul înainte de a pleca sau alege să renunți la modificările curente.</p>
      <p className={styles.hint}>Fotografia rămâne temporară. După reîncărcarea paginii va trebui selectată din nou.</p>
      {project.confirmed && <label className={styles.field}>Numele proiectului
        <input maxLength={120} value={project.projectName} disabled={project.saving}
          onChange={event => project.updateProjectName(event.target.value)} />
      </label>}
      {!project.confirmed && <p role="status">Confirmă configurația pentru a putea salva proiectul. Poți rămâne aici și continua editarea.</p>}
      {invalidPricing(project.pricing) && <p role="status">Corectează prețurile înainte de salvare.</p>}
      {saved && dirty && <p role="status">Versiunea trimisă a fost salvată. Au apărut alte modificări. Salvează-le înainte de a continua.</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.actions}>
        <button autoFocus type="button" disabled={project.saving} className={styles.secondary} onClick={() => setPending(null)}>Rămâi</button>
        <button type="button" disabled={project.saving || !canSave} className={styles.primary} onClick={() => void saveAndContinue()}>
          {project.saving ? "Salvăm…" : "Salvează proiectul"}
        </button>
        <button type="button" disabled={project.saving} className={styles.discard} onClick={() => {
          if (continuing.current) return;
          continuing.current = true;
          pending.resume();
        }}>Continuă fără salvare</button>
      </div>
    </dialog>}
  </>;
}
