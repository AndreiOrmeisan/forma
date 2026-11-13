"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { ValidatedImage } from "./validate-image";

type ImageDraft = {
  image: ValidatedImage | null;
  setImage: (image: ValidatedImage | null) => void;
};

const ImageDraftContext = createContext<ImageDraft | null>(null);

export function ImageDraftProvider({ children }: { children: ReactNode }) {
  const [image, setImageState] = useState<ValidatedImage | null>(null);
  const current = useRef<ValidatedImage | null>(null);

  const setImage = useCallback((next: ValidatedImage | null) => {
    const previous = current.current;
    current.current = next;
    setImageState(next);
    if (previous && previous.url !== next?.url) URL.revokeObjectURL(previous.url);
  }, []);

  useEffect(() => {
    return () => {
      if (current.current) URL.revokeObjectURL(current.current.url);
    };
  }, []);

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
