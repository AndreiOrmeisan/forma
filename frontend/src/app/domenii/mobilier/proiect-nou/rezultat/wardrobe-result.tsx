"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useImageDraft } from "@/components/image-upload/image-draft-context";
import { useWardrobeProject } from "@/features/furniture/wardrobe-project-context";
import { wardrobeFields, wardrobeRules } from "@/features/furniture/wardrobe-configuration";
import { furnitureRoutes } from "@/config/domains";
import { ProjectRecovery } from "../project-recovery";
import styles from "@/features/furniture/review.module.css";

export function WardrobeResult() {
  const { image } = useImageDraft();
  const { confirmed } = useWardrobeProject();
  if (!image) return <ProjectRecovery />;
  if (!confirmed) {
    return (
      <section className={styles.review}>
        <h1>Confirmă mai întâi configurația.</h1>
        <p>Verifică dimensiunile și numărul de uși și polițe înainte de a continua.</p>
        <Link href={furnitureRoutes.reviewProject} className={styles.backLink}>Înapoi la configurare</Link>
      </section>
    );
  }
  return (
    <section className={styles.review} aria-labelledby="result-title">
      <span className={styles.confirmationIcon}><Check size={25} aria-hidden="true" /></span>
      <div className={styles.introduction}>
        <h1 id="result-title">Configurație confirmată.</h1>
        <p>Estimarea materialelor va fi implementată într-un sprint viitor. Configurația este păstrată temporar în acest flux.</p>
      </div>
      <div className={styles.formCard}>
        <h2>Dulap</h2>
        <dl className={styles.summary}>
          {wardrobeFields.map(field => (
            <div key={field}>
              <dt>{wardrobeRules[field].label}</dt>
              <dd>{confirmed[field]} {wardrobeRules[field].unit}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Link href={furnitureRoutes.reviewProject} className={styles.backLink}>Modifică configurația</Link>
    </section>
  );
}
