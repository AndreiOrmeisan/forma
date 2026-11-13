import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {loadTypeScriptModule as load} from "./helpers/load-typescript.mjs";

process.env.NEXT_PUBLIC_PROJECT_STORAGE = "browser";
const fixture = name => JSON.parse(readFileSync(`tests/fixtures/${name}.json`, "utf8"));
const profile = fixture("manufacturing-profile"), result = fixture("manufacturing-result"), project = fixture("wardrobe-project");
const configuration = project.confirmed_configuration;
const model = load("src/features/manufacturing/manufacturing-model.ts");
const repository = load("src/features/manufacturing/manufacturing-repository.ts");
const manufacturingApi = load("src/features/manufacturing/manufacturing-api.ts");
const catalog = load("src/features/catalog/catalog-repository.ts");
const projects = load("src/features/furniture/browser-project-store.ts");
const api = load("src/features/furniture/project-api.ts");
const pricing = load("src/features/furniture/wardrobe-pricing.ts");
const backup = load("src/features/storage/forma-backup.ts");
const transaction = load("src/features/storage/restore-transaction.ts");
const all = {projects: true, catalogs: true, company_profile: true, manufacturing_profiles: true};
const supplier = {id: "31000000-0000-4000-8000-000000000001", name: "Furnizor sintetic", website_url: null, contact_details: null, notes: null, created_at: profile.created_at, updated_at: profile.updated_at};
function environment(context) {
  const previous = globalThis.window, rows = new Map();
  const storage = {getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, String(value)), removeItem: key => rows.delete(key),
    get length() {return rows.size;}, key: index => Array.from(rows.keys())[index] ?? null};
  globalThis.window = {localStorage: storage, setTimeout, clearTimeout};
  context.after(() => {if (previous === undefined) delete globalThis.window; else globalThis.window = previous;});
  return {rows, storage};
}
function hooks() {
  let cursor = 0; const values = [], effects = [];
  const react = {...React, useCallback: fn => fn,
    useState(initial) {const slot = cursor++; if (!(slot in values)) values[slot] = typeof initial === "function" ? initial() : initial;
      return [values[slot], next => {values[slot] = typeof next === "function" ? next(values[slot]) : next;}];},
    useRef(initial) {const slot = cursor++; return values[slot] ??= {current: initial};},
    useEffect(fn) {const slot = cursor++; if (!(slot in values)) {values[slot] = true; effects.push(fn);}},
  };
  return {react, render(fn) {cursor = 0; return fn();}, mount() {effects.splice(0).forEach(fn => fn());}};
}
function nodes(tree) {return !tree || typeof tree !== "object" ? [] : [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];}

test("blank profiles have no technical defaults; complete data never validates itself", () => {
  const blank = model.blankManufacturingProfile();
  assert.equal(blank.status, "draft"); assert.equal(blank.cutting_precision_mm, null); assert.equal(blank.rounding_policy, null);
  assert.equal(blank.back_projection_mm, null); assert.equal(blank.front_projection_mm, null);
  assert.ok(model.incompleteProfile(blank).length >= 5);
  assert.equal(model.validateManufacturingProfile(profile).status, "draft"); assert.equal(model.incompleteProfile(profile).length, 0);
  assert.throws(() => model.validateManufacturingProfile({...profile, status: "validated", cutting_precision_mm: null}));
});

