import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {loadTypeScriptModule as load} from "./helpers/load-typescript.mjs";

const backup = load("src/features/storage/forma-backup.ts");
const transaction = load("src/features/storage/restore-transaction.ts");
const catalog = load("src/features/catalog/catalog-repository.ts");
const model = load("src/features/catalog/catalog-model.ts");
const company = load("src/features/company/company-profile.ts");
const projects = load("src/features/furniture/browser-project-store.ts");
const sizes = load("src/features/storage/size-policy.ts");
const date = "2026-11-13T12:00:00Z";
const fixture = JSON.parse(readFileSync("tests/fixtures/wardrobe-project.json", "utf8"));
const all = {projects: true, catalogs: true, company_profile: true};
const only = name => ({projects: false, catalogs: false, company_profile: false, [name]: true});
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const projectKey = projects.browserProjectPrefix + fixture.id;
function envelope(changes = {}) {
  const {compatible, deviz_complete, warnings, ...input} = fixture; void compatible; void deviz_complete; void warnings;
  return {storage_version: 1, project: {...input, ...changes}};
}
function companyProfile() {return {...company.emptyCompanyProfile(), display_name: "Atelier Șurub și Țiglă", contact_person: "Ștefan", quotation_notes: "Garanție și condiții"};}
function offer(n, changes = {}) {return {id: uuid(n), updated_at: date, item_code: "pal_18", name: "PAL stejar", category: "PAL", supplier_id: null,
  supplier_sku: null, material_type: null, thickness_mm: 18, color_or_finish: null, sheet_width_mm: null, sheet_length_mm: null,
  purchase_unit: "m²", calculation_unit: "m²", unit_price_ron: "99", conversion_factor: "1", product_url: null, source_type: "manual", is_active: true, is_preferred: false, ...changes};}
function complete(sections = {}) {return {format: "forma-backup", schema_version: 1, application: "FORMA", created_at: date,
  sections: {projects: [envelope()], catalogs: [{domain_id: "furniture", catalog: {...model.emptyCatalog(), items: [offer(1)]}}], company_profile: companyProfile(), ...sections}};}
function environment(context, initial = {}) {
  const previous = globalThis.window, rows = new Map(Object.entries(initial));
  const source = {getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key),
    get length() {return rows.size;}, key: index => Array.from(rows.keys())[index] ?? null};
  globalThis.window = {localStorage: source};
  context.after(() => {if (previous === undefined) delete globalThis.window; else globalThis.window = previous;});
  return {rows, source};
}
function planFor(value, selection = all, mode = "merge") {return backup.buildRestorePlan(value, backup.captureLocalData(), selection, mode);}

test("full local backup round-trips projects, catalog, company, IDs and timestamps without HTTP", async context => {
  const {rows} = environment(context);
  context.mock.method(globalThis, "fetch", () => {throw new Error("No network permitted");});
  const original = complete();
  rows.set(projectKey, JSON.stringify(original.sections.projects[0]));
  rows.set(catalog.catalogStorageKey, JSON.stringify(original.sections.catalogs[0].catalog));
  rows.set(company.companyProfileKey, JSON.stringify({schema_version: 1, profile: original.sections.company_profile}));
  rows.set("auth-token", "must-never-export"); rows.set("forma-mode", "professional"); rows.set("other:domain", "untouched");
  const text = await backup.exportFormaBackup();
  assert.ok(!text.includes("must-never-export")); assert.ok(!text.includes("blob:"));
  const parsed = backup.parseFormaBackup(text);
  assert.equal(parsed.sections.projects[0].project.id, fixture.id);
  assert.equal(parsed.sections.projects[0].project.created_at, fixture.created_at);
  assert.equal(parsed.sections.company_profile.display_name, "Atelier Șurub și Țiglă");
  for (const key of [projectKey, catalog.catalogStorageKey, company.companyProfileKey]) rows.delete(key);
  const plan = planFor(parsed); assert.equal(plan.changes.length, 3); assert.equal(rows.has(projectKey), false);
  await backup.applyRestorePlan(plan, false);
  const reopened = await projects.browserProjectRequest(`projects/${fixture.id}`);
  assert.deepEqual(reopened.confirmed_configuration, fixture.confirmed_configuration);
  assert.equal(reopened.revision, fixture.revision); assert.equal(reopened.updated_at, fixture.updated_at);
  assert.equal((await catalog.localCatalogRepository.load()).items[0].unit_price_ron, "99");
  assert.equal(company.loadCompanyProfile().contact_person, "Ștefan");
  assert.equal(rows.get("auth-token"), "must-never-export"); assert.equal(rows.get("other:domain"), "untouched");
  assert.equal(rows.has(transaction.restoreJournalKey), false);
});

