import { isWardrobeConfiguration, type WardrobeConfiguration } from "../furniture/wardrobe-configuration";
import { dimensionalProfileId, dimensionalCalculationVersion, type ManufacturingSnapshot } from "./manufacturing-model";

export type ProductionPanel = {panel_id: string; name: string; quantity: number; finished_length_mm: string; finished_width_mm: string;
  raw_length_mm: string | null; raw_width_mm: string | null; cutting_length_mm: string | null; cutting_width_mm: string | null;
  edges: Record<"top" | "bottom" | "left" | "right", "none" | "abs_0_4" | "abs_2">; issues: string[]};
export type ManufacturingResult = {dimensional_profile_id: typeof dimensionalProfileId; calculation_version: typeof dimensionalCalculationVersion;
  configuration: WardrobeConfiguration; profile_id: string; profile_revision: number;
  readiness: "configuration_incomplete" | "calculation_ready_unverified"; panels: ProductionPanel[];
  carcass_depth_mm: string; back_projection_mm: string | null; front_projection_mm: string | null; overall_depth_mm: string | null;
  issues: string[]; warnings: string[]};
export const manufacturingSignature = (configuration: WardrobeConfiguration | null, snapshot: ManufacturingSnapshot | null) => JSON.stringify({configuration, snapshot});
export const readinessLabels = {legacy_provisional: "Estimare legacy · provizorie", configuration_incomplete: "Prelucrare neconfigurată complet",
  calculation_ready_unverified: "Calculabil · neverificat în atelier", workshop_approved: "Aprobat în atelier"};

export function isManufacturingResult(value: unknown): value is ManufacturingResult {
  const v = value as ManufacturingResult;
  const decimal = (s: unknown) => typeof s === "string" && /^\d+(?:\.\d+)?$/.test(s) && Number.isFinite(Number(s));
  const positive = (s: unknown) => decimal(s) && Number(s) > 0;
  const optional = (s: unknown) => s === null || positive(s);
  const strings = (s: unknown) => Array.isArray(s) && s.every(value => typeof value === "string");
  return !!v && v.dimensional_profile_id === dimensionalProfileId && v.calculation_version === dimensionalCalculationVersion &&
    isWardrobeConfiguration(v.configuration) && typeof v.profile_id === "string" && Number.isSafeInteger(v.profile_revision) && v.profile_revision > 0 &&
    ["configuration_incomplete", "calculation_ready_unverified"].includes(v.readiness) && positive(v.carcass_depth_mm) && optional(v.overall_depth_mm) &&
    [v.front_projection_mm, v.back_projection_mm].every(value => value === null || decimal(value)) && strings(v.issues) && strings(v.warnings) &&
    Array.isArray(v.panels) && v.panels.length >= 5 && v.panels.length <= 6 && new Set(v.panels.map(p => p?.panel_id)).size === v.panels.length &&
    v.panels.every(p => p && typeof p.panel_id === "string" && typeof p.name === "string" && Number.isSafeInteger(p.quantity) && p.quantity > 0 &&
      positive(p.finished_length_mm) && positive(p.finished_width_mm) && [p.raw_length_mm, p.raw_width_mm, p.cutting_length_mm, p.cutting_width_mm].every(optional) &&
      p.edges && Object.keys(p.edges).length === 4 && ["top", "bottom", "left", "right"].every(edge => ["none", "abs_0_4", "abs_2"].includes(p.edges[edge as keyof typeof p.edges])) && strings(p.issues));
}

export async function calculateManufacturing(configuration: WardrobeConfiguration, snapshot: ManufacturingSnapshot, signal: AbortSignal) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  let response: Response;
  try {response = await fetch(`${base.replace(/\/$/, "")}/api/v1/furniture/manufacturing-dimensions`, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({configuration, confirmed: true, snapshot}), signal});}
  catch (reason) {if (signal.aborted) throw reason; throw new Error("Calculul de prelucrare nu este disponibil. Verifică backend-ul; configurația și prețurile sunt păstrate.");}
  const result: unknown = await response.json();
  if (!response.ok || !isManufacturingResult(result) || JSON.stringify(result.configuration) !== JSON.stringify(configuration) ||
    result.profile_id !== snapshot.profile.id || result.profile_revision !== snapshot.profile.revision) throw new Error("Răspuns de prelucrare invalid sau incompatibil. Nu folosim dimensiuni brute neverificate.");
  return result;
}