test("exclusive rule representations preserve zero and missing values, rejecting invalid parameters", () => {
  const layers = {...profile, edge_processing_rules: {...profile.edge_processing_rules, abs_2: {mode: "layers", applied_thickness_mm: "2", removal_mm: "0"}}};
  assert.equal(model.incompleteProfile(model.validateManufacturingProfile(layers)).length, 0);
  assert.ok(model.incompleteProfile({...layers, edge_processing_rules: {...layers.edge_processing_rules, abs_2: {mode: "layers", applied_thickness_mm: "2", removal_mm: null}}}).length > 0);
  for (const change of [{cutting_precision_mm: "0"}, {cutting_precision_mm: 1}, {cutting_precision_mm: "1e-2"}, {front_projection_mm: "-1"}, {rounding_policy: "automatic"},
    {supported_edge_types: ["toString"]}, {edge_processing_rules: {abs_2: {mode: "net", net_contribution_mm: "1", removal_mm: "1"}}}]) assert.throws(() => model.validateManufacturingProfile({...profile, ...change}));
  assert.throws(() => model.validateManufacturingSnapshot({...repository.snapshotManufacturingProfile(profile, []), approval_status: "validated"}));
});

test("multiple supplier profiles and standalone profiles persist with explicit validation and archive", async context => {
  environment(context);
  let store = await repository.saveManufacturingProfile({...profile, supplier_id: supplier.id}, 0);
  assert.equal(store.profiles[0].status, "draft");
  store = await repository.saveManufacturingProfile({...profile, id: "21000000-0000-4000-8000-000000000002", supplier_id: supplier.id}, store.revision);
  store = await repository.saveManufacturingProfile({...profile, id: "21000000-0000-4000-8000-000000000003"}, store.revision);
  assert.equal(store.profiles.filter(p => p.supplier_id === supplier.id).length, 2);
  assert.equal(store.profiles.filter(p => p.supplier_id === null).length, 1);
  store = await repository.saveManufacturingProfile(store.profiles[0], store.revision, "validate");
  const validated = store.profiles.find(p => p.id === profile.id); assert.equal(validated.status, "validated");
  store = await repository.saveManufacturingProfile({...validated, notes: "Modified"}, store.revision);
  assert.equal(store.profiles.find(p => p.id === profile.id).status, "draft");
  store = await repository.saveManufacturingProfile(store.profiles.find(p => p.id === profile.id), store.revision, "archive");
  assert.throws(() => repository.snapshotManufacturingProfile(store.profiles.find(p => p.id === profile.id), [supplier]), /arhivat/);
  assert.deepEqual(repository.loadManufacturingProfiles(), store);
});

test("supplier archive/delete preserves profile references without changing preferred prices", async context => {
  const {rows} = environment(context);
  rows.set(catalog.catalogStorageKey, JSON.stringify({schema_version: 1, revision: 1, suppliers: [supplier], items: []}));
  await repository.saveManufacturingProfile({...profile, supplier_id: supplier.id}, 0);
  const before = rows.get(repository.manufacturingStorageKey);
  let state = await catalog.localCatalogRepository.setSupplierStatus(supplier.id, "archived", 1);
  assert.equal(repository.supplierAssociation({...profile, supplier_id: supplier.id}, state.suppliers).status, "archived");
  assert.equal(rows.get(repository.manufacturingStorageKey), before);
  state = await catalog.localCatalogRepository.deleteSupplier(supplier.id, state.revision);
  assert.equal(repository.supplierAssociation({...profile, supplier_id: supplier.id}, state.suppliers).status, "missing");
  assert.equal(repository.loadManufacturingProfiles().profiles[0].supplier_id, supplier.id);
  assert.ok(repository.supplierAssociation({...profile, supplier_id: supplier.id}, []).warning);
});

test("profile repository protects stale revisions, corruption and blocked/quota writes", async context => {
  const {rows, storage} = environment(context);
  const store = await repository.saveManufacturingProfile(profile, 0), raw = rows.get(repository.manufacturingStorageKey);
  await assert.rejects(repository.saveManufacturingProfile(store.profiles[0], 0), /altă filă/);
  storage.setItem = () => {throw new Error("quota");};
  await assert.rejects(repository.saveManufacturingProfile(store.profiles[0], store.revision), /nu a fost salvat/);
  assert.equal(rows.get(repository.manufacturingStorageKey), raw);
  rows.set(repository.manufacturingStorageKey, "broken"); assert.throws(() => repository.loadManufacturingProfiles(), /nu pot fi citite/);
  assert.equal(rows.get(repository.manufacturingStorageKey), "broken");
});

