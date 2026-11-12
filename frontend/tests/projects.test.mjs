import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/wardrobe-project.json", import.meta.url), "utf8"));
const api = loadTypeScriptModule("src/features/furniture/project-api.ts");
const {initialPricing} = loadTypeScriptModule("src/features/furniture/wardrobe-pricing.ts");
const domainConfig = loadTypeScriptModule("src/config/domains.ts");
const {ProjectCards, DeleteProjectDialog} = loadTypeScriptModule("src/features/furniture/project-list.tsx", {"@/config/domains": domainConfig});

test("saved API record restores exact inputs and distinguishes missing from zero", () => {
  assert.equal(api.isProject(fixture), true);
  const saved = structuredClone(fixture);
  saved.manual_price_catalog = [{item_code:"pal_18", item_name:"PAL 18 mm", unit:"m²", unit_price_ron:"0", currency:"RON", source_type:"manual", source_name:"Introducere manuală", updated_at:"2026-11-12T10:00:00Z"}];
  saved.labor_cost = "200.005";
  saved.markup_percentage = "12.5";
  saved.waste_allowances = {pal:"10",hdf:"20",abs:"5"};
  const draft = api.restorePricing(saved);
  assert.equal(draft.pal_18, "0");
  assert.equal(draft.hdf_3, "");
  assert.equal(draft.labor, "200.005");
  const payload = api.projectPayload(saved.confirmed_configuration, draft, {name:"  Proiect  ",description:"",status:"draft"}, saved);
  assert.equal(payload.name, "Proiect");
  assert.equal(payload.manual_price_catalog[0].updated_at, saved.manual_price_catalog[0].updated_at);
  assert.equal(payload.waste_allowances.abs, "5");
  assert.equal(payload.markup_percentage, "12.5");
  assert.ok(!("image" in payload) && !("totals" in payload));
  const original = {...draft,pal_18:"1.20"};
  assert.equal(api.pricingFingerprint({...draft,pal_18:"01,200"}), api.pricingFingerprint(original));
  assert.notEqual(api.pricingFingerprint({...draft,pal_18:""}), api.pricingFingerprint({...draft,pal_18:"0"}));
});

test("save creates once then PATCHes the same UUID with revision protection", async context => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {calls.push({url, options}); return Response.json(fixture);});
  const payload = api.projectPayload(fixture.confirmed_configuration, initialPricing(), {name:fixture.name,description:"",status:"draft"}, null);
  const saved = await api.saveProject(payload, null);
  await api.saveProject({...payload, name:"Editat"}, saved);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[1].options.method, "PATCH");
  assert.ok(calls[1].url.endsWith(`/projects/${fixture.id}`));
  const patch = JSON.parse(calls[1].options.body);
  assert.equal(patch.expected_revision, fixture.revision);
  assert.equal(patch.name, "Editat");
  assert.ok(!("created_at" in patch) && !("construction_profile_id" in patch));
});

test("open validates UUID and errors never masquerade as successful saves", async context => {
  context.mock.method(globalThis, "fetch", async () => Response.json({detail:"internal/path"}, {status:409}));
  await assert.rejects(api.getProject("invalid"), /invalid/);
  await assert.rejects(api.getProject(fixture.id), /altă sesiune/);
  context.mock.method(globalThis, "fetch", async () => Response.json({}));
  await assert.rejects(api.saveProject({}, null), /nu a confirmat/);
  const capability = await api.projectCapabilities();
  assert.equal(capability.enabled, false);
});

test("project list renders empty, status, dimensions, completeness and UUID links", () => {
  const render = projects => renderToStaticMarkup(React.createElement(ProjectCards, {projects,busy:false,onDuplicate:()=>{},onDelete:()=>{}}));
  assert.match(render([]), /Nu ai încă proiecte salvate/);
  const html = render([fixture]);
  assert.match(html, /800 × 2000 × 600 mm/);
  assert.match(html, /În lucru/);
  assert.match(html, /Deviz incomplet/);
  assert.ok(html.includes(`deschide?id=${fixture.id}`));
  assert.match(render([{...fixture,status:"completed",deviz_complete:true}]), /Finalizat/);
  assert.match(render([{...fixture,status:"completed",deviz_complete:true}]), /Prețuri complete/);
});

