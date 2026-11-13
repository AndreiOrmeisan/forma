"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";
import { isProject, projectCapabilities, projectHref, projectRequest, type FurnitureProject, type ProjectPage } from "./project-api";
import styles from "./projects.module.css";
import { useAuth } from "../auth/auth-context";
import { AccountPanel } from "../auth/account-panel";

const PAGE_SIZE = 12;
export function ProjectList() {
  const {user} = useAuth();
  return <ProjectListContent key={user?.id || "guest"} />;
}

function ProjectListContent() {
  const {user,loading:authLoading} = useAuth();
  const userId = user?.id;
  const [requiresLogin,setRequiresLogin] = useState(false);
  const [page, setPage] = useState<ProjectPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FurnitureProject | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    async function load() {
      const capability = await projectCapabilities();
      if (!active) return;
      if (!capability.enabled) {setUnavailable(capability.reason); setLoading(false); return;}
      if (capability.requires_auth && (!userId || authLoading)) {setRequiresLogin(true);setLoading(false);return;}
      setRequiresLogin(false);
      setUnavailable(null);
      try {
        const value = await projectRequest(`projects?limit=${PAGE_SIZE}&offset=${offset}`) as ProjectPage;
        if (!Array.isArray(value?.items) || !value.items.every(isProject) || !Number.isSafeInteger(value.total) || value.total < 0) throw new Error("Lista proiectelor primită de la server este invalidă.");
        if (active) {
          if (offset > 0 && value.total <= offset) setOffset(Math.max(0, offset - PAGE_SIZE));
          else setPage(value);
        }
      } catch (reason) {if (active) setError(reason instanceof Error ? reason.message : "Lista proiectelor nu poate fi încărcată.");}
      finally {if (active) setLoading(false);}
    }
    void load();
    return () => {active = false;};
  }, [offset, attempt, userId, authLoading]);

  function reload() {setLoading(true); setError(null); setAttempt(value => value + 1);}
  async function duplicate(project: FurnitureProject) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const copy = await projectRequest(`projects/${project.id}/duplicate`, {method:"POST"});
      if (!isProject(copy)) throw new Error("Duplicarea nu a fost confirmată de server.");
      setNotice(`Am creat „${copy.name}”.`); setOffset(0); reload();
    } catch (reason) {setError(reason instanceof Error ? reason.message : "Proiectul nu a putut fi duplicat.");}
    finally {setBusy(false);}
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await projectRequest(`projects/${deleting.id}?expected_revision=${deleting.revision}`, {method:"DELETE"});
      setDeleting(null); setNotice("Proiectul a fost șters."); reload();
    } catch (reason) {setDeleting(null); setError(reason instanceof Error ? reason.message : "Proiectul nu a putut fi șters.");}
    finally {setBusy(false);}
  }

  return <main id="main-content" className={styles.page}>
    <Link className={styles.textLink} href={furnitureRoutes.home}><ArrowLeft size={18} aria-hidden="true" /> Înapoi acasă</Link>
    <header className={styles.heading}><div><h1>Proiectele mele</h1><p>Configurațiile și devizele tale salvate.</p></div><Link className={styles.primary} href={furnitureRoutes.newProject}><Plus size={18} aria-hidden="true" /> Proiect nou</Link></header>
    <aside className={styles.notice}>În modul online, proiectele sunt private și disponibile pe dispozitivele unde folosești același cont. Schițele fotografiate nu sunt salvate permanent.</aside>
    {requiresLogin && <AccountPanel />}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {loading && <p role="status">Încărcăm proiectele…</p>}
    {unavailable && <section className={styles.card}><h2>Salvarea nu este încă disponibilă</h2><p>{unavailable}</p><button type="button" className={styles.secondary} onClick={reload}>Verifică din nou</button></section>}
    {error && <div role="alert" className={styles.card}><p className={styles.error}>{error}</p><button type="button" className={styles.secondary} onClick={reload}>Încearcă din nou</button></div>}
    {!loading && !unavailable && !error && page && <>
      <ProjectCards projects={page.items} busy={busy} onDuplicate={project => void duplicate(project)} onDelete={setDeleting} />
      {page.total > PAGE_SIZE && <nav className={styles.pagination} aria-label="Paginare proiecte">
        <button className={styles.secondary} disabled={offset === 0 || busy} onClick={() => {setLoading(true); setOffset(value => Math.max(0, value - PAGE_SIZE));}}>Înapoi</button>
        <span>{offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)} din {page.total}</span>
        <button className={styles.secondary} disabled={offset + PAGE_SIZE >= page.total || busy} onClick={() => {setLoading(true); setOffset(value => value + PAGE_SIZE);}}>Înainte</button>
      </nav>}
    </>}
    {deleting && <DeleteProjectDialog project={deleting} busy={busy} onCancel={() => setDeleting(null)} onConfirm={() => void remove()} />}
  </main>;
}

export function ProjectCards({projects, busy, onDuplicate, onDelete}: {projects: FurnitureProject[]; busy: boolean; onDuplicate: (project: FurnitureProject) => void; onDelete: (project: FurnitureProject) => void}) {
  if (projects.length === 0) return <section className={`${styles.card} ${styles.empty}`}><h2>Nu ai încă proiecte salvate.</h2><p>Primul tău proiect începe cu o schiță. Îl poți salva după confirmarea configurației.</p></section>;
  return <div className={styles.grid}>{projects.map(project => <article className={styles.card} key={project.id}>
    <div className={styles.cardTop}><h2>{project.name}</h2><span className={styles.badge}>{project.status === "completed" ? "Finalizat" : "În lucru"}</span></div>
    <p>{project.confirmed_configuration.width_mm} × {project.confirmed_configuration.height_mm} × {project.confirmed_configuration.depth_mm} mm</p>
    <p>Actualizat <time dateTime={project.updated_at}>{new Intl.DateTimeFormat("ro-RO", {dateStyle:"medium", timeStyle:"short"}).format(new Date(project.updated_at))}</time></p>
    <p>{!project.compatible ? "Versiune incompatibilă · recalculare blocată" : project.deviz_complete ? "Prețuri complete pentru deviz" : "Deviz incomplet · lipsesc prețuri"}</p>
    <div className={styles.actions}>
      <Link className={styles.primary} href={projectHref(project.id)}>Deschide<span className="sr-only"> {project.name}</span></Link>
      <button type="button" className={styles.secondary} disabled={busy || !project.compatible} onClick={() => onDuplicate(project)} aria-label={`Duplică ${project.name}`}>Duplică</button>
      <button type="button" className={styles.danger} disabled={busy} onClick={() => onDelete(project)} aria-label={`Șterge ${project.name}`}>Șterge</button>
    </div>
  </article>)}</div>;
}

export function DeleteProjectDialog({project, busy, onCancel, onConfirm}: {project: FurnitureProject; busy:boolean; onCancel:()=>void; onConfirm:()=>void}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {const element = dialog.current; element?.showModal(); cancel.current?.focus(); return () => element?.close();}, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => {event.preventDefault(); if (!busy) onCancel();}}>
    <h2 id="delete-title">Ștergi proiectul?</h2><p id="delete-description">„{project.name}” va fi șters definitiv. Celelalte proiecte rămân păstrate.</p>
    <div className={styles.actions}><button ref={cancel} type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>Renunță</button><button type="button" className={styles.danger} disabled={busy} onClick={onConfirm}>{busy ? "Ștergem…" : "Șterge definitiv"}</button></div>
  </dialog>;
}
