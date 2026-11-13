import { edgeLabels, type ManufacturingProfile, type ProcessingRule } from "./manufacturing-model";

export const roundingLabels = {exact: "Doar multipli exacți", half_up: "Cel mai apropiat, jumătățile în sus", ceil: "În sus", floor: "În jos"};
export function describeRule(rule: ProcessingRule | undefined): string {
  if (!rule) return "Neconfigurată";
  return rule.mode === "net" ? `Contribuție netă: ${rule.net_contribution_mm ?? "neconfigurată"} mm` :
    `Grosime aplicată ${rule.applied_thickness_mm ?? "?"} mm minus prefrezare ${rule.removal_mm ?? "?"} mm (o singură compensare)`;
}
export function profileComparison(current: ManufacturingProfile | undefined, proposed: ManufacturingProfile | undefined): string[][] {
  const rows = (profile: ManufacturingProfile | undefined): string[] => !profile ? Array(10).fill("Fără profil") : [
    profile.name, `Schema v${profile.schema_version} · revizia ${profile.revision}`,
    profile.status === "validated" ? "Setări validate, fără aprobare fizică" : profile.status === "archived" ? "Arhivat" : "Ciornă",
    ...(["abs_0_4", "abs_2"] as const).map(edge => profile.supported_edge_types.includes(edge) ? describeRule(profile.edge_processing_rules[edge]) : "Tip nesuportat"),
    profile.cutting_precision_mm === null ? "Neconfigurat" : `${profile.cutting_precision_mm} mm`,
    profile.rounding_policy === null ? "Neconfigurată" : roundingLabels[profile.rounding_policy],
    profile.dimensional_tolerance_mm === null ? "Neconfigurată" : `${profile.dimensional_tolerance_mm} mm`,
    profile.back_projection_mm === null ? "Neconfigurată" : `${profile.back_projection_mm} mm`,
    profile.front_projection_mm === null ? "Neconfigurată" : `${profile.front_projection_mm} mm`,
  ];
  const before = rows(current), after = rows(proposed);
  return ["Nume", "Versiune", "Validare setări", edgeLabels.abs_0_4, edgeLabels.abs_2, "Pas debitare", "Rotunjire", "Toleranță", "Proiecție spate", "Proiecție front"].map((label, index) => [label, before[index], after[index]]);
}
