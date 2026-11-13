"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { localCatalogRepository } from "../catalog/catalog-repository";
import type { Supplier } from "../catalog/catalog-model";
import { RecoveryLink } from "../storage/recovery-link";
import { blankManufacturingProfile, edgeLabels, incompleteProfile, type ManufacturingProfile, type EdgeType, type ProcessingRule } from "./manufacturing-model";
import { loadManufacturingProfiles, saveManufacturingProfile, supplierAssociation, type ManufacturingStore } from "./manufacturing-repository";
import styles from "./manufacturing.module.css";

const statusLabels = {draft: "Ciornă · setări nevalidate", validated: "Setări validate · execuție neverificată", archived: "Arhivat"};
export function ManufacturingSettings() {
  const [store, setStore] = useState<ManufacturingStore | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [profile, setProfile] = useState<ManufacturingProfile | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    try {setStore(loadManufacturingProfiles());} catch (reason) {setError(message(reason));}
    try {setSuppliers((await localCatalogRepository.load()).suppliers);} catch {setError("Catalogul nu poate fi citit. Referințele la furnizori rămân păstrate; poți configura un atelier independent.");}
  }
  useEffect(() => {let active = true; Promise.resolve().then(() => {if (active) void reload();}); return () => {active = false;};}, []);
  function edit(change: Partial<ManufacturingProfile>) {setProfile(previous => previous ? {...previous, ...change, status: "draft"} : previous); setNotice("");}
  async function save(value: ManufacturingProfile, action: "save" | "validate" | "archive") {
    if (!store || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await saveManufacturingProfile(value, store.revision, action); setStore(result); setProfile(null);
      setNotice(action === "validate" ? "Setările au fost validate explicit. Aceasta nu confirmă testarea unei asamblări fizice." : action === "archive" ? "Profil arhivat. Copiile din proiectele salvate rămân neschimbate." : "Profil salvat ca ciornă. Proiectele existente nu au fost modificate.");
    } catch (reason) {setError(message(reason));} finally {setBusy(false);}
  }
  const missing = profile ? incompleteProfile(profile) : [];
  const numericField = (key: "cutting_precision_mm" | "dimensional_tolerance_mm" | "back_projection_mm" | "front_projection_mm", label: string) => <label className={styles.field}>{label}<input inputMode="decimal" value={profile?.[key] ?? ""} onChange={event => edit({[key]: decimalInput(event.target.value)})}/><small>Gol = neconfigurat. Zero trebuie introdus explicit; precizia trebuie să fie pozitivă.</small></label>;
  function updateRule(edge: EdgeType, rule: ProcessingRule | null) {
    if (!profile) return;
    const rules = {...profile.edge_processing_rules};
    if (rule) rules[edge] = rule; else delete rules[edge];
    edit({edge_processing_rules: rules});
  }
  return <main id="main-content" className={styles.page}>
    <Link href="/domenii/mobilier/profil" className={styles.link}>← Profil și setări mobilier</Link>
    <header><p className={styles.eyebrow}>MOBILIER / PROCES DE ATELIER</p><h1>Profiluri de prelucrare</h1><p>Reguli dimensionale explicite, separate de prețurile furnizorilor.</p></header>
    <p className={styles.notice}>Nu completăm valori tehnice în locul atelierului. Validarea setărilor nu reprezintă aprobare de producție. Prețurile și proiectele istorice nu se actualizează automat.</p>
    <p><RecoveryLink/></p>
    {error && <p role="alert" className={styles.error}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}
    <div className={styles.actions}><button className={styles.primary} disabled={!store || busy} onClick={() => {setProfile(blankManufacturingProfile()); setError("");}}>Profil nou</button>
      <button className={styles.secondary} disabled={busy} onClick={() => void reload()}>Reîncarcă lista</button></div>
    {profile && <section className={styles.card} aria-labelledby="profile-editor">
      <h2 id="profile-editor">Setări de prelucrare</h2>
      <form noValidate onSubmit={event => {event.preventDefault(); void save(profile, "save");}}>
        <fieldset disabled={busy} className={styles.unbordered}>
          <div className={styles.grid}><label className={styles.field}>Numele profilului<input value={profile.name} maxLength={120} required onChange={event => edit({name: event.target.value})}/></label>
            <label className={styles.field}>Furnizor asociat · opțional<select value={profile.supplier_id ?? ""} onChange={event => edit({supplier_id: event.target.value || null})}>
              <option value="">Atelier independent</option>
              {profile.supplier_id && !suppliers.some(s => s.id === profile.supplier_id) && <option value={profile.supplier_id}>Furnizor indisponibil · referință păstrată</option>}
              {suppliers.map(s => <option key={s.id} value={s.id} disabled={s.status === "archived" && s.id !== profile.supplier_id}>{s.name}{s.status === "archived" ? " · arhivat" : ""}</option>)}
            </select></label></div>
          {supplierAssociation(profile, suppliers).warning && <p role="status">{supplierAssociation(profile, suppliers).warning}</p>}
          <h3>Tipuri de cant și compensare</h3><p>Canturile fără bandă au contribuție zero. Pentru ABS, alege o singură reprezentare: contribuție netă sau grosime aplicată minus material îndepărtat. Prefrezarea nu se scade încă o dată.</p>
          {(Object.keys(edgeLabels) as EdgeType[]).map(edge => {
            const supported = profile.supported_edge_types.includes(edge), rule = profile.edge_processing_rules[edge];
            return <fieldset className={styles.rule} key={edge}><legend>{edgeLabels[edge]}</legend>
              <label className={styles.check}><input type="checkbox" checked={supported} onChange={event => {
                const rules = {...profile.edge_processing_rules}; if (!event.target.checked) delete rules[edge];
                edit({supported_edge_types: event.target.checked ? [...profile.supported_edge_types, edge] : profile.supported_edge_types.filter(type => type !== edge), edge_processing_rules: rules});
              }}/>Tip suportat de acest proces</label>
              {supported && <><label className={styles.field}>Mod de compensare<select value={rule?.mode ?? ""} onChange={event => updateRule(edge, event.target.value === "net" ? {mode: "net", net_contribution_mm: null} : event.target.value === "layers" ? {mode: "layers", applied_thickness_mm: null, removal_mm: null} : null)}>
                <option value="">Neconfigurat</option><option value="net">Contribuție netă efectivă</option><option value="layers">Grosime aplicată minus prefrezare</option>
              </select></label>
                {rule?.mode === "net" && <label className={styles.field}>Contribuție netă efectivă · mm<input inputMode="decimal" value={rule.net_contribution_mm ?? ""} onChange={event => updateRule(edge, {...rule, net_contribution_mm: decimalInput(event.target.value)})}/></label>}
                {rule?.mode === "layers" && <div className={styles.grid}>
                  <label className={styles.field}>Grosime efectiv aplicată · mm<input inputMode="decimal" value={rule.applied_thickness_mm ?? ""} onChange={event => updateRule(edge, {...rule, applied_thickness_mm: decimalInput(event.target.value)})}/></label>
                  <label className={styles.field}>Material îndepărtat / prefrezare · mm<input inputMode="decimal" value={rule.removal_mm ?? ""} onChange={event => updateRule(edge, {...rule, removal_mm: decimalInput(event.target.value)})}/></label>
                </div>}</>}
            </fieldset>;
          })}
          <div className={styles.grid}>{numericField("cutting_precision_mm", "Pas de debitare · mm")}
            <label className={styles.field}>Politica de rotunjire<select value={profile.rounding_policy ?? ""} onChange={event => edit({rounding_policy: event.target.value as ManufacturingProfile["rounding_policy"] || null})}>
              <option value="">Neconfigurată</option><option value="exact">Doar multipli exacți · fără rotunjire</option><option value="half_up">Cel mai apropiat · jumătățile în sus</option><option value="ceil">Întotdeauna în sus</option><option value="floor">Întotdeauna în jos</option>
            </select></label>{numericField("dimensional_tolerance_mm", "Abatere maximă admisă de la brut · mm")}</div>
          <h3>Adâncime: carcasă și exterior</h3><p>Adâncimea introdusă în proiect rămâne adâncimea carcasei. Proiecțiile se adaugă o singură dată pentru adâncimea exterioară; nu presupunem că sunt egale cu grosimea materialelor.</p>
          <div className={styles.grid}>{numericField("back_projection_mm", "Proiecție spate · mm")}{numericField("front_projection_mm", "Proiecție front · mm")}</div>
          <label className={styles.field}>Note de atelier<textarea rows={4} maxLength={2000} value={profile.notes} onChange={event => edit({notes: event.target.value})}/></label>
          <div className={styles.notice}><h3>De completat înainte de validarea setărilor</h3>{missing.length ? <ul>{missing.map(item => <li key={item}>{item}</li>)}</ul> : <p>Câmpurile sunt completate. Verifică valorile tehnice; aprobarea nu este automată.</p>}</div>
          <div className={styles.actions}><button className={styles.primary} type="submit">Salvează ciorna</button>
            <button className={styles.secondary} type="button" disabled={missing.length > 0} onClick={() => void save(profile, "validate")}>Validează explicit setările</button>
            <button className={styles.secondary} type="button" onClick={() => setProfile(null)}>Anulează</button></div>
        </fieldset>
      </form>
    </section>}
    <section aria-label="Profiluri salvate" className={styles.list}>
      {store?.profiles.length === 0 && <div className={styles.card}><h2>Niciun profil configurat.</h2><p>Estimarea simplă funcționează în continuare fără profil de prelucrare.</p></div>}
      {store?.profiles.map(p => <article key={p.id} className={styles.card}>
        <p className={styles.eyebrow}>{statusLabels[p.status]}</p><h2>{p.name}</h2>
        <p>Schema v{p.schema_version} · revizia {p.revision} · {supplierAssociation(p, suppliers).name || (p.supplier_id ? "Furnizor indisponibil" : "Atelier independent")}</p>
        {supplierAssociation(p, suppliers).warning && <p role="status">{supplierAssociation(p, suppliers).warning}</p>}
        <p>{incompleteProfile(p).length} setări neconfigurate. {p.notes}</p>
        <div className={styles.actions}><button className={styles.secondary} disabled={busy} onClick={() => {setProfile(structuredClone(p)); setError("");}}>Editează</button>
          {p.status !== "archived" && <button className={styles.secondary} disabled={busy} onClick={() => void save(p, "archive")}>Arhivează profilul</button>}</div>
      </article>)}
    </section>
  </main>;
}
function decimalInput(value: string) {return value === "" ? null : value.replace(",", ".");}
function message(reason: unknown) {return reason instanceof Error ? reason.message : "Operația nu a reușit. Datele anterioare au fost păstrate.";}
