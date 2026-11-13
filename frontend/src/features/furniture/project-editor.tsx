"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";
import { getProject, projectCapabilities, projectRequest, restorePricing, type FurnitureProject } from "./project-api";
import { isEstimate, type Estimate } from "./wardrobe-pricing";
import { useWardrobeProject } from "./wardrobe-project-context";
import { WardrobeForm } from "./wardrobe-form";
import { WardrobeConfiguratorPreview } from "./wardrobe-configurator-preview";
import { WardrobeCalculation } from "./wardrobe-calculation";
import { WardrobePricingForm } from "./wardrobe-pricing-form";
import { ProjectSaveForm } from "./project-save-form";
import styles from "./projects.module.css";
import { useAuth } from "../auth/auth-context";
import { AccountPanel } from "../auth/account-panel";

export function ProjectEditor() {
  const id = useSearchParams().get("id") || "";
  const {user} = useAuth();
  return <ProjectEditorContent key={`${id}:${user?.id || "guest"}`} id={id} />;
}

function ProjectEditorContent({id}: {id: string}) {
  const {user,loading:authLoading} = useAuth();
  const userId = user?.id;
  const [requiresLogin,setRequiresLogin] = useState(false);
  const { restoreProject, savedProject, confirmed, pricing } = useWardrobeProject();
  const [loaded, setLoaded] = useState<{project: FurnitureProject; estimate: Estimate | null; estimateError?:string} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    async function open() {
      try {
        const capability = await projectCapabilities();
        if (!capability.enabled) throw new Error(capability.reason || "Salvarea online nu este încă disponibilă.");
        if (capability.requires_auth && !userId) {if(active) setRequiresLogin(true);throw new Error("Autentifică-te pentru a deschide proiectul.");}
        const project = await getProject(id);
        if (!active) return;
        restoreProject(project);
        setLoaded({project,estimate:null});
        if (project.compatible) {
          try {
            const value = await projectRequest("estimate", {method:"POST", body:JSON.stringify({
              configuration:project.confirmed_configuration, confirmed:true, price_catalog:project.manual_price_catalog,
              waste_allowances:project.waste_allowances, labor_cost_ron:project.labor_cost, markup_percent:project.markup_percentage,
            })});
            if (!isEstimate(value)) throw new Error("Devizul proiectului nu poate fi recalculat în această versiune.");
            if(active) setLoaded({project,estimate:value});
          } catch {
            if(active) setLoaded({project,estimate:null,estimateError:"Proiectul a fost încărcat. Devizul nu a putut fi recalculat momentan; verifică conexiunea și aplică din nou prețurile. Datele salvate sunt păstrate."});
          }
        }
      } catch (reason) {if (active) setError(reason instanceof Error ? reason.message : "Proiectul nu poate fi deschis.");}
    }
    void open();
    return () => {active = false;};
  }, [restoreProject, attempt, id, userId, authLoading]);

  return <main id="main-content" className={styles.page}>
    <Link className={styles.textLink} href={furnitureRoutes.projects}><ArrowLeft size={18} aria-hidden="true" /> Proiectele mele</Link>
    {error && <section className={styles.card} role="alert"><h1>Proiectul nu poate fi deschis.</h1><p className={styles.error}>{error}</p><button className={styles.secondary} onClick={() => {setError(null); setAttempt(value => value + 1);}}>Încearcă din nou</button></section>}
    {requiresLogin && <AccountPanel />}
    {!loaded && !error && <p role="status">Deschidem proiectul și recalculăm devizul…</p>}
    {loaded && !loaded.project.compatible && <section className={styles.card}><h1>{loaded.project.name}</h1>{loaded.project.warnings.map(warning => <p role="alert" key={warning}>{warning}</p>)}<p>Profil: {loaded.project.construction_profile_id} · Calcul: {loaded.project.calculation_version}. Datele salvate nu au fost modificate.</p></section>}
    {loaded?.project.compatible && savedProject && <>
      <header className={styles.heading}><div><span className={styles.eyebrow}>MOBILIER / DULAP</span><h1>{savedProject.name}</h1><p>Editează configurația, confirm-o și salvează modificările în același proiect.</p></div></header>
      <aside className={styles.notice}>Imaginea originală nu a fost salvată. Previzualizarea 2D și devizul sunt reconstruite din datele proiectului, cu profilul {savedProject.construction_profile_id}.</aside>
      {loaded.estimateError && <p role="status" className={styles.notice}>{loaded.estimateError}</p>}
      <div className={styles.editorGrid}><WardrobeConfiguratorPreview /><WardrobeForm onConfirmed={() => {}} /></div>
      <div className={styles.editorResults}>
        {!confirmed && <p role="status" className={styles.notice}>Ai modificat configurația. Confirmă valorile pentru a recalcula materialele și devizul.</p>}
        {confirmed && <>
          <WardrobeCalculation key={`calculation-${JSON.stringify(confirmed)}`} configuration={confirmed} />
          <WardrobePricingForm key={`pricing-${JSON.stringify(confirmed)}`} configuration={confirmed} initialEstimate={JSON.stringify(confirmed) === JSON.stringify(loaded.project.confirmed_configuration) && JSON.stringify(pricing) === JSON.stringify(restorePricing(loaded.project)) ? loaded.estimate || undefined : undefined} />
        </>}
        <ProjectSaveForm />
      </div>
    </>}
  </main>;
}