test("empty and single-section backups preserve unrelated local data", async context => {
  const {rows} = environment(context, {"forma-mode": "simple"});
  const empty = complete({projects: [], catalogs: [], company_profile: null});
  const p = planFor(empty); assert.equal(p.changes.length, 0); await backup.applyRestorePlan(p, false);
  for (const section of ["projects", "catalogs", "company_profile"]) {
    const partial = {...complete(), sections: {[section]: complete().sections[section]}};
    const before = new Map(rows); const planned = planFor(partial, only(section));
    await backup.applyRestorePlan(planned, false);
    assert.ok(planned.changes.every(entry => entry.section === section));
    for (const [key, raw] of before) assert.equal(rows.get(key), raw);
  }
  assert.equal(rows.get("forma-mode"), "simple");
});

test("historical price snapshots survive restore even when current supplier prices change", async context => {
  const {rows} = environment(context);
  const {migrateManualSnapshots} = load("src/features/furniture/project-price-snapshot.ts");
  const price = {item_code: "pal_18", item_name: "PAL", unit: "m²", unit_price_ron: "47.250000", currency: "RON", source_type: "manual", source_name: "Istoric", updated_at: date};
  const snapshots = migrateManualSnapshots([price]);
  Object.assign(snapshots[0], {supplier_id: uuid(77), supplier_name: "Furnizor istoric", catalog_item_id: uuid(1), source_type: "manual_catalog", is_override: false});
  const incoming = {...complete(), sections: {projects: [{...envelope(), storage_version: 2, project: {...envelope().project, manual_price_catalog: [price], price_snapshots: snapshots}}]}};
  rows.set(catalog.catalogStorageKey, JSON.stringify({...model.emptyCatalog(), items: [offer(1, {unit_price_ron: "999"})]}));
  await backup.applyRestorePlan(planFor(incoming, only("projects")), false);
  const saved = await projects.browserProjectRequest(`projects/${fixture.id}`);
  assert.equal(saved.manual_price_catalog[0].unit_price_ron, "47.250000");
  assert.deepEqual(saved.price_snapshots, snapshots);
  assert.equal((await catalog.localCatalogRepository.load()).items[0].unit_price_ron, "999");
  const reexport = backup.parseFormaBackup(await backup.exportFormaBackup());
  assert.deepEqual(reexport.sections.projects[0].project.price_snapshots, snapshots);
});

test("merge reports every ID conflict and never overwrites or silently duplicates", async context => {
  const {rows} = environment(context, {[projectKey]: JSON.stringify(envelope())});
  rows.set(catalog.catalogStorageKey, JSON.stringify(complete().sections.catalogs[0].catalog));
  rows.set(company.companyProfileKey, JSON.stringify({schema_version: 1, profile: companyProfile()}));
  const previous = new Map(rows);
  const value = complete({projects: [envelope({name: "New name"})]});
  const plan = planFor(value); assert.equal(plan.conflicts.length, 3); assert.equal(plan.changes.length, 0);
  await backup.applyRestorePlan(plan, false); assert.deepEqual(rows, previous);
});

test("explicit section replacement retains unrelated records and rebases existing project revision", async context => {
  const {rows} = environment(context, {[projectKey]: JSON.stringify(envelope()), "unrelated": "keep"});
  rows.set(company.companyProfileKey, JSON.stringify({schema_version: 1, profile: companyProfile()}));
  const originalCompany = rows.get(company.companyProfileKey);
  const plan = planFor(complete({projects: [envelope({name: "Restaurat"})]}), only("projects"), "replace");
  assert.equal(plan.requiresConfirmation, true);
  await assert.rejects(backup.applyRestorePlan(plan, false), /explicit/);
  await backup.applyRestorePlan(plan, true);
  const saved = await projects.browserProjectRequest(`projects/${fixture.id}`);
  assert.equal(saved.name, "Restaurat"); assert.equal(saved.id, fixture.id); assert.equal(saved.revision, 2);
  assert.equal(saved.created_at, fixture.created_at); assert.equal(saved.updated_at, fixture.updated_at);
  assert.equal(rows.get(company.companyProfileKey), originalCompany); assert.equal(rows.get("unrelated"), "keep");
  await assert.rejects(projects.browserProjectRequest(`projects/${fixture.id}?expected_revision=1`, {method: "DELETE"}), /altă filă/);
});

