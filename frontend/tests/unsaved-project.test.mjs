import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { readFileSync } from "node:fs";
import { loadTypeScriptModule as load } from "./helpers/load-typescript.mjs";

const fixture = JSON.parse(readFileSync("tests/fixtures/wardrobe-project.json", "utf8"));
const api = load("src/features/furniture/project-api.ts");
const {initialPricing} = load("src/features/furniture/wardrobe-pricing.ts");
const {configurationToDraft} = load("src/features/furniture/wardrobe-configuration.ts");
const {hasUnsavedProject, withinProjectWorkspace} = load("src/features/furniture/unsaved-project.ts");
const {migrateManualSnapshots} = load("src/features/furniture/project-price-snapshot.ts");

// Component-handler harness, not a DOM/browser emulator. Effects are explicit.
function hooks() {
  const values = [], effects = [];
  let index = 0;
  return {
    react: {...React,
      useCallback: fn => fn,
      useState(initial) {
        const slot = index++;
        if (!(slot in values)) values[slot] = typeof initial === "function" ? initial() : initial;
        return [values[slot], next => {values[slot] = typeof next === "function" ? next(values[slot]) : next;}];
      },
      useRef(initial) {const slot = index++; return values[slot] ??= {current: initial};},
      useLayoutEffect(fn) {index++; fn();},
      useEffect(fn, deps) {
        const slot = index++, previous = values[slot];
        if (!previous || !deps || deps.some((value, i) => value !== previous[i])) {
          values[slot] = deps || []; effects.push(fn);
        }
      },
    },
    render(fn) {index = 0; return fn();},
    mount() {return effects.splice(0).map(fn => fn()).filter(Boolean);},
  };
}
function nodes(element) {
  if (!element || typeof element !== "object") return [];
  return [element, ...React.Children.toArray(element.props?.children).flatMap(nodes)];
}
function deferred() {let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject};}
function blank() {return {projectName: "", projectDescription: "", projectStatus: "draft", imageUrl: null,
  draft: null, confirmed: null, pricing: initialPricing(), priceSnapshots: [], savedProject: null};}
function restored() {return {...blank(), projectName: fixture.name, projectDescription: fixture.description || "",
  projectStatus: fixture.status, draft: configurationToDraft(fixture.confirmed_configuration),
  confirmed: fixture.confirmed_configuration, pricing: api.restorePricing(fixture),
  priceSnapshots: migrateManualSnapshots(fixture.manual_price_catalog, fixture.price_snapshots), savedProject: fixture};}

test("invalid replacement retains the current image and reports the validation message", async () => {
  const h = hooks(), oldImage = {url: "blob:old"}, commits = [];
  const {SketchUploader} = load("src/components/image-upload/sketch-uploader.tsx", {
    react: h.react, "./image-draft-context": {useImageDraft: () => ({image: oldImage, setImage: image => commits.push(image)})},
    "./validate-image": {validateImage: async () => {throw new Error("Fișier invalid");}},
  });
  let tree = h.render(() => SketchUploader({onContinue() {}}));
  await nodes(tree).find(node => node.props?.onSelect).props.onSelect({});
  tree = h.render(() => SketchUploader({onContinue() {}}));
  assert.deepEqual(commits, []);
  assert.equal(nodes(tree).find(node => node.props?.role === "alert").props.children, "Fișier invalid");
});

test("cancelled camera and gallery selection do not call the replacement handler", () => {
  const h = hooks(), selected = [];
  const {UploadActions} = load("src/components/image-upload/upload-actions.tsx", {react: h.react});
  const tree = h.render(() => UploadActions({onSelect: file => selected.push(file)}));
  for (const input of nodes(tree).filter(node => node.type === "input")) {
    input.props.onChange({target: {files: [], value: ""}});
    input.props.onChange({target: {files: null, value: ""}});
  }
  assert.deepEqual(selected, []);
});

