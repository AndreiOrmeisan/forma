export const wardrobeRules = {
  width_mm: { label: "Lățime", min: 300, max: 2400, unit: "mm" },
  height_mm: { label: "Înălțime", min: 400, max: 3000, unit: "mm" },
  depth_mm: { label: "Adâncime", min: 200, max: 1000, unit: "mm" },
  doors_count: { label: "Număr de uși", min: 1, max: 2, unit: "" },
  shelves_count: { label: "Număr de polițe", min: 0, max: 10, unit: "" },
} as const;

export type WardrobeField = keyof typeof wardrobeRules;
export const wardrobeFields = Object.keys(wardrobeRules) as WardrobeField[];
export type WardrobeDraft = Record<WardrobeField, string>;
export type WardrobeConfiguration = Readonly<Record<WardrobeField, number> & { furniture_type: "wardrobe" }>;
export type MockInterpretation = WardrobeConfiguration & Readonly<{
  is_mock: true;
  requires_confirmation: true;
  notice: string;
}>;

export function configurationToDraft(configuration: WardrobeConfiguration): WardrobeDraft {
  return {
    width_mm: String(configuration.width_mm),
    height_mm: String(configuration.height_mm),
    depth_mm: String(configuration.depth_mm),
    doors_count: String(configuration.doors_count),
    shelves_count: String(configuration.shelves_count),
  };
}

export function validateWardrobeDraft(draft: WardrobeDraft) {
  const errors: Partial<Record<WardrobeField, string>> = {};
  for (const field of wardrobeFields) {
    const rule = wardrobeRules[field];
    const value = Number(draft[field]);
    if (!/^\d+$/.test(draft[field]) || !Number.isSafeInteger(value) || value < rule.min || value > rule.max) {
      errors[field] = `Introdu o valoare între ${rule.min} și ${rule.max}${rule.unit ? ` ${rule.unit}` : ""}, în numere întregi.`;
    }
  }
  const configuration: WardrobeConfiguration | null = Object.keys(errors).length ? null : {
    width_mm: Number(draft.width_mm),
    height_mm: Number(draft.height_mm),
    depth_mm: Number(draft.depth_mm),
    doors_count: Number(draft.doors_count),
    shelves_count: Number(draft.shelves_count),
    furniture_type: "wardrobe",
  };
  return { errors, configuration };
}

export function isMockInterpretation(value: unknown): value is MockInterpretation {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (
    data.is_mock !== true ||
    data.requires_confirmation !== true ||
    data.furniture_type !== "wardrobe" ||
    typeof data.notice !== "string"
  ) return false;
  if (!wardrobeFields.every(field => typeof data[field] === "number" && Number.isSafeInteger(data[field]))) return false;
  return validateWardrobeDraft(configurationToDraft(data as unknown as WardrobeConfiguration)).configuration !== null;
}