test("invalid JSON, future backup versions, extra fields and invalid records are rejected before writing", context => {
  const {rows} = environment(context); const before = new Map(rows);
  for (const text of ["{", "null", JSON.stringify({format: "forma-backup", schema_version: 99}), JSON.stringify({...complete(), secret: "rejected"}),
    JSON.stringify({...complete(), created_at: "tomorrow"}), JSON.stringify({...complete(), sections: {projects: [{}]}}),
    JSON.stringify({...complete(), sections: {company_profile: {display_name: "Incomplete"}}}),
    JSON.stringify({...complete(), sections: {catalogs: [{domain_id: "electric", catalog: model.emptyCatalog()}]}}),
    JSON.stringify({...complete(), sections: {catalogs: [{domain_id: "furniture", catalog: {schema_version: 99}}]}})]) {
    assert.throws(() => backup.parseFormaBackup(text)); assert.deepEqual(rows, before);
  }
  assert.throws(() => backup.validateFormaBackup({...complete(), sections: {projects: [envelope(), envelope()]}}), /duplicat/);
  assert.throws(() => backup.validateFormaBackup({...complete(), sections: {projects: [{...envelope(), storage_version: 99}]}}), /proiect/);
});

test("corrupt/unknown project, catalog and company records block complete export but raw download works", async context => {
  const {rows} = environment(context);
  for (const [key, value] of [[projectKey, "{bad"], [catalog.catalogStorageKey, JSON.stringify({schema_version: 99})], [company.companyProfileKey, "invalid"]]) {
    rows.set(key, value);
    const result = backup.inspectLocalData(backup.captureLocalData()); assert.equal(result.filter(record => record.error).length, 1);
    await assert.rejects(backup.exportFormaBackup(), /blocat/);
    const raw = JSON.parse(backup.rawRecoveryText(key)); assert.equal(raw.raw, value); assert.equal(raw.key, key);
    assert.throws(() => backup.parseFormaBackup(JSON.stringify(raw)));
    assert.equal(rows.get(key), value); rows.delete(key);
  }
  assert.throws(() => backup.rawRecoveryText("auth-token"));
});

test("corrupt sections recover only after explicit replacement confirmation", async context => {
  const {rows} = environment(context, {[projectKey]: "bad", [catalog.catalogStorageKey]: "bad", [catalog.legacyCatalogStorageKey]: "legacy-bad", [company.companyProfileKey]: "bad", "other:domain": "safe"});
  assert.throws(() => planFor(complete()), /Catalogul local/);
  const plan = planFor(complete(), all, "replace");
  assert.deepEqual(backup.buildRestorePlan(plan.backup, plan.baseline, plan.selection, plan.mode, plan.revisionFloor).changes, plan.changes);
  assert.equal(plan.requiresConfirmation, true);
  await assert.rejects(backup.applyRestorePlan(plan, false), /explicit/);
  await backup.applyRestorePlan(plan, true);
  assert.equal(backup.inspectLocalData(backup.captureLocalData()).filter(record => record.error).length, 0);
  assert.equal(rows.has(catalog.legacyCatalogStorageKey), false); assert.equal(rows.get("other:domain"), "safe");
  assert.doesNotThrow(() => backup.parseFormaBackup(JSON.stringify(complete())));
  assert.ok(await backup.exportFormaBackup());
});

test("preview is read-only and stale preview detects changes, added records and section revisions", async context => {
  const {rows} = environment(context); const before = new Map(rows);
  const plan = planFor(complete()); assert.deepEqual(rows, before);
  const other = uuid(500); rows.set(projects.browserProjectPrefix + other, JSON.stringify(envelope({id: other})));
  await assert.rejects(backup.applyRestorePlan(plan, false), /schimbat/);
  assert.equal(rows.has(projectKey), false);
  const companyPlan = planFor(complete(), only("company_profile"));
  rows.set("auth-token", "ignored"); await backup.applyRestorePlan(companyPlan, false);
  assert.equal(rows.get("auth-token"), "ignored");
});

test("quota failure at staging changes no records and mid-write failure rolls back exactly", async context => {
  const {rows, source} = environment(context); const plan = planFor(complete());
  const realSet = source.setItem;
  source.setItem = () => {throw new Error("quota");};
  await assert.rejects(backup.applyRestorePlan(plan, false), /nu a început/); assert.equal(rows.size, 0);
  let failed = false;
  source.setItem = (key, value) => {if (key === company.companyProfileKey && !failed) {failed = true; throw new Error("quota");} return realSet(key, value);};
  await assert.rejects(backup.applyRestorePlan(plan, false), /anulate/);
  assert.equal(rows.size, 0);
});

