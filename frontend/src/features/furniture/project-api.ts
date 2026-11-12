import { isWardrobeConfiguration, type WardrobeConfiguration } from "./wardrobe-configuration";
import { initialPricing, priceItems, pricingError, pricingPayload, type PricingDraft } from "./wardrobe-pricing";
import { furnitureRoutes } from "../../config/domains";

export type CatalogEntry = ReturnType<typeof pricingPayload>["price_catalog"][number];
export type ProjectInput = {
  domain: "furniture"; name: string; description: string | null; status: "draft" | "completed";
  confirmed_configuration: WardrobeConfiguration; manual_price_catalog: CatalogEntry[];
  waste_allowances: {pal: string; hdf: string; abs: string}; labor_cost: string; markup_percentage: string;
  schema_version: number; construction_profile_id: string; calculation_version: string;
};
export type FurnitureProject = ProjectInput & {
  id: string; created_at: string; updated_at: string; revision: number;
  compatible: boolean; deviz_complete: boolean | null; warnings: string[];
};
export type ProjectPage = {items: FurnitureProject[]; total: number; limit: number; offset: number};
export type ProjectCapabilities = {enabled: boolean; reason: string | null};
export const projectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const projectHref = (id: string) => `${furnitureRoutes.projects}/deschide?id=${encodeURIComponent(id)}`;

export function isProject(value: unknown): value is FurnitureProject {
  if (!value || typeof value !== "object") return false;
  const v = value as FurnitureProject;
  const decimal = (value: unknown) => typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
  return typeof v.id === "string" && projectUuid.test(v.id) && typeof v.name === "string" &&
    (v.description === null || typeof v.description === "string") && v.domain === "furniture" &&
    ["draft", "completed"].includes(v.status) && isWardrobeConfiguration(v.confirmed_configuration) &&
    Number.isSafeInteger(v.revision) && v.revision > 0 && Number.isSafeInteger(v.schema_version) &&
    typeof v.construction_profile_id === "string" && typeof v.calculation_version === "string" &&
    typeof v.compatible === "boolean" && (!v.compatible || (v.schema_version === 1 && v.construction_profile_id === "forma-wardrobe-poc-v1" && v.calculation_version === "wardrobe-v1")) &&
    (typeof v.deviz_complete === "boolean" || v.deviz_complete === null) &&
    [v.created_at, v.updated_at].every(date => typeof date === "string" && Number.isFinite(Date.parse(date))) &&
    Array.isArray(v.warnings) && v.warnings.every(warning => typeof warning === "string") &&
    decimal(v.labor_cost) && decimal(v.markup_percentage) && !!v.waste_allowances &&
    [v.waste_allowances.pal, v.waste_allowances.hdf, v.waste_allowances.abs].every(decimal) &&
    Array.isArray(v.manual_price_catalog) && v.manual_price_catalog.every(entry => entry &&
      priceItems.some(([code, , unit]) => code === entry.item_code && unit === entry.unit) &&
      typeof entry.item_name === "string" && decimal(entry.unit_price_ron) && entry.currency === "RON" &&
      entry.source_type === "manual" && typeof entry.source_name === "string" &&
      typeof entry.updated_at === "string" && Number.isFinite(Date.parse(entry.updated_at)));
}

