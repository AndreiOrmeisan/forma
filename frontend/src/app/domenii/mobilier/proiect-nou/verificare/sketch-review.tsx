"use client";

import Link from "next/link";
import { ArrowLeft, ImagePlus } from "lucide-react";
import { useImageDraft } from "@/components/image-upload/image-draft-context";
import { ImagePreview } from "@/components/image-upload/image-preview";
import { furnitureRoutes } from "@/config/domains";
import styles from "../flow.module.css";

export function SketchReview() {
  const { image } = useImageDraft();

  if (!image) {
    return (
      <section className={styles.recovery} aria-labelledby="recovery-title">
        <ImagePlus size={36} strokeWidth={1.4} aria-hidden="true" />
        <h1 id="recovery-title">Adaugă din nou schița.</h1>
        <p>Fotografia este păstrată temporar. După reîncărcarea paginii sau deschiderea directă a acestui link, trebuie să o selectezi din nou.</p>
        <Link href={furnitureRoutes.newProject} className={styles.returnLink}>Încarcă o schiță</Link>
      </section>
    );
  }

  return (
    <section className={styles.flowContent} aria-labelledby="review-title">
      <div className={styles.introduction}>
        <h1 id="review-title">Schița ta, pregătită<span>.</span></h1>
        <p>Verifică dacă fotografia este clară și dimensiunile se pot citi.</p>
      </div>
      <div className={styles.reviewContent}>
        <ImagePreview image={image} />
        <div className={styles.reviewNote}>
          <h2>Următorul pas, în curând</h2>
          <p>Analiza AI va fi implementată într-un sprint viitor. Fotografia ta este disponibilă temporar în acest flux.</p>
        </div>
        <Link href={furnitureRoutes.newProject} className={styles.returnLink}>
          <ArrowLeft size={18} aria-hidden="true" /> Înapoi la fotografie
        </Link>
      </div>
    </section>
  );
}
