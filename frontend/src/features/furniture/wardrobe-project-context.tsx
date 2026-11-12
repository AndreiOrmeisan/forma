"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useImageDraft } from "@/components/image-upload/image-draft-context";
import { initialPricing, type PricingDraft } from "./wardrobe-pricing";
import {
  configurationToDraft,
  validateWardrobeDraft,
  type MockInterpretation,
  type WardrobeConfiguration,
  type WardrobeDraft,
  type WardrobeField,
} from "./wardrobe-configuration";

type WardrobeProject = {
  pricing: PricingDraft;
  updatePricing: (key: string, value: string) => void;
  interpretation: MockInterpretation | null;
  draft: WardrobeDraft | null;
  confirmed: WardrobeConfiguration | null;
  acceptInterpretation: (data: MockInterpretation) => void;
  updateField: (field: WardrobeField, value: string) => void;
  confirm: () => boolean;
};

const WardrobeProjectContext = createContext<WardrobeProject | null>(null);

type ProjectState = Pick<WardrobeProject, "interpretation" | "draft" | "confirmed" | "pricing"> & { imageUrl: string | null };

export function WardrobeProjectProvider({ children }: { children: ReactNode }) {
  const { image } = useImageDraft();
  const imageUrl = image?.url ?? null;
  const [project, setProject] = useState<ProjectState>({
    imageUrl,
    pricing: initialPricing(),
    interpretation: null,
    draft: null,
    confirmed: null,
  });

  // Reset image-dependent data without remounting the active upload component.
  if (project.imageUrl !== imageUrl) {
    setProject({ imageUrl, interpretation: null, draft: null, confirmed: null, pricing: initialPricing() });
  }

  const acceptInterpretation = useCallback((data: MockInterpretation) => {
    setProject(previous => previous.imageUrl === imageUrl ? {
      ...previous,
      interpretation: Object.freeze({ ...data }),
      draft: configurationToDraft(data),
      confirmed: null,
    } : previous);
  }, [imageUrl]);

  const updateField = useCallback((field: WardrobeField, value: string) => {
    setProject(previous => ({
      ...previous,
      draft: previous.draft ? { ...previous.draft, [field]: value } : null,
      confirmed: null,
    }));
  }, []);

  function confirm() {
    if (!project.draft) return false;
    const { configuration } = validateWardrobeDraft(project.draft);
    if (!configuration) return false;
    setProject(previous => ({ ...previous, confirmed: Object.freeze({ ...configuration }) }));
    return true;
  }

  return (
    <WardrobeProjectContext.Provider value={{ ...project, acceptInterpretation, updateField, confirm, updatePricing: (key, value) => setProject(previous => ({ ...previous, pricing: { ...previous.pricing, [key]: value } })) }}>
      {children}
    </WardrobeProjectContext.Provider>
  );
}

export function useWardrobeProject() {
  const context = useContext(WardrobeProjectContext);
  if (!context) throw new Error("Wardrobe review requires WardrobeProjectProvider.");
  return context;
}
