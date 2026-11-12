"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ValidatedImage } from "./validate-image";

type ImageDraft = {
  image: ValidatedImage | null;
  setImage: (image: ValidatedImage | null) => void;
};

const ImageDraftContext = createContext<ImageDraft | null>(null);

export function ImageDraftProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<ValidatedImage | null>(null);

  useEffect(() => {
    return () => {
      if (image) URL.revokeObjectURL(image.url);
    };
  }, [image]);

  return (
    <ImageDraftContext.Provider value={{ image, setImage }}>
      {children}
    </ImageDraftContext.Provider>
  );
}

export function useImageDraft() {
  const context = useContext(ImageDraftContext);
  if (!context) throw new Error("Image upload requires ImageDraftProvider.");
  return context;
}
