"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useImageDraft } from "@/components/image-upload/image-draft-context";
import { ImagePreview } from "@/components/image-upload/image-preview";
import { furnitureRoutes } from "@/config/domains";
import { analyzeSketch } from "@/features/furniture/analyze-sketch";
import { useWardrobeProject } from "@/features/furniture/wardrobe-project-context";
import { WardrobeForm } from "@/features/furniture/wardrobe-form";
import { WardrobeConfiguratorPreview } from "@/features/furniture/wardrobe-configurator-preview";
import { ProjectRecovery } from "../project-recovery";
import styles from "@/features/furniture/review.module.css";

export function SketchReview() {
  const { image } = useImageDraft();
  const { interpretation, acceptInterpretation } = useWardrobeProject();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!image || interpretation) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setRequestError("Serverul local răspunde prea lent. Încearcă din nou.");
    }, 20000);
    analyzeSketch(image.file, controller.signal)
      .then(data => { if (!controller.signal.aborted) acceptInterpretation(data); })
      .catch(error => {
        if (!controller.signal.aborted) setRequestError(error instanceof Error ? error.message : "Datele demonstrative nu pot fi încărcate.");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [image, interpretation, acceptInterpretation, attempt]);

  if (!image) return <ProjectRecovery />;

  return (
    <section className={styles.review} aria-labelledby="review-title">
      <div className={styles.introduction}>
        <p className={styles.eyebrow}>MOBILIER / DULAP</p>
        <h1 id="review-title">Așa arată dulapul tău?</h1>
        <p>Compară valorile cu schița și verifică dimensiunile în milimetri înainte de confirmare.</p>
      </div>
      <aside className={styles.mockNotice} aria-label="Date demonstrative">
        <h2>Interpretare demonstrativă · Mock</h2>
        <p>Valorile inițiale sunt un exemplu fix, independent de conținutul fotografiei. Ajustează-le pentru dulapul tău.</p>
      </aside>
      <div className={styles.reviewGrid}>
        <div className={styles.visualColumn}>
          <div className={styles.sketchPanel}>
            <ImagePreview image={image} />
            <Link href={furnitureRoutes.newProject} className={styles.backLink}>
              <ArrowLeft size={16} aria-hidden="true" /> Înapoi la fotografie
            </Link>
          </div>
          {interpretation && <WardrobeConfiguratorPreview />}
        </div>
        {interpretation ? <WardrobeForm /> : (
          <div className={styles.requestState}>
            {requestError ? (
              <>
                <p role="alert">{requestError}</p>
                <button type="button" className={styles.retryButton} onClick={() => { setRequestError(null); setAttempt(value => value + 1); }}>Încearcă din nou</button>
              </>
            ) : (
              <p role="status"><LoaderCircle size={20} aria-hidden="true" /> Încărcăm datele demonstrative…</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
