"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useImageDraft } from "@/components/image-upload/image-draft-context";
import { initialPricing, priceItems, pricingError, type Estimate, type PricingDraft } from "./wardrobe-pricing";
import { migrateManualSnapshots, priceStateSignature, type ProjectPriceSnapshot } from "./project-price-snapshot";
import { overrideSnapshot } from "../catalog/catalog-price-source";
import type { WardrobeCalculationResult } from "./calculate-wardrobe";
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
  priceSnapshots:ProjectPriceSnapshot[];
  calculation:WardrobeCalculationResult|null;
  catalogInitialized:boolean;
  appliedEstimate:{signature:string;estimate:Estimate}|null;
  acceptCalculation:(result:WardrobeCalculationResult)=>void;
  applyProjectPrices:(pricing:PricingDraft,snapshots:ProjectPriceSnapshot[],estimate:Estimate,expected:string,saved?:FurnitureProject)=>void;
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

type ProjectState = Pick<WardrobeProject, "interpretation" | "draft" | "confirmed" | "pricing" | "savedProject" | "priceSnapshots" | "calculation" | "catalogInitialized" | "appliedEstimate"> & { imageUrl: string | null; ownerId:string | null };

export function WardrobeProjectProvider({ children }: { children: ReactNode }) {
  const {user} = useAuth();
  const ownerId = user?.id || null;
  const { image } = useImageDraft();
  const imageUrl = image?.url ?? null;
  const [project, setProject] = useState<ProjectState>({
    imageUrl,
    ownerId,
    savedProject: null,
    priceSnapshots:[],calculation:null,catalogInitialized:false,appliedEstimate:null,
    pricing: initialPricing(),
    interpretation: null,
    draft: null,
    confirmed: null,
  });

  // Reset image-dependent data without remounting the active upload component.
  if (project.imageUrl !== imageUrl || (project.ownerId && project.ownerId !== ownerId)) {
    setProject({ imageUrl, ownerId, interpretation: null, draft: null, confirmed: null, pricing: initialPricing(), savedProject: null,priceSnapshots:[],calculation:null,catalogInitialized:false,appliedEstimate:null });
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
      calculation:null,
    } : previous);
  }, [imageUrl]);

  const updateField = useCallback((field: WardrobeField, value: string) => {
    setProject(previous => ({
      ...previous,
      draft: previous.draft ? { ...previous.draft, [field]: value } : null,
      confirmed: null,
      calculation:null,appliedEstimate:null,
    }));
  }, []);

  const restoreProject = useCallback((saved: FurnitureProject) => {
    if (!saved.compatible) return;
    setProject(previous => previous.ownerId === ownerId ? ({ ...previous, savedProject: saved, interpretation: null,
      draft: configurationToDraft(saved.confirmed_configuration), confirmed: Object.freeze({...saved.confirmed_configuration}),
      pricing: restorePricing(saved),priceSnapshots:migrateManualSnapshots(saved.manual_price_catalog,saved.price_snapshots),catalogInitialized:true,calculation:null,appliedEstimate:null }) : previous);
  }, [ownerId]);

  const markSaved = useCallback((saved: FurnitureProject) => {
    setProject(previous => previous.ownerId === ownerId ? ({ ...previous, savedProject: saved }) : previous);
  }, [ownerId]);

  const acceptCalculation=useCallback((result:WardrobeCalculationResult)=>{
    setProject(previous=>JSON.stringify(previous.confirmed)===JSON.stringify(result.input_configuration) ? {...previous,calculation:result}:previous);
  },[]);
  const applyProjectPrices=useCallback((pricing:PricingDraft,snapshots:ProjectPriceSnapshot[],estimate:Estimate,expected:string,saved?:FurnitureProject)=>{
    setProject(previous=>priceStateSignature(previous.confirmed,previous.pricing,previous.priceSnapshots,previous.savedProject?.id || null)!==expected ? previous : {
      ...previous,pricing,priceSnapshots:snapshots,catalogInitialized:true,...(saved ? {savedProject:saved}:{}),
      appliedEstimate:{signature:JSON.stringify({configuration:previous.confirmed,pricing}),estimate},
    });
  },[]);
  const updatePricing=useCallback((key:string,value:string)=>{
    setProject(previous=>({...previous,pricing:{...previous.pricing,[key]:value},
      priceSnapshots:priceItems.some(([code])=>code===key) && (value.trim()==="" || !pricingError(value)) ?
        overrideSnapshot(previous.priceSnapshots,key,value.trim()==="" ? null:value.replace(",",".")) : previous.priceSnapshots}));
  },[]);

  function confirm() {
    if (!project.draft) return false;
    const { configuration } = validateWardrobeDraft(project.draft);
    if (!configuration) return false;
    setProject(previous => ({ ...previous, confirmed: Object.freeze({ ...configuration }) }));
    return true;
  }

  return (
    <WardrobeProjectContext.Provider value={{ ...project, restoreProject, markSaved, acceptInterpretation, updateField, confirm, updatePricing,acceptCalculation,applyProjectPrices }}>
      {children}
    </WardrobeProjectContext.Provider>
  );
}

export function useWardrobeProject() {
  const context = useContext(WardrobeProjectContext);
  if (!context) throw new Error("Wardrobe review requires WardrobeProjectProvider.");
  return context;
}