test("delete first requests confirmation; dialog explicitly names its target", () => {
  let target = null;
  const tree = ProjectCards({projects:[fixture],busy:false,onDuplicate:()=>{},onDelete:project=>{target=project;}});
  const article = tree.props.children[0];
  const actions = article.props.children[4].props.children;
  actions[2].props.onClick();
  assert.equal(target.id, fixture.id);
  const html = renderToStaticMarkup(React.createElement(DeleteProjectDialog, {project:fixture,busy:false,onCancel:()=>{},onConfirm:()=>{}}));
  assert.match(html, /Ștergi proiectul/);
  assert.match(html, /Șterge definitiv/);
  assert.match(html, /Renunță/);
  assert.ok(html.includes(fixture.name));
  assert.match(html, /<dialog/);
});

test("duplicate and delete API calls target only the selected project", async context => {
  const calls = [];
  context.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({url,options});
    return options.method === "DELETE" ? new Response(null,{status:204}) : Response.json({...fixture,id:"00000000-0000-4000-8000-000000000000"});
  });
  await api.projectRequest(`projects/${fixture.id}/duplicate`, {method:"POST"});
  await api.projectRequest(`projects/${fixture.id}?expected_revision=${fixture.revision}`, {method:"DELETE"});
  assert.ok(calls[0].url.endsWith(`/${fixture.id}/duplicate`));
  assert.equal(calls[1].options.method, "DELETE");
  assert.ok(calls[1].url.includes(`expected_revision=${fixture.revision}`));
});

test("production save UI is disabled before backend availability is confirmed", () => {
  const {ProjectSaveForm} = loadTypeScriptModule("src/features/furniture/project-save-form.tsx", {
    "./wardrobe-project-context":{useWardrobeProject:()=>({confirmed:fixture.confirmed_configuration,pricing:initialPricing(),savedProject:null,markSaved:()=>{}})},
  });
  const html = renderToStaticMarkup(React.createElement(ProjectSaveForm));
  assert.match(html, /fieldset disabled/);
  assert.match(html, /Imaginea originală nu este salvată permanent/);
  assert.match(html, /Verificăm disponibilitatea/);
});

test("project context restores editable state without inventing an interpretation or image", () => {
  let state;
  const {WardrobeProjectProvider} = loadTypeScriptModule("src/features/furniture/wardrobe-project-context.tsx", {
    react:{...React,useCallback:fn=>fn,useState(initial){state ??= initial; return [state,next=>{state=typeof next==="function"?next(state):next;}];}},
    "@/components/image-upload/image-draft-context":{useImageDraft:()=>({image:null})},
  });
  const render = () => WardrobeProjectProvider({children:null}).props.value;
  render().restoreProject(fixture);
  let project = render();
  assert.equal(project.savedProject.id, fixture.id);
  assert.equal(project.draft.width_mm, "800");
  assert.equal(project.interpretation, null);
  project.updateField("width_mm", "901");
  project = render();
  assert.equal(project.confirmed, null);
  assert.equal(project.savedProject.confirmed_configuration.width_mm, 800);
  assert.equal(project.confirm(), true);
  project = render();
  assert.equal(project.confirmed.width_mm, 901);
  assert.equal(project.savedProject.id, fixture.id);
});

test("edited save form waits for backend confirmation before reporting success", async () => {
  const state = [];
  let cursor = 0, resolveSave, marked = null, captured;
  const pending = new Promise(resolve => {resolveSave = resolve;});
  const {ProjectSaveForm} = loadTypeScriptModule("src/features/furniture/project-save-form.tsx", {
    react:{...React,useEffect:()=>{},useState(initial){
      const index = cursor++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], next => {state[index] = typeof next === "function" ? next(state[index]) : next;}];
    }},
    "./project-api":{...api,saveProject:async (payload,saved)=>{captured={payload,saved};return pending;}},
    "./wardrobe-project-context":{useWardrobeProject:()=>({confirmed:fixture.confirmed_configuration,draft:{width_mm:"800",height_mm:"2000",depth_mm:"600",doors_count:"2",shelves_count:"3"},pricing:initialPricing(),savedProject:fixture,markSaved:value=>{marked=value;}})},
  });
  const render = () => {cursor=0; return ProjectSaveForm({available:true});};
  let tree = render();
  let form = tree.props.children.find(child => child?.type === "form");
  const nameInput = form.props.children.props.children[0].props.children[1];
  nameInput.props.onChange({target:{value:"Dulap editat"}});
  tree = render();
  form = tree.props.children.find(child => child?.type === "form");
  form.props.onSubmit({preventDefault(){}});
  assert.equal(captured.payload.name, "Dulap editat");
  assert.equal(captured.saved.id, fixture.id);
  assert.equal(marked, null);
  resolveSave({...fixture,name:"Dulap editat",revision:2});
  await pending;
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(marked.id, fixture.id);
  assert.equal(marked.revision, 2);
});
