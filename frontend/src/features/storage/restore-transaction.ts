import { fullBackupMaxBytes, requireByteLimit } from "./size-policy";

export const restoreJournalKey = "forma:restore-journal:v1";
export type LocalSection = "projects" | "catalogs" | "company_profile";
export type StorageChange = {section: LocalSection; key: string; before: string | null; after: string | null};
export type RestoreJournal = {schema_version: 1; changes: StorageChange[]};
const allowed = (key: string) => (key.startsWith("forma:wardrobe-project:v1:") && key.length <= 200) ||
  ["forma:supplier-catalog:furniture:v1", "forma:supplier-catalog:v1", "forma:company-profile:v1"].includes(key);

export function assertNoPendingRestore(storage: Storage) {
  let pending: string | null;
  try {pending = storage.getItem(restoreJournalKey);}
  catch {throw new Error("Browserul nu permite citirea datelor locale. Nu am confirmat salvarea sau restaurarea.");}
  if (pending !== null) {
    throw new Error("O restaurare este în curs sau a fost întreruptă. Deschide Backup și restaurare pentru recuperare; nu am modificat datele.");
  }
}

function validateJournal(value: unknown): RestoreJournal {
  const journal = value as RestoreJournal;
  if (!journal || journal.schema_version !== 1 || Object.keys(journal).some(key => !["schema_version", "changes"].includes(key)) ||
    !Array.isArray(journal.changes) || journal.changes.length > 20003) throw new Error("Jurnalul de recuperare este incompatibil. Descarcă datele brute înainte de intervenție.");
  const seen = new Set<string>();
  for (const entry of journal.changes) {
    if (!entry || !allowed(entry.key) || seen.has(entry.key) || !["projects", "catalogs", "company_profile"].includes(entry.section) ||
      (entry.section === "projects") !== entry.key.startsWith("forma:wardrobe-project:v1:") ||
      (entry.section === "company_profile") !== (entry.key === "forma:company-profile:v1") ||
      Object.keys(entry).some(key => !["section", "key", "before", "after"].includes(key)) ||
      ![entry.before, entry.after].every(value => value === null || typeof value === "string")) throw new Error("Jurnalul de recuperare este invalid.");
    seen.add(entry.key);
  }
  return journal;
}

export function readRestoreJournal(storage: Storage): RestoreJournal | null {
  const raw = storage.getItem(restoreJournalKey);
  if (raw === null) return null;
  requireByteLimit(raw, fullBackupMaxBytes * 4, "Jurnalul");
  try {return validateJournal(JSON.parse(raw));}
  catch {throw new Error("Jurnalul de recuperare este deteriorat sau incompatibil. Descarcă datele brute; nu am șters nimic.");}
}

function writeValue(storage: Storage, key: string, value: string | null) {
  if (value === null) storage.removeItem(key); else storage.setItem(key, value);
}

/** Explicit rollback only; never overwrite a value changed by another writer. */
export function rollbackRestore(storage: Storage): void {
  const journal = readRestoreJournal(storage);
  if (!journal) return;
  const failed: string[] = [];
  for (const change of [...journal.changes].reverse()) {
    try {
      const current = storage.getItem(change.key);
      if (current === change.before) continue;
      if (current !== change.after) throw new Error("Conflict");
      writeValue(storage, change.key, change.before);
    } catch {failed.push(`${change.section}: ${change.key}`);}
  }
  if (failed.length) throw new Error(`Recuperarea nu s-a încheiat pentru: ${failed.join(", ")}. Jurnalul a fost păstrat. Descarcă-l și nu mai edita datele.`);
  storage.removeItem(restoreJournalKey);
}

/** Receives repository-validated changes; staging must fit before any data write. */
export function commitRestore(storage: Storage, changes: StorageChange[]) {
  assertNoPendingRestore(storage);
  const journal = validateJournal({schema_version: 1, changes});
  for (const entry of changes) {
    if (storage.getItem(entry.key) !== entry.before) throw new Error("Datele locale s-au schimbat după previzualizare. Verifică backupul din nou.");
  }
  if (!changes.length) return;
  const raw = JSON.stringify(journal);
  requireByteLimit(raw, fullBackupMaxBytes * 4, "Jurnalul");
  try {storage.setItem(restoreJournalKey, raw);}
  catch {throw new Error("Nu există spațiu pentru jurnalul de siguranță sau browserul blochează stocarea. Restaurarea nu a început.");}
  try {
    for (const entry of changes) {
      if (storage.getItem(entry.key) !== entry.before) throw new Error("Conflict între file în timpul restaurării.");
      writeValue(storage, entry.key, entry.after);
    }
    storage.removeItem(restoreJournalKey);
  } catch {
    rollbackRestore(storage);
    throw new Error("Restaurarea a eșuat (spațiu, acces sau conflict). Modificările au fost anulate; datele anterioare sunt păstrate.");
  }
}

// Same names/order as normal project/catalog repositories. Company writes are
// synchronous and check the journal; old app versions cannot honor this guard.
export async function withLocalRestoreLocks<T>(action: () => T | Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) return action();
  return navigator.locks.request("forma:wardrobe-project-writes:v1", async () =>
    navigator.locks.request("forma:catalog-writes:v1", async () => action()));
}