test("overlapping validations commit only the newest valid image and revoke stale candidates", async context => {
  const h = hooks(), first = deferred(), second = deferred(), commits = [], revoked = [];
  context.mock.method(URL, "revokeObjectURL", url => revoked.push(url));
  const {SketchUploader} = load("src/components/image-upload/sketch-uploader.tsx", {
    react: h.react, "./image-draft-context": {useImageDraft: () => ({image: {url: "blob:old"}, setImage: next => commits.push(next)})},
    "./validate-image": {validateImage: file => file === 1 ? first.promise : second.promise},
  });
  const tree = h.render(() => SketchUploader({onContinue() {}}));
  const select = nodes(tree).find(node => node.props?.onSelect).props.onSelect;
  const a = select(1), b = select(2);
  assert.equal(commits.length, 0);
  second.resolve({url: "blob:new"}); await b;
  first.resolve({url: "blob:stale"}); await a;
  assert.deepEqual(commits, [{url: "blob:new"}]);
  assert.deepEqual(revoked, ["blob:stale"]);
});

test("unmount during validation revokes the candidate without changing the active image", async context => {
  const h = hooks(), waiting = deferred(), revoked = [], commits = [];
  context.mock.method(URL, "revokeObjectURL", url => revoked.push(url));
  const {SketchUploader} = load("src/components/image-upload/sketch-uploader.tsx", {
    react: h.react, "./image-draft-context": {useImageDraft: () => ({image: {url: "blob:active"}, setImage: next => commits.push(next)})},
    "./validate-image": {validateImage: () => waiting.promise},
  });
  const tree = h.render(() => SketchUploader({onContinue() {}}));
  const cleanup = h.mount();
  const selecting = nodes(tree).find(node => node.props?.onSelect).props.onSelect({});
  cleanup.forEach(fn => fn()); waiting.resolve({url: "blob:late"}); await selecting;
  assert.deepEqual(commits, []); assert.deepEqual(revoked, ["blob:late"]);
});

test("image provider revokes only obsolete URLs on replacement, delete and final teardown", context => {
  const h = hooks(), revoked = [];
  context.mock.method(URL, "revokeObjectURL", url => revoked.push(url));
  const {ImageDraftProvider} = load("src/components/image-upload/image-draft-context.tsx", {react: h.react});
  const render = () => h.render(() => ImageDraftProvider({children: null})).props.value;
  let state = render(); const cleanup = h.mount();
  state.setImage({url: "blob:first"}); state = render();
  state.setImage({url: "blob:first"}); assert.deepEqual(revoked, []);
  state.setImage({url: "blob:second"}); assert.deepEqual(revoked, ["blob:first"]);
  state = render(); assert.equal(state.image.url, "blob:second");
  state.setImage(null); state = render(); assert.equal(state.image, null);
  assert.deepEqual(revoked, ["blob:first", "blob:second"]);
  state.setImage({url: "blob:last"}); cleanup.forEach(fn => fn());
  assert.deepEqual(revoked, ["blob:first", "blob:second", "blob:last"]);
});

test("unnamed work is dirty, pristine and unchanged saved inputs are clean", () => {
  assert.equal(hasUnsavedProject(blank()), false);
  assert.equal(hasUnsavedProject({...blank(), imageUrl: "blob:sketch"}), true);
  assert.equal(hasUnsavedProject({...blank(), draft: configurationToDraft(fixture.confirmed_configuration)}), true);
  assert.equal(hasUnsavedProject({...blank(), pricing: {...initialPricing(), pal_18: "0"}}), true);
  assert.equal(hasUnsavedProject(restored()), false);
  for (const patch of [{projectName: "Editat"}, {projectDescription: "Nou"}, {projectStatus: "completed"},
    {pricing: {...restored().pricing, labor: "50"}}, {confirmed: null},
    {draft: {...restored().draft, width_mm: ""}}, {draft: {...restored().draft, width_mm: "900"}}]) {
    assert.equal(hasUnsavedProject({...restored(), ...patch}), true, JSON.stringify(patch));
  }
});