export class ProjectApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function projectRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1/furniture/${path}`, {
      ...options, cache: "no-store", signal: options.signal || AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch {
    throw new ProjectApiError("Nu putem contacta stocarea locală. Verifică backendul și încearcă din nou. Datele introduse nu au fost șterse.", 0);
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      403: "Salvarea este permisă numai pe calculatorul local.",
      404: "Proiectul nu există sau salvarea locală nu este activată.",
      409: "Proiectul a fost modificat în altă sesiune sau versiunea este incompatibilă. Redeschide-l înainte de a salva; păstrează separat modificările tale.",
      422: "Datele proiectului sunt invalide. Verifică numele, configurația și prețurile.",
    };
    throw new ProjectApiError(messages[response.status] || "Stocarea locală nu este disponibilă. Încearcă din nou.", response.status);
  }
  if (response.status === 204) return null;
  try { return await response.json(); }
  catch { throw new ProjectApiError("Serverul a trimis un răspuns invalid. Verifică lista proiectelor înainte de a reîncerca salvarea.", 500); }
}

export async function projectCapabilities(): Promise<ProjectCapabilities> {
  try {
    const value = await projectRequest("project-capabilities") as ProjectCapabilities;
    if (typeof value?.enabled === "boolean" && (value.reason === null || typeof value.reason === "string")) return {
      enabled: value.enabled, reason: value.enabled ? null : value.reason || "Salvarea este disponibilă numai în modul de dezvoltare locală.",
    };
  } catch { /* Old public deployments fail closed too. */ }
  return {enabled: false, reason: "Salvarea locală nu este disponibilă. Verifică backendul și modul de dezvoltare locală."};
}

export async function getProject(id: string): Promise<FurnitureProject> {
  if (!projectUuid.test(id)) throw new ProjectApiError("Identificatorul proiectului este invalid.", 404);
  const value = await projectRequest(`projects/${id}`);
  if (!isProject(value) || value.id !== id) throw new ProjectApiError("Proiectul primit este invalid sau nu poate fi citit în această versiune.", 422);
  return value;
}

export function restorePricing(project: FurnitureProject): PricingDraft {
  const draft = initialPricing();
  for (const entry of project.manual_price_catalog) draft[entry.item_code] = entry.unit_price_ron;
  return {...draft, ...project.waste_allowances, labor: project.labor_cost, markup: project.markup_percentage};
}

export function invalidPricing(draft: PricingDraft): boolean {
  return Object.entries(draft).some(([key, value]) => {
    const isPrice = priceItems.some(([code]) => code === key);
    return isPrice && !value.trim() ? false : !!pricingError(value, ["pal", "hdf", "abs", "markup"].includes(key));
  });
}

export function pricingFingerprint(draft: PricingDraft): string {
  return JSON.stringify(Object.keys(draft).sort().map(key => {
    const value = draft[key];
    if (!/^\d+(?:[.,]\d+)?$/.test(value)) return [key, value];
    const [whole, fraction = ""] = value.replace(",", ".").split(".");
    const significant = fraction.replace(/0+$/, "");
    return [key, `${whole.replace(/^0+(?=\d)/, "")}${significant ? `.${significant}` : ""}`];
  }));
}

export function projectPayload(configuration: WardrobeConfiguration, pricing: PricingDraft,
  metadata: {name: string; description: string; status: "draft" | "completed"}, saved: FurnitureProject | null): ProjectInput {
  const prices = pricingPayload(configuration, pricing);
  return {
    domain: "furniture", name: metadata.name.trim(), description: metadata.description.trim() || null, status: metadata.status,
    confirmed_configuration: configuration,
    manual_price_catalog: prices.price_catalog.map(entry => {
      const original = saved?.manual_price_catalog.find(old => old.item_code === entry.item_code && old.unit_price_ron === entry.unit_price_ron);
      return original || entry;
    }),
    waste_allowances: prices.waste_allowances, labor_cost: prices.labor_cost_ron, markup_percentage: prices.markup_percent,
    schema_version: saved?.schema_version || 1,
    construction_profile_id: saved?.construction_profile_id || "forma-wardrobe-poc-v1",
    calculation_version: saved?.calculation_version || "wardrobe-v1",
  };
}

export async function saveProject(payload: ProjectInput, saved: FurnitureProject | null): Promise<FurnitureProject> {
  let body: object = payload;
  if (saved) {
    const {name, description, status, confirmed_configuration, manual_price_catalog, waste_allowances, labor_cost, markup_percentage} = payload;
    body = {name, description, status, confirmed_configuration, manual_price_catalog, waste_allowances, labor_cost, markup_percentage, expected_revision: saved.revision};
  }
  const value = await projectRequest(saved ? `projects/${saved.id}` : "projects", {method: saved ? "PATCH" : "POST", body: JSON.stringify(body)});
  if (!isProject(value) || !value.compatible || (saved && value.id !== saved.id)) throw new ProjectApiError("Serverul nu a confirmat un proiect valid. Verifică lista proiectelor înainte de a reîncerca salvarea.", 500);
  return value;
}
