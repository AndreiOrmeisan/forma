export type BandingType = "none" | "abs_0_4" | "abs_2";
export type EdgeName = "length_start" | "length_end" | "width_start" | "width_end";
export type PanelEdges = Record<EdgeName, BandingType>;

export type EdgeDetail = {
  edge: EdgeName;
  name: string;
  banding_type: BandingType;
  length_mm: string;
  net_length_per_piece_m: string;
  total_net_length_m: string;
};

export type PanelEdgeDetails = {
  panel_id: string;
  name: string;
  quantity: number;
  edges: EdgeDetail[];
  net_length_per_piece_m: string;
  total_net_length_m: string;
};

export type EdgeBandingResult = {
  panel_edges: PanelEdgeDetails[];
  totals_by_type: { abs_0_4_total_m: string; abs_2_total_m: string };
  total_net_length_m: string;
  procurement_allowance_m: string;
  edge_convention: string;
  assumptions: string[];
};

export type HardwareItem = {
  id: "hinges" | "shelf_supports" | "handles" | "cabinet_connectors" | "hdf_fasteners";
  name: string;
  quantity: number;
  unit: "buc.";
  calculation_rule: string;
  is_estimate: boolean;
};

export type HardwareResult = {
  items: HardwareItem[];
  total_item_count: number;
  assumptions: string[];
};

const edgeNames: EdgeName[] = ["length_start", "length_end", "width_start", "width_end"];
const hardwareIds: HardwareItem["id"][] = ["hinges", "shelf_supports", "handles", "cabinet_connectors", "hdf_fasteners"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isDecimalString(value: unknown): value is string {
  return typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
}

export function isPositiveDecimal(value: unknown): value is string {
  return isDecimalString(value) && /[1-9]/.test(value);
}

function isBandingType(value: unknown): value is BandingType {
  return value === "none" || value === "abs_0_4" || value === "abs_2";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === "string");
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isPanelEdges(value: unknown): value is PanelEdges {
  return isRecord(value) && Object.keys(value).length === 4 && edgeNames.every(edge => isBandingType(value[edge]));
}

function isEdgeDetail(value: unknown): value is EdgeDetail {
  return isRecord(value) && edgeNames.includes(value.edge as EdgeName) && typeof value.name === "string" &&
    isBandingType(value.banding_type) && isPositiveDecimal(value.length_mm) &&
    isDecimalString(value.net_length_per_piece_m) && isDecimalString(value.total_net_length_m);
}

function isPanelEdgeDetails(value: unknown): value is PanelEdgeDetails {
  return isRecord(value) && typeof value.panel_id === "string" && typeof value.name === "string" &&
    isCount(value.quantity) && value.quantity > 0 &&
    Array.isArray(value.edges) && value.edges.length === 4 && value.edges.every(isEdgeDetail) &&
    new Set(value.edges.map(edge => edge.edge)).size === 4 &&
    isDecimalString(value.net_length_per_piece_m) && isDecimalString(value.total_net_length_m);
}

export function isEdgeBandingResult(value: unknown): value is EdgeBandingResult {
  return isRecord(value) && isRecord(value.totals_by_type) &&
    isDecimalString(value.totals_by_type.abs_0_4_total_m) && isDecimalString(value.totals_by_type.abs_2_total_m) &&
    isDecimalString(value.total_net_length_m) && isDecimalString(value.procurement_allowance_m) &&
    typeof value.edge_convention === "string" && isStringArray(value.assumptions) &&
    Array.isArray(value.panel_edges) && value.panel_edges.every(isPanelEdgeDetails) &&
    new Set(value.panel_edges.map(panel => panel.panel_id)).size === value.panel_edges.length;
}

function isHardwareItem(value: unknown): value is HardwareItem {
  return isRecord(value) && hardwareIds.includes(value.id as HardwareItem["id"]) &&
    typeof value.name === "string" && isCount(value.quantity) && value.unit === "buc." &&
    typeof value.calculation_rule === "string" && typeof value.is_estimate === "boolean";
}

export function isHardwareResult(value: unknown): value is HardwareResult {
  return isRecord(value) && isCount(value.total_item_count) && isStringArray(value.assumptions) &&
    Array.isArray(value.items) && value.items.length === hardwareIds.length && value.items.every(isHardwareItem) &&
    new Set(value.items.map(item => item.id)).size === hardwareIds.length;
}
