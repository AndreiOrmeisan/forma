"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Columns3, LoaderCircle, Trash2 } from "lucide-react";
import { useImageDraft } from "./image-draft-context";
import { ImagePreview } from "./image-preview";
import { UploadActions } from "./upload-actions";
import { validateImage } from "./validate-image";
import styles from "./upload.module.css";

export function SketchUploader({ onContinue }: { onContinue: () => void }) {
  const { image, setImage } = useImageDraft();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    return () => { requestId.current += 1; };
  }, []);

  async function selectImage(file: File) {
    const currentRequest = ++requestId.current;
    setIsProcessing(true);
    setError("");
    setImage(null);
    try {
      const validated = await validateImage(file);
      if (requestId.current !== currentRequest) {
        URL.revokeObjectURL(validated.url);
        return;
      }
      setImage(validated);
    } catch (error) {
      if (requestId.current === currentRequest) {
        setError(error instanceof Error ? error.message : "Imaginea nu poate fi citită. Încearcă din nou.");
      }
    } finally {
      if (requestId.current === currentRequest) setIsProcessing(false);
    }
  }

  return (
    <div className={styles.uploader}>
      <div className={styles.uploadSurface} aria-busy={isProcessing}>
        {image ? <ImagePreview image={image} /> : (
          <div className={styles.emptyPreview}>
            <span className={styles.uploadIcon}>
              {isProcessing
                ? <LoaderCircle className={styles.spinner} size={32} strokeWidth={1.4} aria-hidden="true" />
                : <Columns3 size={90} strokeWidth={0.8} aria-hidden="true" />}
            </span>
            <p>{isProcessing ? "Verificăm fotografia…" : "Desenul tău, cu dimensiunile la vedere."}</p>
          </div>
        )}
        <UploadActions onSelect={selectImage} disabled={isProcessing} replacing={Boolean(image)} />
        {image && (
          <button type="button" className={styles.deleteButton} onClick={() => { setImage(null); setError(""); }}>
            <Trash2 size={16} aria-hidden="true" /> Șterge
          </button>
        )}
        <p className={styles.formatHint}>JPG, PNG sau WebP · Max. 10 MB</p>
        <p className={styles.cameraHint}>Dacă dispozitivul nu oferă captură foto, alege imaginea din galerie.</p>
      </div>
      <div className={styles.feedback}>
        <p role="status" aria-live="polite">{isProcessing ? "Verificăm fotografia…" : image ? "Fotografia este pregătită." : ""}</p>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </div>
      <button type="button" className={styles.continueButton} disabled={!image || isProcessing} onClick={onContinue}>
        Continuă <ArrowRight size={19} aria-hidden="true" />
      </button>
    </div>
  );
}
