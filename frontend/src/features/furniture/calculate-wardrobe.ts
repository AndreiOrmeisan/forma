import { isWardrobeConfiguration, wardrobeFields, type WardrobeConfiguration } from "./wardrobe-configuration";

export type CuttingPanel = {
  id: string;
  name: string;
  material: "PAL" | "HDF";
  thickness_mm: string;
  length_mm: string;
  width_mm: string;
  quantity: number;
  unit_area_m2: string;
  area_m2: string;
  orientation: "unspecified";
};

export type WardrobeCalculationResult = {
  construction_profile: {
    id: string;
    name: string;
    assumptions: string[];
    interior_bays_count: 1;
  };
  input_configuration: WardrobeConfiguration;
  panels: CuttingPanel[];
  totals: {
    total_pal_area_m2: string;
    total_hdf_area_m2: string;
    total_panel_count: number;
  };
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPositiveDecimal(value: unknown): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value) && /[1-9]/.test(value);
}

function isPanel(value: unknown): value is CuttingPanel {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" &&
    (value.material === "PAL" || value.material === "HDF") &&
    [value.thickness_mm, value.length_mm, value.width_mm, value.unit_area_m2, value.area_m2].every(isPositiveDecimal) &&
    Number.isSafeInteger(value.quantity) && Number(value.quantity) > 0 && value.orientation === "unspecified";
}

export function isWardrobeCalculationResult(value: unknown): value is WardrobeCalculationResult {
  if (!isRecord(value) || !isRecord(value.construction_profile) || !isRecord(value.totals)) return false;
  const profile = value.construction_profile;
  return profile.id === "forma-wardrobe-poc-v1" && typeof profile.name === "string" &&
    profile.interior_bays_count === 1 && Array.isArray(profile.assumptions) && profile.assumptions.every(item => typeof item === "string") &&
    isWardrobeConfiguration(value.input_configuration) &&
    Array.isArray(value.panels) && value.panels.length > 0 && value.panels.every(isPanel) &&
    new Set(value.panels.map(panel => panel.id)).size === value.panels.length &&
    isPositiveDecimal(value.totals.total_pal_area_m2) && isPositiveDecimal(value.totals.total_hdf_area_m2) &&
    Number.isSafeInteger(value.totals.total_panel_count) && Number(value.totals.total_panel_count) > 0 &&
    Array.isArray(value.warnings) && value.warnings.every(item => typeof item === "string");
}

export function formatExactDecimal(value: string): string {
  const [whole, fraction] = value.split(".");
  const significantFraction = fraction?.replace(/0+$/, "");
  return significantFraction ? `${whole},${significantFraction}` : whole;
}

export async function calculateWardrobe(configuration: WardrobeConfiguration, signal: AbortSignal): Promise<WardrobeCalculationResult> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/furniture/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ configuration, confirmed: true }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error("Serviciul de calcul nu răspunde. Verifică conexiunea și încearcă din nou.");
  }
  if (!response.ok) {
    if (response.status === 422) throw new Error("Configurația confirmată nu este validă. Revino la configurare și verifică valorile.");
    throw new Error("Lista de debitare nu poate fi calculată momentan. Încearcă din nou.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!isWardrobeCalculationResult(data)) throw new Error("Răspunsul serviciului de calcul nu este valid. Încearcă din nou.");
  if (!wardrobeFields.every(field => data.input_configuration[field] === configuration[field])) {
    throw new Error("Rezultatul nu corespunde configurației confirmate. Încearcă din nou.");
  }
  return data;
}
