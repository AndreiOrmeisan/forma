"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useImageDraft } from "@/components/image-upload/image-draft-context";
import { initialPricing, type PricingDraft } from "./wardrobe-pricing";
import { restorePricing, type FurnitureProject } from "./project-api";
import { useAuth } from "../auth/auth-context";
import {
  configurationToDraft,
  validateWardrobeDraft,
  type MockInterpretation,
  type WardrobeConfiguration,
  type WardrobeDraft,
  type WardrobeField,
} from "./wardrobe-configuration";

type WardrobeProject = {
  savedProject: FurnitureProject | null;
  restoreProject: (project: FurnitureProject) => void;
  markSaved: (project: FurnitureProject) => void;
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

type ProjectState = Pick<WardrobeProject, "interpretation" | "draft" | "confirmed" | "pricing" | "savedProject"> & { imageUrl: string | null; ownerId:string | null };

export function WardrobeProjectProvider({ children }: { children: ReactNode }) {
  const {user} = useAuth();
  const ownerId = user?.id || null;
  const { image } = useImageDraft();
  const imageUrl = image?.url ?? null;
  const [project, setProject] = useState<ProjectState>({
    imageUrl,
    ownerId,
    savedProject: null,
    pricing: initialPricing(),
    interpretation: null,
    draft: null,
    confirmed: null,
  });

  // Reset image-dependent data without remounting the active upload component.
  if (project.imageUrl !== imageUrl || (project.ownerId && project.ownerId !== ownerId)) {
    setProject({ imageUrl, ownerId, interpretation: null, draft: null, confirmed: null, pricing: initialPricing(), savedProject: null });
  } else if (project.ownerId !== ownerId) {
    // First login preserves an unsaved guest workflow; switching accounts clears it.
    setProject({...project,ownerId});
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

  const restoreProject = useCallback((saved: FurnitureProject) => {
    if (!saved.compatible) return;
    setProject(previous => previous.ownerId === ownerId ? ({ ...previous, savedProject: saved, interpretation: null,
      draft: configurationToDraft(saved.confirmed_configuration), confirmed: Object.freeze({...saved.confirmed_configuration}),
      pricing: restorePricing(saved) }) : previous);
  }, [ownerId]);

  const markSaved = useCallback((saved: FurnitureProject) => {
    setProject(previous => previous.ownerId === ownerId ? ({ ...previous, savedProject: saved }) : previous);
  }, [ownerId]);

  function confirm() {
    if (!project.draft) return false;
    const { configuration } = validateWardrobeDraft(project.draft);
    if (!configuration) return false;
    setProject(previous => ({ ...previous, confirmed: Object.freeze({ ...configuration }) }));
    return true;
  }

  return (
    <WardrobeProjectContext.Provider value={{ ...project, restoreProject, markSaved, acceptInterpretation, updateField, confirm, updatePricing: (key, value) => setProject(previous => ({ ...previous, pricing: { ...previous.pricing, [key]: value } })) }}>
      {children}
    </WardrobeProjectContext.Provider>
  );
}

export function useWardrobeProject() {
  const context = useContext(WardrobeProjectContext);
  if (!context) throw new Error("Wardrobe review requires WardrobeProjectProvider.");
  return context;
}
