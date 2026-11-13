import { assertNoPendingRestore } from "../storage/restore-transaction";
import { onlyKeys, type Supplier } from "../catalog/catalog-model";
import { validateManufacturingProfile, validateManufacturingSnapshot, incompleteProfile, dimensionalProfileId, dimensionalCalculationVersion,
  type ManufacturingProfile, type ManufacturingSnapshot } from "./manufacturing-model";

export const manufacturingStorageKey = "forma:manufacturing-profiles:furniture:v1";
export const manufacturingLock = "forma:manufacturing-profile-writes:furniture:v1";
export type ManufacturingStore = {schema_version: 1; domain_id: "furniture"; revision: number; profiles: ManufacturingProfile[]};
export const emptyManufacturingStore = (): ManufacturingStore => ({schema_version: 1, domain_id: "furniture", revision: 0, profiles: []});
export function validateManufacturingStore(value: unknown): ManufacturingStore {
  if (!onlyKeys(value, ["schema_version", "domain_id", "revision", "profiles"])) throw new Error("Profilurile de prelucrare nu pot fi citite. Datele nu au fost șterse.");
  const store = value as ManufacturingStore;
  if (store.schema_version !== 1 || store.domain_id !== "furniture" || !Number.isSafeInteger(store.revision) || store.revision < 0 ||
    !Array.isArray(store.profiles) || store.profiles.length > 200 || new Set(store.profiles.map(p => p?.id)).size !== store.profiles.length) throw new Error("Versiunea sau lista profilurilor este neacceptată (maximum 200).");
  store.profiles.forEach(validateManufacturingProfile);
  return structuredClone(store);
}
export function loadManufacturingProfiles(): ManufacturingStore {
  try {
    const source = window.localStorage; assertNoPendingRestore(source);
    const raw = source.getItem(manufacturingStorageKey);
    return raw === null ? emptyManufacturingStore() : validateManufacturingStore(JSON.parse(raw));
  } catch {throw new Error("Profilurile locale nu pot fi citite sau există o restaurare întreruptă. Deschide Backup și restaurare; datele au fost păstrate.");}
}

export async function saveManufacturingProfile(input: ManufacturingProfile, revision: number, action: "save" | "validate" | "archive" = "save") {
  const mutate = async () => {
    const store = loadManufacturingProfiles();
    if (store.revision !== revision) throw new Error("Profilurile au fost modificate în altă filă. Reîncarcă înainte de salvare; formularul rămâne disponibil.");
    const existing = store.profiles.find(p => p.id === input.id);
    if (existing && existing.revision !== input.revision) throw new Error("Revizia profilului s-a schimbat. Reîncarcă lista.");
    const now = new Date(Math.max(Date.now(), existing ? Date.parse(existing.updated_at) + 1 : 0)).toISOString();
    const status = action === "validate" ? "validated" : action === "archive" ? "archived" : "draft";
    const next = validateManufacturingProfile({...input, status, revision: existing ? existing.revision + 1 : 1, created_at: existing?.created_at || now, updated_at: now});
    if (action === "validate" && incompleteProfile(next).length) throw new Error("Completează setările înainte de validare.");
    const updated = validateManufacturingStore({...store, revision: store.revision + 1, profiles: [...store.profiles.filter(p => p.id !== next.id), next]});
    try {window.localStorage.setItem(manufacturingStorageKey, JSON.stringify(updated));}
    catch {throw new Error("Profilul nu a fost salvat. Spațiul browserului este plin sau blocat; datele anterioare sunt păstrate.");}
    return updated;
  };
  return typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(manufacturingLock, mutate) : mutate();
}

export function supplierAssociation(profile: ManufacturingProfile, suppliers: Supplier[]) {
  if (!profile.supplier_id) return {status: "standalone" as const, name: null, warning: null};
  const supplier = suppliers.find(s => s.id === profile.supplier_id);
  if (!supplier) return {status: "missing" as const, name: null, warning: "Furnizorul asociat nu mai este disponibil. Referința este păstrată; nu realocăm profilul."};
  if (supplier.status === "archived") return {status: "archived" as const, name: supplier.name, warning: "Furnizorul asociat este arhivat. Profilul și prețurile istorice sunt păstrate."};
  return {status: "active" as const, name: supplier.name, warning: null};
}

export function snapshotManufacturingProfile(profile: ManufacturingProfile, suppliers: Supplier[]): ManufacturingSnapshot {
  if (profile.status === "archived") throw new Error("Un profil arhivat nu poate fi selectat pentru un proiect nou.");
  const association = supplierAssociation(profile, suppliers);
  return validateManufacturingSnapshot({schema_version: 1, dimensional_profile_id: dimensionalProfileId, calculation_version: dimensionalCalculationVersion,
    geometry_basis: "forma-wardrobe-poc-v1", selected_at: new Date().toISOString(), approval_status: profile.status,
    supplier_name_at_selection: association.name, supplier_status_at_selection: association.status, profile: structuredClone(profile)});
}
