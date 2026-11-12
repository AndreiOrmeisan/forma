"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { furnitureRoutes } from "@/config/domains";
import { useWardrobeProject } from "./wardrobe-project-context";
import { validateWardrobeDraft, wardrobeFields, wardrobeRules } from "./wardrobe-configuration";
import styles from "./review.module.css";

export function WardrobeForm() {
  const { draft, updateField, confirm } = useWardrobeProject();
  const router = useRouter();
  if (!draft) return null;
  const { errors, configuration } = validateWardrobeDraft(draft);

  return (
    <form className={styles.formCard} noValidate onSubmit={event => {
      event.preventDefault();
      if (confirm()) router.push(furnitureRoutes.resultProject);
    }}>
      <h2>Configurația dulapului</h2>
      <p className={styles.formDescription}>Verifică fiecare valoare și ajusteaz-o după schița ta.</p>
      <div className={styles.fields}>
        {wardrobeFields.map(field => {
          const rule = wardrobeRules[field];
          const id = `wardrobe-${field}`;
          return (
            <div className={styles.field} key={field}>
              <label htmlFor={id}>{rule.label}{rule.unit && <span> · {rule.unit}</span>}</label>
              {rule.unit ? (
                <input
                  id={id} type="number" inputMode="numeric" min={rule.min} max={rule.max} step={1}
                  value={draft[field]} onChange={event => updateField(field, event.target.value)}
                  aria-invalid={Boolean(errors[field])} aria-describedby={`${id}-hint`} required
                />
              ) : (
                <select id={id} value={draft[field]} onChange={event => updateField(field, event.target.value)} aria-invalid={Boolean(errors[field])} aria-describedby={`${id}-hint`}>
                  {Array.from({ length: rule.max - rule.min + 1 }, (_, index) => rule.min + index).map(value => <option key={value} value={value}>{value}</option>)}
                </select>
              )}
              <p id={`${id}-hint`} className={errors[field] ? styles.fieldError : styles.fieldHint} aria-live="polite">
                {errors[field] || `${rule.min}–${rule.max}${rule.unit ? ` ${rule.unit}` : ""}`}
              </p>
            </div>
          );
        })}
      </div>
      <button type="submit" className={styles.confirmButton} disabled={!configuration}>
        Confirmă configurația <ArrowRight size={19} aria-hidden="true" />
      </button>
    </form>
  );
}
