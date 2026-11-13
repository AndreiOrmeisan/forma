import { browserProjectPrefix, decodeBrowserProject, exportBrowserProjects, projectRestoreValue, validateProjectBackup, type BrowserProjectEnvelope } from "../furniture/browser-project-store";
import { catalogStorageKey, legacyCatalogStorageKey, localCatalogRepository, parseCatalogBackup, previewImport, exportCatalog } from "../catalog/catalog-repository";
import { emptyCatalog, isObject, onlyKeys, validDate, validateCatalog, type CatalogState } from "../catalog/catalog-model";
import { companyProfileKey, decodeCompanyProfile, loadCompanyProfile, validateCompanyProfile, type CompanyProfile } from "../company/company-profile";
import { fullBackupMaxBytes, requireByteLimit } from "./size-policy";
import { assertNoPendingRestore, commitRestore, restoreJournalKey, withLocalRestoreLocks, type LocalSection, type StorageChange } from "./restore-transaction";

export type FormaBackup = {format: "forma-backup"; schema_version: 1; created_at: string; application: "FORMA";
  sections: {projects?: BrowserProjectEnvelope[]; catalogs?: {domain_id: "furniture"; catalog: CatalogState}[]; company_profile?: CompanyProfile | null}};
export type LocalSnapshot = Record<string, string>;
export type RestoreMode = "merge" | "replace";
export type RestoreSelection = Record<LocalSection, boolean>;
const sectionNames: LocalSection[] = ["projects", "catalogs", "company_profile"];

export function localStorageSource(): Storage {
  try {const source = window.localStorage; source.getItem(restoreJournalKey); return source;}
  catch {throw new Error("Browserul nu permite accesul la datele locale. Folosește o fereastră normală și permite datele site-ului.");}
}
function sectionFor(key: string): LocalSection | null {
  if (key.startsWith(browserProjectPrefix)) return "projects";
  if ([catalogStorageKey, legacyCatalogStorageKey].includes(key)) return "catalogs";
  if (key === companyProfileKey) return "company_profile";
  return null;
}
export function captureLocalData(source = localStorageSource()): LocalSnapshot {
  const data: LocalSnapshot = {};
  const keys = Array.from({length: source.length}, (_, index) => source.key(index)).filter((key): key is string => !!key && (sectionFor(key) !== null || key === restoreJournalKey)).sort();
  for (const key of keys) {const raw = source.getItem(key); if (raw !== null) data[key] = raw;}
  return data;
}
export function inspectLocalData(data: LocalSnapshot) {
  return Object.entries(data).map(([key, raw]) => {
    const section = sectionFor(key);
    let error: string | null = null;
    try {
      if (section === "projects") decodeBrowserProject(raw, key.slice(browserProjectPrefix.length));
      else if (section === "catalogs") validateCatalog(JSON.parse(raw));
      else if (section === "company_profile") decodeCompanyProfile(raw);
      else throw new Error("Restaurare întreruptă sau în curs. Revino la datele anterioare înainte de alte modificări.");
    } catch (reason) {error = reason instanceof Error ? reason.message : "Date incompatibile.";}
    return {key, section, error};
  });
}

export function validateFormaBackup(value: unknown): FormaBackup {
  if (!onlyKeys(value, ["format", "schema_version", "created_at", "application", "sections"]) || !isObject(value) ||
    value.format !== "forma-backup" || value.schema_version !== 1 || value.application !== "FORMA" || !validDate(value.created_at) ||
    !onlyKeys(value.sections, sectionNames) || !isObject(value.sections)) throw new Error("Backup FORMA invalid sau versiune neacceptată. Fișierul original nu a fost modificat.");
  const sections = value.sections;
  if (!Object.keys(sections).length) throw new Error("Backupul nu conține secțiuni.");
  if ("projects" in sections) {
    if (!Array.isArray(sections.projects) || sections.projects.length > 10000) throw new Error("Lista de proiecte este invalidă (maximum 10000).");
    const ids = new Set<string>();
    for (const project of sections.projects) {
      let valid: BrowserProjectEnvelope;
      try {valid = validateProjectBackup(project);}
      catch {throw new Error("Un proiect din backup este invalid sau folosește o versiune de stocare neacceptată. Nu am modificat datele locale.");}
      if (ids.has(valid.project.id.toLowerCase())) throw new Error("Backupul conține proiecte cu ID duplicat.");
      ids.add(valid.project.id.toLowerCase());
    }
  }
  if ("catalogs" in sections) {
    if (!Array.isArray(sections.catalogs) || sections.catalogs.length > 1) throw new Error("Lista de cataloage este invalidă.");
    for (const entry of sections.catalogs) {
      if (!onlyKeys(entry, ["domain_id", "catalog"]) || entry.domain_id !== "furniture") throw new Error("Domeniul catalogului nu este suportat. Nu combinăm domenii diferite.");
      exportCatalog(validateCatalog(entry.catalog), "furniture");
    }
  }
  if ("company_profile" in sections && sections.company_profile !== null) validateCompanyProfile(sections.company_profile);
  requireByteLimit(JSON.stringify(value), fullBackupMaxBytes, "Backupul");
  return structuredClone(value) as FormaBackup;
}

