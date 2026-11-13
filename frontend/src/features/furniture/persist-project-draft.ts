import { invalidPricing, projectCapabilities, projectPayload, saveProject } from "./project-api";
import type { ProjectWork } from "./unsaved-project";

export async function persistProjectDraft(work: ProjectWork) {
  if (!work.confirmed) throw new Error("Confirmă configurația înainte de salvare.");
  if (!work.projectName.trim() || work.projectName.trim().length > 120) {
    throw new Error("Dă un nume proiectului, de maximum 120 de caractere.");
  }
  if (invalidPricing(work.pricing)) throw new Error("Corectează prețurile înainte de salvare.");
  const capability = await projectCapabilities();
  if (!capability.enabled) throw new Error(capability.reason || "Salvarea nu este disponibilă momentan.");
  const payload = projectPayload(work.confirmed, work.pricing, {
    name: work.projectName,
    description: work.projectDescription,
    status: work.projectStatus,
  }, work.savedProject, work.priceSnapshots);
  return saveProject(payload, work.savedProject);
}