test("valid image commit resets configuration/prices; same active image retains unsaved edits", async () => {
  const h = hooks(); let image = {url: "blob:first"};
  const saved = deferred(); let saveCalls = 0;
  const {WardrobeProjectProvider} = load("src/features/furniture/wardrobe-project-context.tsx", {
    react: h.react, "@/components/image-upload/image-draft-context": {useImageDraft: () => ({image, setImage: next => {image = next;}})},
    "../auth/auth-context": {useAuth: () => ({user: null})},
    "./persist-project-draft": {persistProjectDraft: () => {saveCalls++; return saved.promise;}},
  });
  const render = () => h.render(() => WardrobeProjectProvider({children: null})).props.value;
  let state = render(); state.restoreProject(fixture); state = render();
  state.updatePricing("labor", "50"); state.updateProjectDescription("Pending"); state = render();
  assert.equal(render().pricing.labor, "50");
  const before = {draft: state.draft, confirmed: state.confirmed, pricing: state.pricing, savedProject: state.savedProject};
  const uploadHooks = hooks();
  const {SketchUploader} = load("src/components/image-upload/sketch-uploader.tsx", {
    react: uploadHooks.react,
    "./image-draft-context": {useImageDraft: () => ({image, setImage: next => {image = next;}})},
    "./validate-image": {validateImage: async () => {throw new Error("Invalid image");}},
  });
  const uploader = uploadHooks.render(() => SketchUploader({onContinue() {}}));
  await nodes(uploader).find(node => node.props?.onSelect).props.onSelect({});
  state = render();
  assert.equal(image.url, "blob:first");
  assert.deepEqual({draft: state.draft, confirmed: state.confirmed, pricing: state.pricing, savedProject: state.savedProject}, before);
  // Provider identity survives route changes; repeated saves share one pending write.
  const a = state.saveDraft(), b = state.saveDraft(); assert.equal(a, b); assert.equal(saveCalls, 1);
  saved.resolve({...fixture, revision: 2, labor_cost: "50", description: "Pending"}); await a;
  state = render(); assert.equal(state.savedProject.revision, 2); assert.equal(state.saving, false);
  image = {url: "blob:replacement"}; render(); state = render();
  assert.equal(state.confirmed, null); assert.equal(state.draft, null);
  assert.equal(state.savedProject, null); assert.deepEqual(state.pricing, initialPricing());
});

test("persistence failures reject without a success record and existing revisions are forwarded", async () => {
  let result = deferred(), writes = [];
  const {persistProjectDraft} = load("src/features/furniture/persist-project-draft.ts", {
    "./project-api": {...api, projectCapabilities: async () => ({enabled: true}),
      saveProject: (payload, previous) => {writes.push({payload, previous}); return result.promise;}},
  });
  const work = restored();
  const failed = persistProjectDraft(work); result.reject(new Error("Storage full"));
  await assert.rejects(failed, /Storage full/);
  assert.equal(work.savedProject.revision, 1);
  assert.equal(writes[0].previous, fixture);
  result = deferred(); const successful = persistProjectDraft(work);
  result.resolve({...fixture, revision: 2}); assert.equal((await successful).revision, 2);
  await assert.rejects(persistProjectDraft({...work, confirmed: null}), /Confirmă/);
  await assert.rejects(persistProjectDraft({...work, projectName: ""}), /nume/);
});