test("project snapshots preserve exact rules/association and do not track supplier/profile edits", async context => {
  const {rows} = environment(context);
  const selected = repository.snapshotManufacturingProfile({...profile, supplier_id: supplier.id}, [supplier]);
  const payload = api.projectPayload(configuration, pricing.initialPricing(), {name: "Test mfg", description: "", status: "draft"}, null, [], selected);
  const saved = await api.saveProject(payload, null);
  assert.equal(JSON.parse(rows.get(projects.browserProjectPrefix + saved.id)).storage_version, 3);
  await repository.saveManufacturingProfile({...profile, supplier_id: supplier.id, edge_processing_rules: {...profile.edge_processing_rules, abs_2: {mode: "net", net_contribution_mm: "1"}}}, 0);
  const reopened = await api.getProject(saved.id);
  assert.deepEqual(reopened.manufacturing_snapshot, selected);
  assert.equal(reopened.manufacturing_snapshot.profile.edge_processing_rules.abs_2.net_contribution_mm, "2");
  assert.equal(reopened.manufacturing_snapshot.supplier_name_at_selection, supplier.name);
  assert.deepEqual(reopened.manual_price_catalog, saved.manual_price_catalog); assert.equal(reopened.revision, 1);
  const refresh = api.projectPayload(configuration, pricing.initialPricing(), {name: saved.name, description: "", status: "draft"}, saved, [], null);
  const cleared = await api.saveProject(refresh, saved); assert.equal(cleared.manufacturing_snapshot, null); assert.equal(cleared.id, saved.id);
});

test("context selection is dirty while financial configuration/prices and saved revision remain unchanged", () => {
  const h = hooks();
  const {WardrobeProjectProvider} = load("src/features/furniture/wardrobe-project-context.tsx", {react: h.react,
    "../auth/auth-context": {useAuth: () => ({user: null})}, "@/components/image-upload/image-draft-context": {useImageDraft: () => ({image: null, setImage() {}})}});
  const render = () => h.render(() => WardrobeProjectProvider({children: null})).props.value;
  render().restoreProject(project); let state = render(); const originalPrices = structuredClone(state.pricing);
  const {hasUnsavedProject} = load("src/features/furniture/unsaved-project.ts"); assert.equal(hasUnsavedProject(state), false);
  state.selectManufacturing(repository.snapshotManufacturingProfile(profile, [])); state = render();
  assert.equal(hasUnsavedProject(state), true); assert.equal(state.savedProject.revision, project.revision);
  assert.deepEqual(state.pricing, originalPrices); assert.deepEqual(state.confirmed, configuration);
  const signature = manufacturingApi.manufacturingSignature(configuration, state.manufacturingSnapshot);
  state.acceptManufacturing("stale", result); assert.equal(render().manufacturingResult, null);
  state.acceptManufacturing(signature, result); assert.equal(render().manufacturingResult.result.readiness, "calculation_ready_unverified");
  render().updateField("width_mm", "901"); assert.equal(render().manufacturingResult, null);
});

