"use client";

import { useRef, type ChangeEvent } from "react";
import { Camera, ImagePlus } from "lucide-react";
import styles from "./upload.module.css";

type UploadActionsProps = {
  onSelect: (file: File) => void;
  disabled?: boolean;
  replacing?: boolean;
};

export function UploadActions({ onSelect, disabled = false, replacing = false }: UploadActionsProps) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onSelect(file);
  }

  return (
    <div className={styles.actions}>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} aria-label="Fotografiază schița" disabled={disabled} />
      <input ref={galleryInput} type="file" accept="image/*" hidden onChange={handleChange} aria-label="Alege din galerie" disabled={disabled} />
      <button type="button" className={styles.primaryButton} onClick={() => cameraInput.current?.click()} disabled={disabled}>
        <Camera size={20} strokeWidth={1.6} aria-hidden="true" /> Fotografiază schița
      </button>
      <button type="button" className={styles.secondaryButton} onClick={() => galleryInput.current?.click()} disabled={disabled}>
        <ImagePlus size={20} strokeWidth={1.6} aria-hidden="true" />
        {replacing ? "Schimbă fotografia" : "Alege din galerie"}
      </button>
    </div>
  );
}
