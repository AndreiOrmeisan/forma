import { isObject, onlyKeys, uuidPattern, validDate } from "../catalog/catalog-model";

export const manufacturingRoute = "/domenii/mobilier/profiluri-prelucrare";
export const dimensionalProfileId = "forma-wardrobe-manufacturing-v1";
export const dimensionalCalculationVersion = "manufacturing-dimensions-v1";
export const edgeLabels = {abs_0_4: "ABS 0,4 mm", abs_2: "ABS 2 mm"};
export type EdgeType = keyof typeof edgeLabels;
export type ProcessingRule = {mode: "net"; net_contribution_mm: string | null} |
  {mode: "layers"; applied_thickness_mm: string | null; removal_mm: string | null};
export type ManufacturingProfile = {
  id: string; name: string; supplier_id: string | null; schema_version: 1; revision: number;
  status: "draft" | "validated" | "archived"; supported_edge_types: EdgeType[];
  edge_processing_rules: Partial<Record<EdgeType, ProcessingRule>>;
  cutting_precision_mm: string | null; rounding_policy: "half_up" | "ceil" | "floor" | "exact" | null;
  dimensional_tolerance_mm: string | null; depth_convention: "carcass_plus_projections_v1";
  back_projection_mm: string | null; front_projection_mm: string | null; notes: string; created_at: string; updated_at: string;
};
export type ManufacturingSnapshot = {
  schema_version: 1; dimensional_profile_id: typeof dimensionalProfileId; calculation_version: typeof dimensionalCalculationVersion;
  geometry_basis: "forma-wardrobe-poc-v1"; selected_at: string; approval_status: ManufacturingProfile["status"];
  supplier_name_at_selection: string | null; supplier_status_at_selection: "standalone" | "active" | "archived" | "missing";
  profile: ManufacturingProfile;
};
const profileFields = ["id", "name", "supplier_id", "schema_version", "revision", "status", "supported_edge_types", "edge_processing_rules", "cutting_precision_mm", "rounding_policy", "dimensional_tolerance_mm", "depth_convention", "back_projection_mm", "front_projection_mm", "notes", "created_at", "updated_at"];
const decimal = (value: unknown, signed = false, maximum = 20) => value === null || typeof value === "string" && value.length <= 24 &&
  (signed ? /^-?\d+(?:\.\d{1,6})?$/ : /^\d+(?:\.\d{1,6})?$/).test(value) && Math.abs(Number(value)) <= maximum;

export function incompleteProfile(profile: ManufacturingProfile): string[] {
  const issues: string[] = [];
  if (!profile.name.trim()) issues.push("Completează numele profilului.");
  for (const edge of profile.supported_edge_types) {
    const rule = profile.edge_processing_rules[edge];
    if (!rule || (rule.mode === "net" ? rule.net_contribution_mm === null : rule.applied_thickness_mm === null || rule.removal_mm === null)) issues.push(`Configurează regula pentru ${edgeLabels[edge]}; zero trebuie introdus explicit.`);
  }
  for (const [key, label] of [["cutting_precision_mm", "Precizia debitării"], ["rounding_policy", "Politica de rotunjire"],
    ["dimensional_tolerance_mm", "Toleranța dimensională"], ["back_projection_mm", "Proiecția spatelui"], ["front_projection_mm", "Proiecția frontului"]] as const) {
    if (profile[key] === null) issues.push(`${label}: neconfigurată.`);
  }
  return issues;
}

