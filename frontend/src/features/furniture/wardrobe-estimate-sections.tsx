import { formatExactDecimal } from "./calculate-wardrobe";
import type { BandingType, EdgeBandingResult, HardwareResult } from "./wardrobe-estimates";
import styles from "./wardrobe-result.module.css";

const bandingLabels: Record<BandingType, string> = {
  none: "Fără cant",
  abs_0_4: "ABS 0,4 mm",
  abs_2: "ABS 2 mm",
};

export function EdgeBandingSection({ result }: { result: EdgeBandingResult }) {
  return (
    <section className={styles.card} aria-labelledby="edge-banding-title">
      <h2 id="edge-banding-title">Canturi ABS</h2>
      <p className={styles.estimateNotice}>Reguli de cantare provizorii · FORMA v1</p>
      <dl className={styles.edgeTotals}>
        <div><dt>ABS 2 mm</dt><dd>{formatExactDecimal(result.totals_by_type.abs_2_total_m)} <span>m</span></dd></div>
        <div><dt>ABS 0,4 mm</dt><dd>{formatExactDecimal(result.totals_by_type.abs_0_4_total_m)} <span>m</span></dd></div>
        <div><dt>Total net de cant</dt><dd>{formatExactDecimal(result.total_net_length_m)} <span>m</span></dd></div>
      </dl>
      <p className={styles.estimateNotice}>Adaos de aprovizionare separat · {formatExactDecimal(result.procurement_allowance_m)} m</p>
      <details className={styles.expandable}>
        <summary>Detalii de cant pe panou</summary>
        <ul className={styles.edgePanels}>
          {result.panel_edges.map(panel => (
            <li key={panel.panel_id}>
              <h3>{panel.name} · {panel.quantity} buc.</h3>
              <p>{formatExactDecimal(panel.net_length_per_piece_m)} m/piesă · {formatExactDecimal(panel.total_net_length_m)} m total net</p>
              <dl className={styles.edgeRows}>
                {panel.edges.map(edge => (
                  <div key={edge.edge}>
                    <dt>{edge.name}</dt>
                    <dd>{bandingLabels[edge.banding_type]} · {formatExactDecimal(edge.length_mm)} mm</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </details>
      <details className={styles.expandable}>
        <summary>Convenția muchiilor și ipoteze</summary>
        <p className={styles.convention}>{result.edge_convention}</p>
        <ul className={styles.assumptions}>{result.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>
      </details>
    </section>
  );
}

export function HardwareSection({ result }: { result: HardwareResult }) {
  return (
    <section className={styles.card} aria-labelledby="hardware-title">
      <h2 id="hardware-title">Feronerie</h2>
      <p className={styles.estimateNotice}>Estimare preliminară · conform profilului provizoriu FORMA v1</p>
      <dl className={styles.hardwareItems}>
        {result.items.map(item => (
          <div key={item.id}>
            <dt>{item.name}{item.is_estimate && <span>Estimare preliminară</span>}</dt>
            <dd>{item.quantity} <span>{item.unit}</span></dd>
          </div>
        ))}
      </dl>
      <p className={styles.hardwareTotal}>Total elemente · {result.total_item_count} buc.</p>
      <details className={styles.expandable}>
        <summary>Reguli de calcul și ipoteze</summary>
        <dl className={styles.hardwareRules}>
          {result.items.map(item => <div key={item.id}><dt>{item.name}</dt><dd>{item.calculation_rule}</dd></div>)}
        </dl>
        <ul className={styles.assumptions}>{result.assumptions.map(assumption => <li key={assumption}>{assumption}</li>)}</ul>
      </details>
    </section>
  );
}
