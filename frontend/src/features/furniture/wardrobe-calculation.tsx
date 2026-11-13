"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { calculateWardrobe, formatExactDecimal, type WardrobeCalculationResult } from "./calculate-wardrobe";
import type { WardrobeConfiguration } from "./wardrobe-configuration";
import styles from "./wardrobe-result.module.css";
import { EdgeBandingSection, HardwareSection } from "./wardrobe-estimate-sections";

export function WardrobeCalculation({ configuration, onCalculated }: { configuration: WardrobeConfiguration; onCalculated?:(result:WardrobeCalculationResult)=>void }) {
  const [result, setResult] = useState<WardrobeCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setError("Calculul durează mai mult decât era așteptat. Încearcă din nou.");
    }, 20000);
    calculateWardrobe(configuration, controller.signal)
      .then(data => { if (!controller.signal.aborted) {setResult(data);onCalculated?.(data);} })
      .catch(reason => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Calculul nu poate fi finalizat.");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [configuration, attempt,onCalculated]);

  if (!result) {
    return (
      <div className={styles.requestState}>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button type="button" className={styles.retryButton} onClick={() => { setError(null); setAttempt(value => value + 1); }}>Încearcă din nou</button>
          </>
        ) : <p role="status"><LoaderCircle size={20} aria-hidden="true" /> Calculăm lista de debitare…</p>}
      </div>
    );
  }

  return <WardrobeCalculationDetails result={result} />;
}

export function WardrobeCalculationDetails({ result }: { result: WardrobeCalculationResult }) {
  return (
    <div className={styles.result}>
      <section className={styles.totals} aria-label="Cantități de materiale">
        <div><h2>PAL net</h2><p>{formatExactDecimal(result.totals.total_pal_area_m2)} <span>m²</span></p></div>
        <div><h2>HDF separat</h2><p>{formatExactDecimal(result.totals.total_hdf_area_m2)} <span>m²</span></p></div>
        <div><h2>Număr de piese</h2><p>{result.totals.total_panel_count}</p></div>
      </section>
      <section className={styles.card} aria-labelledby="cutting-list-title">
        <div className={styles.sectionHeader}>
          <h2 id="cutting-list-title">Lista de debitare</h2>
          <span>{result.construction_profile.name}</span>
        </div>
        <p className={styles.tableHint}>Pe ecrane mici, derulează tabelul pe orizontală.</p>
        <div className={styles.tableScroller} role="region" aria-label="Tabel cu piesele de debitat" tabIndex={0}>
          <table className={styles.cuttingTable}>
            <caption className="sr-only">Dimensiuni în milimetri. Suprafața fiecărui rând include cantitatea de piese.</caption>
            <thead><tr><th scope="col">Piesă / material</th><th scope="col">Lungime × lățime · mm</th><th scope="col">Buc.</th><th scope="col">Suprafață totală · m²</th></tr></thead>
            <tbody>
              {result.panels.map(panel => (
                <tr key={panel.id}>
                  <th scope="row">{panel.name}<span>{panel.material} · {formatExactDecimal(panel.thickness_mm)} mm</span></th>
                  <td>{formatExactDecimal(panel.length_mm)} × {formatExactDecimal(panel.width_mm)}</td>
                  <td>{panel.quantity}</td>
                  <td>{formatExactDecimal(panel.area_m2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <EdgeBandingSection result={result.edge_banding} />
      <HardwareSection result={result.hardware} />
      <details className={`${styles.card} ${styles.profileDetails}`}>
        <summary>Profil de construcție · {result.construction_profile.name}</summary>
        <ul className={styles.assumptions}>
          {result.construction_profile.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}
        </ul>
      </details>
      {result.warnings.length > 0 && (
        <aside className={styles.notes} aria-label="Observații privind calculul">
          {result.warnings.map(warning => <p key={warning}>{warning}</p>)}
        </aside>
      )}
    </div>
  );
}