test("new backup v2 round-trips profile records and immutable project snapshots; old backups stay importable", async context => {
  const {rows} = environment(context);
  const store = await repository.saveManufacturingProfile({...profile, supplier_id: supplier.id}, 0);
  const snapshot = repository.snapshotManufacturingProfile(store.profiles[0], [supplier]);
  const saved = await api.saveProject(api.projectPayload(configuration, pricing.initialPricing(), {name: "Backup test", description: "", status: "draft"}, null, [], snapshot), null);
  const text = await backup.exportFormaBackup(), parsed = backup.parseFormaBackup(text);
  assert.equal(parsed.schema_version, 2); assert.equal(parsed.sections.manufacturing_profiles.profiles[0].supplier_id, supplier.id);
  const originalSnapshot = structuredClone(parsed.sections.projects[0].project.manufacturing_snapshot);
  rows.delete(repository.manufacturingStorageKey); rows.delete(projects.browserProjectPrefix + saved.id);
  const plan = backup.buildRestorePlan(parsed, backup.captureLocalData(), all, "merge");
  await backup.applyRestorePlan(plan, false);
  assert.deepEqual((await api.getProject(saved.id)).manufacturing_snapshot, originalSnapshot);
  assert.equal(repository.loadManufacturingProfiles().profiles[0].id, profile.id);
  const previousRaw = rows.get(repository.manufacturingStorageKey);
  const old = backup.parseFormaBackup(JSON.stringify({format: "forma-backup", schema_version: 1, created_at: profile.created_at, application: "FORMA", sections: {projects: []}}));
  assert.equal(old.schema_version, 1); assert.equal(old.sections.manufacturing_profiles, undefined); assert.equal(rows.get(repository.manufacturingStorageKey), previousRaw);
  assert.throws(() => backup.parseFormaBackup(JSON.stringify({...parsed, schema_version: 1})), /v2/);
});

test("profile backup merge conflicts and corruption recovery remain explicit and journal-aware", async context => {
  const {rows, storage} = environment(context);
  await repository.saveManufacturingProfile(profile, 0);
  const parsed = backup.parseFormaBackup(await backup.exportFormaBackup());
  const select = {projects: false, catalogs: false, company_profile: false, manufacturing_profiles: true};
  let plan = backup.buildRestorePlan(parsed, backup.captureLocalData(), select, "merge");
  assert.equal(plan.conflicts.length, 1); assert.equal(plan.changes.length, 0);
  rows.set(repository.manufacturingStorageKey, "broken");
  assert.ok(JSON.parse(backup.rawRecoveryText(repository.manufacturingStorageKey)).raw);
  await assert.rejects(backup.exportFormaBackup(), /blocat/);
  assert.throws(() => backup.buildRestorePlan(parsed, backup.captureLocalData(), select, "merge"), /deteriorate/);
  plan = backup.buildRestorePlan(parsed, backup.captureLocalData(), select, "replace");
  await assert.rejects(backup.applyRestorePlan(plan, false), /explicit/);
  rows.set(transaction.restoreJournalKey, JSON.stringify({schema_version: 2, changes: plan.changes}));
  rows.set(repository.manufacturingStorageKey, plan.changes[0].after);
  await assert.rejects(repository.saveManufacturingProfile(profile, 1), /restaurare/);
  transaction.rollbackRestore(storage); assert.equal(rows.get(repository.manufacturingStorageKey), "broken");
  await backup.applyRestorePlan(plan, true); assert.equal(repository.loadManufacturingProfiles().profiles.length, 1);
});

test("API accepts decimal results and rejects physical-approval claims and mismatched profiles", async context => {
  assert.equal(manufacturingApi.isManufacturingResult(result), true);
  assert.equal(manufacturingApi.isManufacturingResult({...result, readiness: "workshop_approved"}), false);
  let body;
  context.mock.method(globalThis, "fetch", async (url, options) => {body = JSON.parse(options.body); return Response.json(result);});
  const snapshot = repository.snapshotManufacturingProfile(profile, []);
  assert.equal((await manufacturingApi.calculateManufacturing(configuration, snapshot, new AbortController().signal)).panels.find(p => p.panel_id === "doors").raw_width_mm, "393");
  assert.equal(body.confirmed, true); assert.equal(body.snapshot.profile.edge_processing_rules.abs_2.net_contribution_mm, "2");
  context.mock.method(globalThis, "fetch", async () => Response.json({...result, profile_revision: 99}));
  await assert.rejects(manufacturingApi.calculateManufacturing(configuration, snapshot, new AbortController().signal), /incompatibil/);
});

