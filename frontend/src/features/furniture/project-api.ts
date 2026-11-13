import type { WardrobeConfiguration } from "./wardrobe-configuration";
import { initialPricing, priceItems, pricingError, pricingPayload, type PricingDraft } from "./wardrobe-pricing";
import { furnitureRoutes } from "../../config/domains";
import { projectAccessToken } from "../auth/supabase-client";
import { getProjectStorageMode } from "../../config/project-storage";
import { browserProjectCapabilities, browserProjectRequest } from "./browser-project-store";

import { isProject, projectUuid, type FurnitureProject, type ProjectInput, type ProjectCapabilities } from "./project-contract";
export { isProject, projectUuid } from "./project-contract";
export type { CatalogEntry, ProjectInput, FurnitureProject, ProjectPage, ProjectCapabilities } from "./project-contract";
export const projectHref = (id: string) => `${furnitureRoutes.projects}/deschide?id=${encodeURIComponent(id)}`;

export class ProjectApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function projectRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  if (getProjectStorageMode() === "browser") {
    if (path === "project-capabilities") return browserProjectCapabilities();
    if (/^projects(?:[/?]|$)/.test(path)) return browserProjectRequest(path,options);
  }
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
  let response: Response;
  const token = await projectAccessToken();
  try {
    response = await fetch(`${base}/api/v1/furniture/${path}`, {
      ...options, cache: "no-store", signal: options.signal || AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...(token ? {Authorization:`Bearer ${token}`} : {}), ...options.headers },
    });
  } catch {
    throw new ProjectApiError("Nu putem contacta serviciul de proiecte. Verifică conexiunea și încearcă din nou. Datele introduse nu au fost șterse.", 0);
  }
  if (!response.ok) {
    const messages: Record<number, string> = {
      403: "Nu ai acces la această stocare. Verifică autentificarea sau modul local.",
      401: "Autentifică-te pentru a accesa proiectele tale. Sesiunea poate fi expirată.",
      404: "Proiectul nu există, a fost șters sau nu ai acces la el.",
      409: "Proiectul a fost modificat în altă sesiune sau versiunea este incompatibilă. Redeschide-l înainte de a salva; păstrează separat modificările tale.",
      422: "Datele proiectului sunt invalide. Verifică numele, configurația și prețurile.",
    };
    throw new ProjectApiError(messages[response.status] || "Serviciul de proiecte nu este disponibil. Încearcă din nou.", response.status);
  }
  if (response.status === 204) return null;
  try { return await response.json(); }
  catch { throw new ProjectApiError("Serverul a trimis un răspuns invalid. Verifică lista proiectelor înainte de a reîncerca salvarea.", 500); }
}

export async function projectCapabilities(): Promise<ProjectCapabilities> {
  if (getProjectStorageMode() === "browser") return browserProjectCapabilities();
  try {
    const value = await projectRequest("project-capabilities") as ProjectCapabilities;
    if (typeof value?.enabled === "boolean" && (value.reason === null || typeof value.reason === "string")) return {
      enabled: value.enabled, requires_auth:value.requires_auth === true, storage:value.storage,
      reason: value.enabled ? null : value.reason || "Salvarea online nu este încă activată.",
    };
  } catch { /* Old public deployments fail closed too. */ }
  return {enabled: false, reason: "Salvarea nu este disponibilă momentan. Verifică serviciul de proiecte și configurarea salvării online."};
}

export async function getProject(id: string): Promise<FurnitureProject> {
  if (!projectUuid.test(id)) throw new ProjectApiError("Identificatorul proiectului este invalid.", 404);
  const normalized = id.toLowerCase();
  const value = await projectRequest(`projects/${normalized}`);
  if (!isProject(value) || value.id !== normalized) throw new ProjectApiError("Proiectul primit este invalid sau nu poate fi citit în această versiune.", 422);
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