export function parseFormaBackup(text: string): FormaBackup {
  requireByteLimit(text, fullBackupMaxBytes);
  let value: unknown;
  try {value = JSON.parse(text);} catch {throw new Error("Fișierul nu conține JSON valid.");}
  if (isObject(value) && value.format === "forma-supplier-catalog") {
    const legacy = parseCatalogBackup(text);
    return validateFormaBackup({format: "forma-backup", schema_version: 1, application: "FORMA", created_at: legacy.exported_at,
      sections: {catalogs: [{domain_id: "furniture", catalog: {schema_version: 1, revision: 0, suppliers: legacy.suppliers, items: legacy.items}}]}});
  }
  return validateFormaBackup(value);
}

export async function exportFormaBackup(): Promise<string> {
  return withLocalRestoreLocks(async () => {
    const source = localStorageSource(); assertNoPendingRestore(source);
    const before = captureLocalData(source), invalid = inspectLocalData(before).filter(record => record.error);
    if (invalid.length) throw new Error(`Backupul complet este blocat: ${invalid.map(record => record.key).join(", ")}. Descarcă separat datele brute pentru recuperare.`);
    const projects = exportBrowserProjects();
    const catalog = await localCatalogRepository.load();
    const company_profile = loadCompanyProfile();
    if (JSON.stringify(before) !== JSON.stringify(captureLocalData(source))) throw new Error("Datele s-au schimbat în timpul exportului. Încearcă din nou.");
    const backup = validateFormaBackup({format: "forma-backup", schema_version: 1, created_at: new Date().toISOString(), application: "FORMA",
      sections: {projects, catalogs: [{domain_id: "furniture", catalog}], company_profile}});
    const text = JSON.stringify(backup);
    parseFormaBackup(text); // Export/import contract checked before offering the file.
    return text;
  });
}

export type RestorePlan = {backup: FormaBackup; baseline: LocalSnapshot; selection: RestoreSelection; mode: RestoreMode;
  changes: StorageChange[]; conflicts: string[]; affected: Record<LocalSection, number | null>; warnings: string[]; requiresConfirmation: boolean; revisionFloor: number};