test("profile selection compares rules and requires an explicit confirmation before changing the project", async () => {
  const h = hooks(), applied = [], snapshot = repository.snapshotManufacturingProfile(profile, []);
  const {ManufacturingSelector} = load("src/features/manufacturing/project-manufacturing.tsx", {react: h.react,
    "../furniture/wardrobe-project-context": {useWardrobeProject: () => ({manufacturingSnapshot: null, selectManufacturing: value => applied.push(value), saving: false})},
    "./manufacturing-repository": {...repository, loadManufacturingProfiles: () => ({profiles: [profile]})},
    "../catalog/catalog-repository": {localCatalogRepository: {load: async () => ({suppliers: []})}},
  });
  const render = () => h.render(() => ManufacturingSelector()); let tree = render(); h.mount(); await new Promise(resolve => setImmediate(resolve));
  tree = render(); nodes(tree).find(node => node.type === "select").props.onChange({target: {value: profile.id}});
  tree = render(); assert.equal(applied.length, 0);
  const applyButton = () => nodes(tree).find(node => node.type === "button" && node.props.children === "Aplică profilul");
  assert.equal(applyButton().props.disabled, true);
  nodes(tree).find(node => node.type === "input" && node.props.type === "checkbox").props.onChange({target: {checked: true}});
  tree = render(); assert.equal(applyButton().props.disabled, false); applyButton().props.onClick();
  assert.equal(applied[0].profile.id, snapshot.profile.id);
});

test("financial readiness never changes manufacturing readiness; legacy path shows no raw dimensions", () => {
  const snapshot = repository.snapshotManufacturingProfile(profile, []);
  const work = {manufacturingSnapshot: snapshot, manufacturingResult: {signature: manufacturingApi.manufacturingSignature(configuration, snapshot), result}, acceptManufacturing() {}};
  const {ManufacturingProjectPanel} = load("src/features/manufacturing/project-manufacturing.tsx", {"../furniture/wardrobe-project-context": {useWardrobeProject: () => work}});
  const html = renderToStaticMarkup(React.createElement(ManufacturingProjectPanel, {configuration, financialComplete: true}));
  assert.match(html, /neverificat în atelier/); assert.match(html, /Financiar/); assert.match(html, /393/); assert.match(html, /Dimensiuni brute neconfirmate/);
  work.manufacturingSnapshot = null; work.manufacturingResult = null;
  const legacy = renderToStaticMarkup(React.createElement(ManufacturingProjectPanel, {configuration, financialComplete: true}));
  assert.match(legacy, /legacy · provizorie/); assert.match(legacy, /Adâncime totală neconfigurată/); assert.ok(!legacy.includes("393"));
});

test("workshop PDF DTO carries manufacturing warnings; client quotation excludes supplier/process internals", () => {
  const data = load("src/features/pdf/pdf-data.ts"), company = load("src/features/company/company-profile.ts");
  const input = {kind: "workshop", company: {...company.emptyCompanyProfile(), display_name: "Atelier sintetic"}, configuration,
    calculation: fixture("wardrobe-calculation"), estimate: fixture("wardrobe-estimate"), projectName: "Sintetic", projectId: null,
    manufacturingSnapshot: repository.snapshotManufacturingProfile(profile, []), manufacturingResult: result};
  const document = data.preparePdfData(input); assert.equal(document.manufacturing.result.panels.find(p => p.panel_id === "doors").raw_width_mm, "393");
  assert.match(document.manufacturing.result.warnings.join(" "), /verificare în atelier/);
  assert.throws(() => data.preparePdfData({...input, manufacturingResult: null}), /Așteaptă/);
  const client = data.preparePdfData({...input, kind: "quotation"});
  assert.equal(client.manufacturing, undefined); assert.equal(client.manufacturingSnapshot, undefined);
  assert.ok(!JSON.stringify(client).includes(profile.name)); assert.equal(client.selling_price_ron, input.estimate.selling_price_before_tax_ron);
  const legacy = data.preparePdfData({...input, manufacturingSnapshot: null, manufacturingResult: null}); assert.equal(legacy.manufacturing, undefined);
});