export function validateManufacturingProfile(value: unknown): ManufacturingProfile {
  if (!onlyKeys(value, profileFields) || !isObject(value)) throw new Error("Structura profilului de prelucrare este invalidă.");
  const p = value as ManufacturingProfile;
  if (!uuidPattern.test(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 120 ||
    (p.supplier_id !== null && !uuidPattern.test(p.supplier_id)) || p.schema_version !== 1 || !Number.isSafeInteger(p.revision) || p.revision < 1 ||
    !["draft", "validated", "archived"].includes(p.status) || !validDate(p.created_at) || !validDate(p.updated_at) || Date.parse(p.updated_at) < Date.parse(p.created_at) ||
    typeof p.notes !== "string" || p.notes.length > 2000 || p.depth_convention !== "carcass_plus_projections_v1") throw new Error("Identitatea, versiunea sau metadatele profilului sunt invalide.");
  if (!Array.isArray(p.supported_edge_types) || p.supported_edge_types.some(edge => !Object.keys(edgeLabels).includes(edge)) || new Set(p.supported_edge_types).size !== p.supported_edge_types.length ||
    !onlyKeys(p.edge_processing_rules, p.supported_edge_types)) throw new Error("Tipurile de cant și regulile nu corespund.");
  for (const rule of Object.values(p.edge_processing_rules)) {
    if (!rule || (rule.mode === "net" ? !onlyKeys(rule, ["mode", "net_contribution_mm"]) || !decimal(rule.net_contribution_mm, true) :
      rule.mode !== "layers" || !onlyKeys(rule, ["mode", "applied_thickness_mm", "removal_mm"]) || !decimal(rule.applied_thickness_mm) || !decimal(rule.removal_mm))) throw new Error("Regulă de cant invalidă. Alege contribuție netă SAU grosime aplicată minus prefrezare, cu maximum 6 zecimale și 20 mm în valoare absolută.");
  }
  if (![p.cutting_precision_mm, p.dimensional_tolerance_mm].every(value => decimal(value)) || ![p.back_projection_mm, p.front_projection_mm].every(value => decimal(value, false, 1000)) ||
    (p.cutting_precision_mm !== null && Number(p.cutting_precision_mm) <= 0) ||
    (p.rounding_policy !== null && !["half_up", "ceil", "floor", "exact"].includes(p.rounding_policy))) throw new Error("Verifică precizia pozitivă și toleranța (maximum 20 mm), proiecțiile (0–1000 mm) și cele maximum 6 zecimale. Câmpul gol înseamnă neconfigurat.");
  if (p.status === "validated" && incompleteProfile(p).length) throw new Error("Un profil incomplet nu poate fi validat.");
  return structuredClone(p);
}

export function validateManufacturingSnapshot(value: unknown): ManufacturingSnapshot {
  if (!onlyKeys(value, ["schema_version", "dimensional_profile_id", "calculation_version", "geometry_basis", "selected_at", "approval_status", "supplier_name_at_selection", "supplier_status_at_selection", "profile"]) || !isObject(value)) throw new Error("Copia profilului de prelucrare este invalidă.");
  const s = value as ManufacturingSnapshot;
  const p = validateManufacturingProfile(s.profile);
  if (s.schema_version !== 1 || s.dimensional_profile_id !== dimensionalProfileId || s.calculation_version !== dimensionalCalculationVersion ||
    s.geometry_basis !== "forma-wardrobe-poc-v1" || !validDate(s.selected_at) || s.approval_status !== p.status ||
    (s.supplier_name_at_selection !== null && (typeof s.supplier_name_at_selection !== "string" || s.supplier_name_at_selection.length > 120)) ||
    !["standalone", "active", "archived", "missing"].includes(s.supplier_status_at_selection) ||
    (p.supplier_id === null) !== (s.supplier_status_at_selection === "standalone")) throw new Error("Versiunea sau aprobarea copiei de prelucrare este incompatibilă.");
  return structuredClone(s);
}

export function blankManufacturingProfile(): ManufacturingProfile {
  const now = new Date().toISOString();
  return {id: crypto.randomUUID(), name: "", supplier_id: null, schema_version: 1, revision: 1, status: "draft", supported_edge_types: [],
    edge_processing_rules: {}, cutting_precision_mm: null, rounding_policy: null, dimensional_tolerance_mm: null,
    depth_convention: "carcass_plus_projections_v1", back_projection_mm: null, front_projection_mm: null, notes: "", created_at: now, updated_at: now};
}

export function isManufacturingSnapshot(value: unknown): value is ManufacturingSnapshot {
  try {validateManufacturingSnapshot(value); return true;} catch {return false;}
}