test("navigation dialog keeps work after save failure and resumes only after successful clean persistence", async () => {
  const h = hooks(); let callbacks, writes = 0, resumes = 0, work = restored(), request = deferred();
  work = {...work, projectName: "Editat"};
  const project = () => ({...work, saving: false, updateProjectName(name) {work = {...work, projectName: name};},
    resetDraft() {work = blank();}, saveDraft() {writes++; return request.promise;}});
  const originalWindow = globalThis.window;
  globalThis.window = {};
  try {
    const {ProjectNavigationGuard} = load("src/features/furniture/project-navigation-guard.tsx", {
      react: h.react, "next/navigation": {useRouter: () => ({push() {}})},
      "./wardrobe-project-context": {useWardrobeProject: project},
      "./navigation-protection": {protectProjectNavigation: (browser, options) => {callbacks = options; return () => {}; }},
    });
    const render = () => {const tree = h.render(() => ProjectNavigationGuard({children: null})); h.mount(); return tree;};
    render(); callbacks.request({href: "https://example.test/", resume() {resumes++;}});
    let tree = render();
    const button = (tree, text) => nodes(tree).find(node => node.type === "button" && node.props.children === text);
    assert.ok(button(tree, "Rămâi")); assert.ok(button(tree, "Continuă fără salvare"));
    button(tree, "Salvează proiectul").props.onClick();
    assert.equal(resumes, 0); assert.equal(writes, 1);
    request.reject(new Error("Nu există spațiu pentru salvare")); await new Promise(resolve => setImmediate(resolve));
    tree = render();
    assert.equal(resumes, 0); assert.equal(work.projectName, "Editat");
    assert.match(nodes(tree).find(node => node.props?.role === "alert").props.children, /spațiu/);
    request = deferred(); button(tree, "Salvează proiectul").props.onClick();
    request.resolve(fixture); await new Promise(resolve => setImmediate(resolve));
    tree = render(); assert.equal(resumes, 0, "a resolved request alone must not hide newer unsaved edits");
    work = {...work, savedProject: {...fixture, name: "Editat", revision: 2}};
    render(); assert.equal(resumes, 1);
  } finally {if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;}
});

// Deterministic event/history model. Native browser dialogs and Next's actual
// popstate scheduling still require manual browser verification.
function browserHarness(context, {dirty = true, entries} = {}) {
  class Anchor {
    constructor(href, target = "") {this.href = href; this.target = target;}
    closest() {return this;}
    hasAttribute() {return false;}
  }
  const originalElement = globalThis.Element;
  globalThis.Element = Anchor;
  context.after(() => {if (originalElement === undefined) delete globalThis.Element; else globalThis.Element = originalElement;});
  const listeners = {}, documentListeners = {}, queue = [], requests = [], navigated = [];
  let left = 0, saving = false, index = (entries?.length || 1) - 1;
  const stack = entries || [{href: "https://example.test/forma/domenii/mobilier/proiect-nou/verificare/", state: {__NA: true, tree: ["next"]}}];
  const browser = {
    location: {href: stack[index].href},
    document: {addEventListener(type, fn) {documentListeners[type] = fn;}, removeEventListener(type) {delete documentListeners[type];}},
    addEventListener(type, fn) {listeners[type] = fn;}, removeEventListener(type) {delete listeners[type];},
    history: {
      get state() {return stack[index].state;},
      pushState(state, title, url) {stack.splice(index + 1); stack.push({state, href: new URL(url || browser.location.href, browser.location.href).href}); index++; browser.location.href = stack[index].href;},
      replaceState(state, title, url) {stack[index] = {state, href: new URL(url || browser.location.href, browser.location.href).href}; browser.location.href = stack[index].href;},
      go(delta) {queue.push(() => {index += delta; browser.location.href = stack[index].href; listeners.popstate?.(event({state: stack[index].state}));});},
    },
  };
  function event(extra = {}) {return {button: 0, defaultPrevented: false, stopped: false,
    preventDefault() {this.defaultPrevented = true;}, stopImmediatePropagation() {this.stopped = true;}, ...extra};}
  const {protectProjectNavigation} = load("src/features/furniture/navigation-protection.ts");
  const dispose = protectProjectNavigation(browser, {dirty: () => dirty, saving: () => saving,
    request: request => requests.push(request), leave: () => {left++; dirty = false;}, navigate: href => navigated.push(href)});
  return {browser, requests, navigated, dispose, get left() {return left;},
    dirty(value) {dirty = value;}, saving(value) {saving = value;},
    click(href, target) {const e = event({target: new Anchor(href, target)}); documentListeners.click(e); return e;},
    unload() {const e = event(); listeners.beforeunload(e); return e;},
    flush() {while (queue.length) queue.shift()();},
  };
}

test("internal Link is intercepted; remain preserves work; explicit discard resumes once", context => {
  const h = browserHarness(context);
  const e = h.click("https://example.test/forma/domenii/mobilier/");
  assert.equal(e.defaultPrevented, true); assert.equal(e.stopped, true);
  assert.equal(h.left, 0); assert.equal(h.requests.length, 1);
  // Staying means not invoking the pending continuation.
  assert.equal(h.unload().defaultPrevented, true);
  h.requests[0].resume(); assert.equal(h.left, 1); assert.equal(h.navigated.length, 1);
  assert.equal(h.unload().defaultPrevented, false); h.dispose();
});