test("rollback failure preserves the journal and names exact affected sections; retry recovers", async context => {
  const {rows, source} = environment(context); const plan = planFor(complete());
  const realSet = source.setItem, realRemove = source.removeItem;
  source.setItem = (key, value) => {if (key === company.companyProfileKey) throw new Error("quota"); return realSet(key, value);};
  source.removeItem = key => {if (key === projectKey) throw new Error("denied"); return realRemove(key);};
  await assert.rejects(backup.applyRestorePlan(plan, false), /projects: forma:wardrobe-project/);
  assert.equal(rows.has(transaction.restoreJournalKey), true); assert.equal(rows.has(projectKey), true);
  assert.ok(JSON.parse(backup.rawRecoveryText(transaction.restoreJournalKey)).raw.includes(projectKey));
  assert.throws(() => transaction.assertNoPendingRestore(source), /întreruptă/);
  source.removeItem = realRemove; transaction.rollbackRestore(source); assert.equal(rows.size, 0);
});

test("interrupted restore is recognized after fresh module load and blocks normal writers until rollback", async context => {
  const {rows, source} = environment(context); const plan = planFor(complete());
  rows.set(transaction.restoreJournalKey, JSON.stringify({schema_version: 1, changes: plan.changes}));
  rows.set(projectKey, plan.changes.find(entry => entry.key === projectKey).after);
  const fresh = load("src/features/storage/restore-transaction.ts");
  assert.equal(fresh.readRestoreJournal(source).changes.length, 3);
  await assert.rejects(catalog.localCatalogRepository.saveSupplier({name: "Blocked", website_url: null, contact_details: null, notes: null}, null, 0), /întreruptă/);
  assert.throws(() => company.saveCompanyProfile(companyProfile()), /întreruptă/);
  await assert.rejects(projects.browserProjectRequest(`projects/${fixture.id}?expected_revision=1`, {method: "DELETE"}), /întreruptă/);
  fresh.rollbackRestore(source); assert.equal(rows.size, 0);
});

test("recovery never overwrites a concurrent writer or automatically deletes a malformed journal", context => {
  const {rows, source} = environment(context);
  const change = {section: "company_profile", key: company.companyProfileKey, before: null, after: "restored"};
  rows.set(transaction.restoreJournalKey, JSON.stringify({schema_version: 1, changes: [change]})); rows.set(company.companyProfileKey, "newer change");
  assert.throws(() => transaction.rollbackRestore(source), /company_profile:/);
  assert.equal(rows.get(company.companyProfileKey), "newer change");
  rows.set(transaction.restoreJournalKey, "broken");
  assert.throws(() => transaction.rollbackRestore(source), /deteriorat/); assert.equal(rows.get(transaction.restoreJournalKey), "broken");
});

test("historical projects retain their construction versions; future storage envelopes are rejected", async context => {
  environment(context);
  const historical = envelope({schema_version: 2, construction_profile_id: "historical-profile", calculation_version: "historical-engine"});
  const value = {...complete(), sections: {projects: [historical]}};
  await backup.applyRestorePlan(planFor(value, only("projects")), false);
  const saved = await projects.browserProjectRequest(`projects/${fixture.id}`);
  assert.equal(saved.compatible, false); assert.equal(saved.construction_profile_id, "historical-profile");
  assert.equal(backup.parseFormaBackup(await backup.exportFormaBackup()).sections.projects[0].project.schema_version, 2);
});

test("company logo is included under its existing byte limit and invalid/oversized logos are rejected", async context => {
  environment(context);
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7Z0AAAAASUVORK5CYII=";
  const profile = {...companyProfile(), logo: {data_url: `data:image/png;base64,${png}`, format: "PNG", width: 1, height: 1}};
  const value = {...complete(), sections: {company_profile: profile}};
  await backup.applyRestorePlan(planFor(value, only("company_profile")), false);
  assert.equal(backup.parseFormaBackup(await backup.exportFormaBackup()).sections.company_profile.logo.data_url, profile.logo.data_url);
  const bytes = Buffer.alloc(company.logoMaxBytes + 1); Buffer.from(png, "base64").copy(bytes);
  assert.throws(() => backup.validateFormaBackup({...value, sections: {company_profile: {...profile, logo: {...profile.logo, data_url: `data:image/png;base64,${bytes.toString("base64")}`}}}}), /Logo|logo/);
  assert.throws(() => backup.validateFormaBackup({...value, sections: {company_profile: {...profile, logo: {...profile.logo, width: 2049}}}}), /Logo/);
});

