import { isWardrobeConfiguration, type WardrobeConfiguration } from "./wardrobe-configuration";
import type { pricingPayload } from "./wardrobe-pricing";
import { priceItems } from "./wardrobe-pricing";
import { isPriceSnapshots, snapshotsMatchPrices, type ProjectPriceSnapshot } from "./project-price-snapshot";
import { isManufacturingSnapshot, type ManufacturingSnapshot } from "../manufacturing/manufacturing-model";

export type CatalogEntry = ReturnType<typeof pricingPayload>["price_catalog"][number];
export type ProjectInput = {
  domain: "furniture"; name: string; description: string | null; status: "draft" | "completed";
  confirmed_configuration: WardrobeConfiguration; manual_price_catalog: CatalogEntry[];
  waste_allowances: {pal: string; hdf: string; abs: string}; labor_cost: string; markup_percentage: string;
  schema_version: number; construction_profile_id: string; calculation_version: string;
  price_snapshots?: ProjectPriceSnapshot[];
  manufacturing_snapshot?: ManufacturingSnapshot | null;
};
export type FurnitureProject = ProjectInput & {
  id: string; created_at: string; updated_at: string; revision: number;
  compatible: boolean; deviz_complete: boolean | null; warnings: string[];
};
export type ProjectPage = {items: FurnitureProject[]; total: number; limit: number; offset: number; warnings?: string[]};
export type ProjectCapabilities = {enabled: boolean; reason: string | null; requires_auth?: boolean; storage?: "cloud" | "local" | "browser" | "disabled"};
export const projectUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    (v.price_snapshots === undefined || isPriceSnapshots(v.price_snapshots)) &&
    (v.manufacturing_snapshot === undefined || v.manufacturing_snapshot === null || isManufacturingSnapshot(v.manufacturing_snapshot)) &&
    Array.isArray(v.manual_price_catalog) && v.manual_price_catalog.every(entry => entry &&
      priceItems.some(([code, , unit]) => code === entry.item_code && unit === entry.unit) &&
      typeof entry.item_name === "string" && decimal(entry.unit_price_ron) && entry.currency === "RON" &&
      entry.source_type === "manual" && typeof entry.source_name === "string" &&
      typeof entry.updated_at === "string" && Number.isFinite(Date.parse(entry.updated_at))) &&
    (!v.price_snapshots || snapshotsMatchPrices(v.price_snapshots,v.manual_price_catalog));
}
