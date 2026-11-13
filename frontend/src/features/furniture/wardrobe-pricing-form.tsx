"use client";

import { useEffect, useRef, useState } from "react";
import type { WardrobeConfiguration } from "./wardrobe-configuration";
import { useWardrobeProject } from "./wardrobe-project-context";
import { formatMoney, priceItems, pricingError, type Estimate } from "./wardrobe-pricing";
import { formatExactDecimal } from "./calculate-wardrobe";
import styles from "./wardrobe-pricing.module.css";
import { invalidPricing } from "./project-api";
import { estimateWardrobe } from "./estimate-wardrobe";
import { ProjectCatalogPricing } from "../catalog/project-catalog-pricing";

export function WardrobePricingForm({ configuration, initialEstimate }: { configuration: WardrobeConfiguration; initialEstimate?: Estimate }) {
  const { pricing, updatePricing,priceSnapshots=[],appliedEstimate } = useWardrobeProject();
  const signature = JSON.stringify({ configuration, pricing });
  const [initialSignature] = useState(signature);
  const [generatedResult, setResult] = useState<{ signature: string; estimate: Estimate } | null>(null);
  const result = appliedEstimate?.signature===signature ? appliedEstimate : generatedResult || (initialEstimate && initialSignature === signature ? {signature,estimate:initialEstimate} : null);
  const [busy, setBusy] = useState(false);
  const [catalogBusy,setCatalogBusy]=useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const stale = result !== null && result.signature !== signature;
  const invalid = invalidPricing(pricing);

  async function generate() {
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true); setError(null);
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const data = await estimateWardrobe(configuration,pricing,priceSnapshots,controller.signal);
      setResult({ signature, estimate: data });
    } catch (reason) {
      setError(controller.signal.aborted ? "Calculul a fost întrerupt sau a durat prea mult. Încearcă din nou." : reason instanceof Error ? reason.message : "Serviciul nu răspunde.");
    } finally { window.clearTimeout(timeout); setBusy(false); }
  }

  function field(key: string, label: string, unit: string, percentage = false, optional = false) {
    const value = pricing[key];
    const message = optional && !value.trim() ? null : pricingError(value, percentage);
    return <div className={styles.field} key={key}>
      <label htmlFor={`price-${key}`}>{label}<span>{unit}</span></label>
      <input id={`price-${key}`} type="text" inputMode="decimal" autoComplete="off" value={value} disabled={catalogBusy}
        placeholder={optional ? "Necompletat" : "0"} aria-invalid={!!message} aria-describedby={message ? `error-${key}` : undefined}
        onChange={event => updatePricing(key, event.target.value)} />
      {message && <p id={`error-${key}`} className={styles.error}>{message}</p>}
    </div>;
  }

  return <section className={styles.section} aria-labelledby="pricing-title">
    <header><p className={styles.eyebrow}>PREȚURI MANUALE · RON</p><h2 id="pricing-title">De la materiale la deviz.</h2>
      <p>Introdu prețurile tale. Câmpul gol înseamnă preț lipsă; zero este un preț explicit. Nu folosim prețuri de piață demonstrative.</p></header>
    <ProjectCatalogPricing configuration={configuration} onBusyChange={setCatalogBusy} />
    <form noValidate onSubmit={event => { event.preventDefault(); if (!invalid && !busy && !catalogBusy) void generate(); }}>
      <fieldset><legend>Prețuri materiale</legend><div className={styles.grid}>{priceItems.slice(0, 4).map(([code, label, unit]) => field(code, label, `RON/${unit}`, false, true))}</div></fieldset>
      <details className={styles.details}><summary>Prețuri feronerie · 5 articole</summary><div className={styles.grid}>{priceItems.slice(4).map(([code, label, unit]) => field(code, label, `RON/${unit}`, false, true))}</div></details>
      <details className={styles.details}><summary>Pierderi materiale · implicit 0%</summary><p>Se aplică numai costurilor. Nu modifică debitarea și nu reprezintă optimizarea plăcilor.</p><div className={styles.grid}>{field("pal", "Pierderi PAL", "%", true)}{field("hdf", "Pierderi HDF", "%", true)}{field("abs", "Pierderi ABS", "%", true)}</div></details>
      <fieldset><legend>Manoperă și adaos</legend><div className={styles.grid}>{field("labor", "Manoperă fixă", "RON")}{field("markup", "Adaos comercial", "%", true)}</div><p>Adaosul se aplică peste producție (materiale + feronerie + manoperă). Nu reprezintă marja de profit.</p></fieldset>
      <button className={styles.primary} type="submit" disabled={invalid || busy || catalogBusy}>{busy ? "Calculăm devizul…" : "Aplică prețurile și generează devizul"}</button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {stale && <p role="status">Datele au fost modificate. Aplică din nou prețurile pentru un deviz actualizat.</p>}
    {result && !stale && <EstimateDetails estimate={result.estimate} />}
    {!result && <p>Devizul nu este încă generat. Prețurile rămân disponibile pe durata acestui proiect, până la reîncărcarea paginii.</p>}
  </section>;
}

export function EstimateDetails({ estimate }: { estimate: Estimate }) {
  const money = (value: string | null) => value === null ? "Necompletat" : formatMoney(value);
  return <section className={styles.estimate} aria-labelledby="estimate-title" aria-live="polite">
    <h3 id="estimate-title">Deviz estimativ · fără TVA</h3>
    {!estimate.is_complete && <div role="status"><strong>Deviz incomplet</strong><p>Completează prețurile pentru articolele utilizate. Prețul final nu este disponibil.</p></div>}
    <ul>{estimate.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
    <div className={styles.lines}>{[...estimate.material_lines, ...estimate.hardware_lines].map(line => <article key={line.item_code}>
      <h4>{line.name}</h4><p>Net: {formatExactDecimal(line.base_quantity)} {line.unit} · De facturat: {formatExactDecimal(line.billable_quantity)} {line.unit}</p>
      <p>Preț unitar: {money(line.unit_price_ron)} / {line.unit}</p><strong>{money(line.line_total_ron)}</strong>
    </article>)}</div>
    <dl className={styles.summary}>{[
      ["Materiale", estimate.material_subtotal_ron], ["Feronerie", estimate.hardware_subtotal_ron],
      ["Manoperă", estimate.labor_cost_ron], ["Cost de producție", estimate.production_cost_ron],
      [`Adaos comercial · ${formatExactDecimal(estimate.markup_percent)}%`, estimate.markup_amount_ron],
      ["Preț estimat de vânzare · fără TVA", estimate.is_complete ? estimate.selling_price_before_tax_ron : null],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>
  </section>;
}