export function buildRestorePlan(input: FormaBackup, baseline: LocalSnapshot, selection: RestoreSelection, mode: RestoreMode, revisionFloor = Date.now()): RestorePlan {
  const backup = validateFormaBackup(input);
  if (!Number.isSafeInteger(revisionFloor) || revisionFloor < 0) throw new Error("Marcajul restaurării este invalid.");
  if (!["merge", "replace"].includes(mode) || !sectionNames.some(section => selection[section])) throw new Error("Selectează cel puțin o secțiune și un mod valid.");
  if (baseline[restoreJournalKey]) throw new Error("Recuperează mai întâi restaurarea întreruptă.");
  const changes: StorageChange[] = [], conflicts: string[] = [], warnings: string[] = [];
  const affected: Record<LocalSection, number | null> = {projects: 0, catalogs: 0, company_profile: 0};
  const add = (section: LocalSection, key: string, after: string | null) => {
    const before = baseline[key] ?? null;
    if (before !== after) changes.push({section, key, before, after});
  };
  if (selection.projects && backup.sections.projects) {
    const incoming = backup.sections.projects;
    const ids = new Set(incoming.map(record => browserProjectPrefix + record.project.id));
    for (const record of incoming) {
      const key = browserProjectPrefix + record.project.id;
      if (key in baseline && mode === "merge") {conflicts.push(`Proiect: ${record.project.name} (${record.project.id})`); continue;}
      add("projects", key, projectRestoreValue(record, baseline[key] ?? null, revisionFloor));
    }
    if (mode === "replace") for (const key of Object.keys(baseline).filter(key => key.startsWith(browserProjectPrefix))) {
      if (!ids.has(key)) add("projects", key, null);
    }
    affected.projects = Object.keys(baseline).filter(key => key.startsWith(browserProjectPrefix)).length;
  }
  if (selection.catalogs && backup.sections.catalogs) {
    const incoming = backup.sections.catalogs[0]?.catalog ?? emptyCatalog();
    const raw = baseline[catalogStorageKey] ?? baseline[legacyCatalogStorageKey];
    let current = emptyCatalog();
    if (raw) {
      try {current = validateCatalog(JSON.parse(raw));}
      catch {
        if (mode === "merge") throw new Error("Catalogul local este deteriorat. Descarcă datele brute și alege înlocuirea explicită a secțiunii.");
        affected.catalogs = null;
        warnings.push("Catalogul local este deteriorat; numărul furnizorilor și ofertelor existente nu poate fi stabilit. Descarcă datele brute înainte de înlocuire.");
      }
    }
    const preview = previewImport(current, exportCatalog(incoming), mode);
    for (const record of incoming.suppliers) if (current.suppliers.some(existing => existing.id === record.id) && mode === "merge") conflicts.push(`Furnizor: ${record.name} (${record.id})`);
    for (const record of incoming.items) if (current.items.some(existing => existing.id === record.id) && mode === "merge") conflicts.push(`Ofertă: ${record.name} (${record.id})`);
    const next = validateCatalog({...preview.next, revision: raw ? Math.max(current.revision, incoming.revision) + 1 : incoming.revision});
    const changed = JSON.stringify([current.suppliers, current.items]) !== JSON.stringify([next.suppliers, next.items]);
    if (mode === "replace" || changed) add("catalogs", catalogStorageKey, JSON.stringify(next));
    if (mode === "replace" && legacyCatalogStorageKey in baseline) add("catalogs", legacyCatalogStorageKey, null);
    if (affected.catalogs !== null) affected.catalogs = current.suppliers.length + current.items.length;
    warnings.push(...preview.warnings);
  }
  if (selection.company_profile && "company_profile" in backup.sections) {
    const incoming = backup.sections.company_profile;
    if (companyProfileKey in baseline && mode === "merge") conflicts.push("Profilul firmei: înregistrarea existentă va fi păstrată.");
    else add("company_profile", companyProfileKey, incoming === null ? null : JSON.stringify({schema_version: 1, profile: validateCompanyProfile(incoming)}));
    affected.company_profile = companyProfileKey in baseline ? 1 : 0;
  }
  return {backup, baseline: structuredClone(baseline), selection: {...selection}, mode, changes, conflicts, affected, warnings, revisionFloor,
    requiresConfirmation: mode === "replace"};
}

export async function applyRestorePlan(plan: RestorePlan, confirmedReplacement: boolean) {
  return withLocalRestoreLocks(() => {
    const source = localStorageSource(); assertNoPendingRestore(source);
    // Rebuild instead of trusting a UI-supplied serialized write plan.
    const checked = buildRestorePlan(plan.backup, plan.baseline, plan.selection, plan.mode, plan.revisionFloor);
    if (checked.requiresConfirmation && !confirmedReplacement) throw new Error("Confirmă explicit înlocuirea secțiunilor selectate.");
    const current = captureLocalData(source);
    for (const section of sectionNames.filter(section => plan.selection[section])) {
      const slice = (data: LocalSnapshot) => Object.entries(data).filter(([key]) => sectionFor(key) === section);
      if (JSON.stringify(slice(current)) !== JSON.stringify(slice(plan.baseline))) throw new Error("Datele locale s-au schimbat după previzualizare. Verifică din nou backupul înainte de restaurare.");
    }
    commitRestore(source, checked.changes);
    return {written: checked.changes.length, skipped: checked.conflicts};
  });
}

/** Diagnostic artifact only, deliberately not accepted by the backup importer. */
export function rawRecoveryText(key: string, source = localStorageSource()): string {
  if (!sectionFor(key) && key !== restoreJournalKey) throw new Error("Cheia nu aparține datelor FORMA suportate.");
  return JSON.stringify({format: "forma-raw-recovery", schema_version: 1, created_at: new Date().toISOString(), key, raw: source.getItem(key)});
}