test("900 long-URL catalog reproduces WR-04 and successfully round-trips through both importers", () => {
  const state = {...model.emptyCatalog(), items: Array.from({length: 900}, (_, i) => offer(i + 1, {product_url: "https://example.test/" + "a".repeat(1950)}))};
  const text = JSON.stringify(catalog.exportCatalog(state)); assert.ok(sizes.utf8Bytes(text) > 2 * 1024 * 1024);
  assert.deepEqual(catalog.parseCatalogBackup(text).items, state.items);
  assert.deepEqual(backup.parseFormaBackup(text).sections.catalogs[0].catalog.items, state.items);
  const atLimit = text + " ".repeat(sizes.catalogBackupMaxBytes - sizes.utf8Bytes(text));
  assert.equal(sizes.utf8Bytes(atLimit), sizes.catalogBackupMaxBytes);
  assert.equal(catalog.parseCatalogBackup(atLimit).items.length, 900);
  assert.throws(() => catalog.parseCatalogBackup(atLimit + " "), /16 MB/);
});

test("catalog maximum record counts and UTF-8 byte policy remain bounded without truncation", () => {
  const state = {...model.emptyCatalog(), items: Array.from({length: 3000}, (_, i) => offer(i + 1))};
  assert.equal(catalog.parseCatalogBackup(JSON.stringify(catalog.exportCatalog(state))).items.length, 3000);
  assert.throws(() => catalog.exportCatalog({...state, items: [...state.items, offer(4000)]}));
  assert.equal(sizes.utf8Bytes("șț😀"), 8);
  assert.throws(() => sizes.requireByteLimit("șț😀", 7)); assert.doesNotThrow(() => sizes.requireByteLimit("șț😀", 8));
  const oversized = {...state, items: state.items.map(item => ({...item, product_url: "https://example.test/" + "ș".repeat(1950), name: "ș".repeat(200), material_type: "ș".repeat(100), color_or_finish: "ș".repeat(100), supplier_sku: "ș".repeat(100)}))};
  // This valid-record catalog exceeds the explicitly supported file size.
  const suppliers = Array.from({length: 500}, (_, i) => ({id: uuid(5000 + i), created_at: date, updated_at: date, name: "ș".repeat(120), website_url: null, contact_details: "ș".repeat(500), notes: "ș".repeat(2000)}));
  const large = {...oversized, suppliers};
  model.validateCatalog(large);
  assert.ok(sizes.utf8Bytes(JSON.stringify({suppliers, items: large.items})) > sizes.catalogBackupMaxBytes);
  assert.throws(() => catalog.exportCatalog(large), /16 MB/);
  const text = JSON.stringify(complete({projects: [], catalogs: [], company_profile: null}));
  const atLimit = text + " ".repeat(sizes.fullBackupMaxBytes - sizes.utf8Bytes(text));
  assert.doesNotThrow(() => backup.parseFormaBackup(atLimit));
  assert.throws(() => backup.parseFormaBackup(atLimit + " "), /32 MB/);
});

test("legacy furniture catalog fallback is exported without rewriting its source key", async context => {
  const state = {...model.emptyCatalog(), revision: 10, items: [offer(1)]};
  const raw = JSON.stringify(state); const {rows} = environment(context, {[catalog.legacyCatalogStorageKey]: raw});
  const parsed = backup.parseFormaBackup(await backup.exportFormaBackup()); assert.deepEqual(parsed.sections.catalogs[0].catalog, state);
  assert.equal(rows.get(catalog.legacyCatalogStorageKey), raw); assert.equal(rows.has(catalog.catalogStorageKey), false);
});

test("blocked browser storage fails clearly without claiming export/restore success", async context => {
  const {source} = environment(context);
  source.getItem = () => {throw new Error("denied");};
  assert.throws(() => backup.captureLocalData(), /Browserul/); await assert.rejects(backup.exportFormaBackup(), /Browserul/);
});

test("backup and recovery UI is accessible before repository readiness and excluded data is explained", () => {
  const {BackupPage} = load("src/features/storage/backup-page.tsx");
  const html = renderToStaticMarkup(React.createElement(BackupPage));
  assert.match(html, /Backup și restaurare/); assert.match(html, /Exportă backup FORMA/);
  assert.match(html, /type="file"/); assert.match(html, /Recuperare date deteriorate/);
  assert.match(html, /drafturile nesalvate/); assert.match(html, /nu sunt criptate/);
  for (const file of ["src/features/catalog/catalog-page.tsx", "src/features/company/company-settings.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /<RecoveryLink\s*\/>/);
  }
});
