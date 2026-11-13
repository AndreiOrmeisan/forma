import { configurationToDraft, validateWardrobeDraft, type WardrobeConfiguration, type WardrobeDraft } from "./wardrobe-configuration";
import { initialPricing, type PricingDraft } from "./wardrobe-pricing";
import { pricingFingerprint, restorePricing, type FurnitureProject } from "./project-api";
import { migrateManualSnapshots, snapshotFingerprint, type ProjectPriceSnapshot } from "./project-price-snapshot";

export type ProjectWork = {
  projectName: string;
  projectDescription: string;
  projectStatus: "draft" | "completed";
  imageUrl: string | null;
  draft: WardrobeDraft | null;
  confirmed: WardrobeConfiguration | null;
  pricing: PricingDraft;
  priceSnapshots: ProjectPriceSnapshot[];
  savedProject: FurnitureProject | null;
};

export function hasUnsavedProject(work: ProjectWork): boolean {
  const saved = work.savedProject;
  if (!saved) {
    return Boolean(work.imageUrl || work.draft || work.confirmed || work.projectName.trim() ||
      work.projectDescription.trim() || work.projectStatus !== "draft" || work.priceSnapshots.length ||
      pricingFingerprint(work.pricing) !== pricingFingerprint(initialPricing()));
  }
  const configuration = work.draft ? validateWardrobeDraft(work.draft).configuration : null;
  const originalDraft = configurationToDraft(saved.confirmed_configuration);
  const changedDraft = configuration
    ? JSON.stringify(configuration) !== JSON.stringify(saved.confirmed_configuration)
    : JSON.stringify(work.draft) !== JSON.stringify(originalDraft);
  return changedDraft || !work.confirmed ||
    work.projectName.trim() !== saved.name ||
    work.projectDescription.trim() !== (saved.description || "") ||
    work.projectStatus !== saved.status ||
    pricingFingerprint(work.pricing) !== pricingFingerprint(restorePricing(saved)) ||
    snapshotFingerprint(work.priceSnapshots) !==
      snapshotFingerprint(migrateManualSnapshots(saved.manual_price_catalog, saved.price_snapshots));
}

export function withinProjectWorkspace(from: string, to: string): boolean {
  const current = new URL(from);
  const target = new URL(to, current);
  if (current.origin !== target.origin) return false;
  const marker = "/domenii/mobilier/proiect-nou";
  const position = current.pathname.indexOf(marker);
  if (position >= 0) {
    const scope = current.pathname.slice(0, position) + marker;
    return target.pathname === scope || target.pathname.startsWith(scope + "/");
  }
  return current.pathname.replace(/\/$/, "") === target.pathname.replace(/\/$/, "") &&
    current.searchParams.get("id") === target.searchParams.get("id");
}