test("supplier catalog opens separately, workflow return keeps draft and clean navigation has no prompt", context => {
  const h = browserHarness(context);
  assert.equal(h.click("https://example.test/forma/domenii/mobilier/furnizori/", "_blank").defaultPrevented, false);
  assert.equal(h.click("https://example.test/forma/domenii/mobilier/proiect-nou/").defaultPrevented, false);
  assert.equal(h.requests.length, 0); assert.equal(h.left, 0);
  assert.equal(h.unload().defaultPrevented, true);
  h.dirty(false); assert.equal(h.unload().defaultPrevented, false);
  h.saving(true); assert.equal(h.unload().defaultPrevented, true);
  h.saving(false); h.click("https://example.test/forma/");
  assert.equal(h.requests.length, 0); h.dispose();
});

test("tracked browser back/forward returns to the editor before asking and preserves Next history state", context => {
  const h = browserHarness(context, {dirty: false});
  const start = h.browser.location.href;
  h.browser.history.pushState({__NA: true, tree: ["dashboard"]}, "", "/forma/");
  h.browser.history.pushState({__NA: true, tree: ["editor"]}, "", start);
  h.dirty(true); h.browser.history.go(-1); h.flush();
  assert.equal(h.browser.location.href, start); assert.equal(h.requests.length, 1);
  assert.deepEqual(h.browser.history.state.tree, ["editor"]); assert.equal(h.browser.history.state.__NA, true);
  h.requests[0].resume(); h.flush(); assert.equal(h.browser.location.href, "https://example.test/forma/");
  // Move back to editor, then attempt forward from a dirty editor to dashboard.
  h.browser.history.go(1); h.flush();
  h.browser.history.pushState({__NA: true}, "", "/forma/");
  h.browser.history.go(-1); h.flush(); h.dirty(true);
  h.browser.history.go(1); h.flush();
  assert.equal(h.browser.location.href, start); assert.equal(h.requests.length, 2);
  h.requests[1].resume(); h.flush(); assert.equal(h.browser.location.href, "https://example.test/forma/"); h.dispose();
});

test("older untracked back entries restore the source URL and require explicit continuation", context => {
  const source = "https://example.test/forma/domenii/mobilier/proiect-nou/verificare/";
  const h = browserHarness(context, {entries: [{href: "https://example.test/forma/", state: null}, {href: source, state: {__NA: true}}]});
  h.browser.history.go(-1); h.flush();
  assert.equal(h.browser.location.href, source); assert.equal(h.left, 0);
  h.requests[0].resume(); assert.deepEqual(h.navigated, ["https://example.test/forma/"]); h.dispose();
});

test("GitHub Pages keeps the providers above routes without depending on cacheComponents", () => {
  const previous = process.env.GITHUB_PAGES; process.env.GITHUB_PAGES = "true";
  try {assert.equal(load("next.config.ts").default.cacheComponents, false);}
  finally {if (previous === undefined) delete process.env.GITHUB_PAGES; else process.env.GITHUB_PAGES = previous;}
  const root = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(root, /<ProjectWorkspace>/);
  for (const file of ["src/app/domenii/mobilier/proiect-nou/layout.tsx", "src/app/domenii/mobilier/proiecte/deschide/page.tsx"]) {
    assert.doesNotMatch(readFileSync(file, "utf8"), /<ImageDraftProvider|<WardrobeProjectProvider/);
  }
  assert.equal(withinProjectWorkspace("https://example.test/forma/domenii/mobilier/proiect-nou/", "https://example.test/forma/domenii/mobilier/proiect-nou/rezultat/"), true);
  assert.equal(withinProjectWorkspace("https://example.test/forma/domenii/mobilier/proiecte/deschide?id=a", "https://example.test/forma/domenii/mobilier/proiecte/deschide?id=b"), false);
});
