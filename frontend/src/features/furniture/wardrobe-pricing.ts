import { isWardrobeConfiguration, type WardrobeConfiguration } from "./wardrobe-configuration";

export const priceItems = [
  ["pal_18", "PAL 18 mm", "m²"], ["hdf_3", "HDF 3 mm", "m²"],
  ["abs_2", "ABS 2 mm", "m"], ["abs_0_4", "ABS 0,4 mm", "m"],
  ["hinges", "Balamale", "buc."], ["shelf_supports", "Suporți polițe", "buc."],
  ["handles", "Mânere", "buc."], ["cabinet_connectors", "Conectori carcasă", "buc."],
  ["hdf_fasteners", "Elemente fixare HDF", "buc."],
] as const;
export type PricingDraft = Record<string, string>;
export const initialPricing = (): PricingDraft => ({
  ...Object.fromEntries(priceItems.map(([code]) => [code, ""])),
  pal: "0", hdf: "0", abs: "0", labor: "0", markup: "0",
});
export function pricingError(value: string, percentage = false): string | null {
  if (!value.trim()) return "Completează valoarea.";
  if (!/^\d+(?:[.,]\d{1,6})?$/.test(value) || !Number.isFinite(Number(value.replace(",", ".")))) return "Introdu un număr pozitiv, cu maximum 6 zecimale.";
  if (Number(value.replace(",", ".")) > (percentage ? 100 : 1000000000)) return percentage ? "Alege între 0 și 100%." : "Valoarea maximă este 1.000.000.000 RON.";
  return null;
}
export function pricingPayload(configuration: WardrobeConfiguration, draft: PricingDraft) {
  const decimal = (key: string) => draft[key].replace(",", ".");
  return {
    configuration, confirmed: true,
    price_catalog: priceItems.filter(([code]) => draft[code].trim() !== "").map(([code, name, unit]) => ({
      item_code: code, item_name: name, unit, unit_price_ron: decimal(code), currency: "RON",
      source_type: "manual", source_name: "Introducere manuală", updated_at: new Date().toISOString(),
    })),
    waste_allowances: { pal: decimal("pal"), hdf: decimal("hdf"), abs: decimal("abs") },
    labor_cost_ron: decimal("labor"), markup_percent: decimal("markup"),
  };
}
export type EstimateLine = {item_code: string; name: string; base_quantity: string; billable_quantity: string; unit: string; unit_price_ron: string | null; line_total_ron: string | null; source_type: string | null};
export type Estimate = {
  configuration: WardrobeConfiguration; material_lines: EstimateLine[]; hardware_lines: EstimateLine[];
  labor_cost_ron: string; material_subtotal_ron: string | null; hardware_subtotal_ron: string | null;
  production_cost_ron: string | null; markup_percent: string; markup_amount_ron: string | null;
  selling_price_before_tax_ron: string | null; is_complete: boolean; warnings: string[]; missing_item_codes: string[];
};
export function isEstimate(value: unknown): value is Estimate {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const decimal = (v: unknown) => typeof v === "string" && /^\d+(\.\d+)?$/.test(v);
  const optional = (v: unknown) => v === null || decimal(v);
  return isWardrobeConfiguration(data.configuration) && typeof data.is_complete === "boolean" && decimal(data.labor_cost_ron) && decimal(data.markup_percent) &&
    [data.material_subtotal_ron, data.hardware_subtotal_ron, data.production_cost_ron, data.markup_amount_ron, data.selling_price_before_tax_ron].every(optional) &&
    (!data.is_complete || [data.material_subtotal_ron, data.hardware_subtotal_ron, data.production_cost_ron, data.markup_amount_ron, data.selling_price_before_tax_ron].every(decimal)) &&
    [data.warnings, data.missing_item_codes].every(v => Array.isArray(v) && v.every(s => typeof s === "string")) &&
    [data.material_lines, data.hardware_lines].every(lines => Array.isArray(lines) && lines.every(line =>
      line && typeof line.item_code === "string" && typeof line.name === "string" && typeof line.unit === "string" &&
      decimal(line.base_quantity) && decimal(line.billable_quantity) && optional(line.unit_price_ron) && optional(line.line_total_ron)));
}

// Display rounding only; authoritative calculations remain in Python Decimal.
export function formatMoney(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2)) + (Number(fraction[2] || "0") >= 5 ? BigInt(1) : BigInt(0));
  return `${cents / BigInt(100)},${String(cents % BigInt(100)).padStart(2, "0")} RON`;
}
