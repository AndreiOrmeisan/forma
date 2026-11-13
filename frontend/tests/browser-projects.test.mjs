import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {loadTypeScriptModule} from "./helpers/load-typescript.mjs";

process.env.NEXT_PUBLIC_PROJECT_STORAGE="browser";
const api=loadTypeScriptModule("src/features/furniture/project-api.ts");
const {browserProjectPrefix}=loadTypeScriptModule("src/features/furniture/browser-project-store.ts");
const {initialPricing}=loadTypeScriptModule("src/features/furniture/wardrobe-pricing.ts");
const config=JSON.parse(readFileSync(new URL("./fixtures/wardrobe-project.json",import.meta.url),"utf8")).confirmed_configuration;

function environment(context) {
  const rows=new Map();
  const storage={get length(){return rows.size;},key:index=>[...rows.keys()][index] ?? null,getItem:key=>rows.get(key) ?? null,setItem:(key,value)=>rows.set(key,String(value)),removeItem:key=>rows.delete(key)};
  const previous=globalThis.window;
  globalThis.window={localStorage:storage};
  context.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  return {rows,storage};
}
function payload(name="Dulap browser") {return api.projectPayload(config,initialPricing(),{name,description:"",status:"draft"},null);}

test("default browser mode saves, lists and reopens after a fresh module load without HTTP",async context=>{
  const {rows}=environment(context);
  context.mock.method(globalThis,"fetch",()=>{throw new Error("Project CRUD must not contact a server");});
  const cap=await api.projectCapabilities();
  assert.equal(cap.enabled,true);assert.equal(cap.storage,"browser");assert.equal(cap.requires_auth,false);
  assert.equal((await api.projectRequest("projects")).total,0);
  const saved=await api.saveProject(payload(),null);
  assert.equal(rows.size,1);
  assert.ok(api.projectUuid.test(saved.id));
  assert.equal(saved.deviz_complete,null);
  const persisted=JSON.parse([...rows.values()][0]);
  assert.equal(persisted.storage_version,2);
  assert.ok(!("deviz_complete" in persisted.project) && !("selling_price_before_tax_ron" in persisted.project));
  assert.ok(!("image" in persisted.project) && !("interpretation" in persisted.project));
  const refreshed=loadTypeScriptModule("src/features/furniture/project-api.ts");
  assert.deepEqual(await refreshed.getProject(saved.id),saved);
  assert.equal((await refreshed.projectRequest("projects")).items[0].id,saved.id);
});

test("edit retains UUID, exact prices, status and allowances and detects stale revisions",async context=>{
  environment(context);
  const saved=await api.saveProject(payload(),null);
  const draft={...initialPricing(),pal_18:"0",hdf_3:"12,345678",pal:"10",hdf:"20",abs:"5",labor:"100,005",markup:"12.5"};
  const input=api.projectPayload({...config,width_mm:901},draft,{name:"Modificat",description:"Dormitor",status:"completed"},saved);
  const updated=await api.saveProject(input,saved);
  assert.equal(updated.id,saved.id);assert.equal(updated.revision,2);
  assert.equal(updated.created_at,saved.created_at);assert.ok(updated.updated_at>saved.updated_at);
  assert.equal(updated.status,"completed");assert.equal(updated.labor_cost,"100.005");
  const restored=api.restorePricing(updated);
  assert.equal(restored.pal_18,"0");assert.equal(restored.hdf_3,"12.345678");assert.equal(restored.abs_0_4,"");
  assert.equal(restored.pal,"10");assert.equal(restored.markup,"12.5");
  await assert.rejects(api.saveProject(input,saved),error=>error.status===409);
  assert.deepEqual(await api.getProject(saved.id),updated);
});

test("duplicate gets new identity/draft; deletion only removes its selected record",async context=>{
  const {rows}=environment(context);
  const input={...payload(),status:"completed"};
  const original=await api.saveProject(input,null);
  rows.set("forma-mode","professional");rows.set("other-app-data","keep");
  const copy=await api.projectRequest(`projects/${original.id}/duplicate`,{method:"POST"});
  assert.notEqual(copy.id,original.id);assert.equal(copy.status,"draft");assert.match(copy.name,/Copie/);
  assert.ok(copy.created_at>original.created_at);
  assert.deepEqual(await api.getProject(original.id),original);
  await assert.rejects(api.projectRequest(`projects/${copy.id}?expected_revision=2`,{method:"DELETE"}),error=>error.status===409);
  await api.projectRequest(`projects/${copy.id}?expected_revision=1`,{method:"DELETE"});
  await assert.rejects(api.getProject(copy.id),error=>error.status===404);
  assert.equal((await api.projectRequest("projects")).total,1);
  assert.equal(rows.get("forma-mode"),"professional");assert.equal(rows.get("other-app-data"),"keep");
});

test("pagination and deterministic sorting use current input records",async context=>{
  environment(context);
  await api.saveProject(payload("Primul"),null);
  const last=await api.saveProject(payload("Ultimul"),null);
  const page=await api.projectRequest("projects?limit=1&offset=0");
  assert.equal(page.total,2);assert.equal(page.items.length,1);
  const next=await api.projectRequest("projects?limit=1&offset=1");
  assert.notEqual(page.items[0].id,next.items[0].id);
  assert.equal((await api.getProject(last.id)).name,"Ultimul");
  await assert.rejects(api.projectRequest("projects?limit=51"));
  await assert.rejects(api.projectRequest("projects?offset=-1"));
});

test("quota and blocked storage failures do not report success or replace saved data",async context=>{
  const {rows,storage}=environment(context);
  const saved=await api.saveProject(payload(),null);
  const before=rows.get(browserProjectPrefix+saved.id);
  context.mock.method(storage,"setItem",()=>{throw new DOMException("Quota exceeded","QuotaExceededError");});
  await assert.rejects(api.saveProject({...payload(),name:"Not saved"},saved),/Spațiul browserului/);
  assert.equal(rows.get(browserProjectPrefix+saved.id),before);
  Object.defineProperty(globalThis.window,"localStorage",{get(){throw new DOMException("Denied","SecurityError");}});
  const cap=await api.projectCapabilities();assert.equal(cap.enabled,false);assert.match(cap.reason,/nu permite/);
});

test("corrupt or future records remain untouched while other projects remain accessible",async context=>{
  const {rows}=environment(context);
  const saved=await api.saveProject(payload(),null);
  const bad=crypto.randomUUID();rows.set(browserProjectPrefix+bad,"{bad-json");
  const page=await api.projectRequest("projects");assert.equal(page.total,1);assert.ok(page.warnings.length);
  await assert.rejects(api.getProject(bad),error=>error.status===409);
  assert.equal(rows.get(browserProjectPrefix+bad),"{bad-json");
  const key=browserProjectPrefix+saved.id;
  const raw=JSON.parse(rows.get(key));raw.project.calculation_version="future-version";rows.set(key,JSON.stringify(raw));
  const historical=await api.getProject(saved.id);
  assert.equal(historical.compatible,false);assert.ok(historical.warnings.length);
  const before=rows.get(key);
  await assert.rejects(api.saveProject(payload(),historical),error=>error.status===409);
  assert.equal(rows.get(key),before);
});

test("invalid data, extra image fields and invalid prices are rejected before any write",async context=>{
  const {rows}=environment(context);
  for(const changes of [{name:" "},{confirmed_configuration:{...config,width_mm:0}},{labor_cost:"-1"},{waste_allowances:{pal:"101",hdf:"0",abs:"0"}},{image:"data:image/png;base64,not-allowed"},{schema_version:2}]) {
    await assert.rejects(api.saveProject({...payload(),...changes},null));
  }
  assert.equal(rows.size,0);
});

test("API mode does not silently fall back to browser storage on unauthorized requests",async context=>{
  const {rows}=environment(context);
  context.after(()=>{process.env.NEXT_PUBLIC_PROJECT_STORAGE="browser";});
  process.env.NEXT_PUBLIC_PROJECT_STORAGE="api";
  context.mock.method(globalThis,"fetch",async()=>Response.json({}, {status:401}));
  await assert.rejects(api.saveProject(payload(),null),error=>error.status===401);
  assert.equal(rows.size,0);
});

test("browser mode profile explains same-device storage and does not require sign-in",()=>{
  const {AccountPanel}=loadTypeScriptModule("src/features/auth/account-panel.tsx");
  const html=renderToStaticMarkup(React.createElement(AccountPanel));
  assert.match(html,/Mod POC/);assert.match(html,/Nu ai nevoie de cont/);assert.match(html,/Nu se sincronizează/);
  assert.ok(!html.includes("Continuă cu Google"));
});

test("saved editor restores inputs even when the calculation backend is unavailable",async context=>{
  environment(context);
  const saved=await api.saveProject(payload(),null);
  const state=[], effects=[];let cursor=0;
  const project={savedProject:null,confirmed:null,pricing:initialPricing(),restoreProject(value){this.savedProject=value;this.confirmed=value.confirmed_configuration;this.pricing=api.restorePricing(value);}};
  // The real editor uses callbacks, so expose a stable bound restore method.
  project.restoreProject=project.restoreProject.bind(project);
  const {ProjectEditor}=loadTypeScriptModule("src/features/furniture/project-editor.tsx",{
    react:{...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==="function"?initial():initial;return [state[i],value=>{state[i]=typeof value==="function"?value(state[i]):value;}];},useEffect(effect){effects.push(effect);}},
    "next/navigation":{useSearchParams:()=>new URLSearchParams(`id=${saved.id}`),useRouter:()=>({push(){}})},
    "@/config/domains":loadTypeScriptModule("src/config/domains.ts"),
    "../auth/auth-context":{useAuth:()=>({user:null,loading:false})},
    "./wardrobe-project-context":{useWardrobeProject:()=>project},
    "./project-api":{...api,projectRequest:async()=>{throw new Error("Backend offline");}},
  });
  const component=ProjectEditor().type;
  const render=()=>{cursor=0;return component({id:saved.id});};
  render();effects.shift()();
  for(let i=0;i<12;i++)await Promise.resolve();
  const tree=render();
  assert.equal(project.savedProject.id,saved.id);
  assert.equal(project.confirmed.width_mm,800);
  // State contains the actual recovery message; financial totals were not fabricated.
  const loaded=state.find(value=>value?.project?.id===saved.id);
  assert.match(loaded.estimateError,/Proiectul a fost încărcat/);
  assert.equal(loaded.estimate,null);
  assert.equal(tree.type,"main");
});

test("pricing accepts a late backend estimate only while editable inputs still match",()=>{
  const fixture=JSON.parse(readFileSync(new URL("./fixtures/wardrobe-estimate.json",import.meta.url),"utf8"));
  const state=[];let cursor=0;
  const project={pricing:initialPricing(),updatePricing(){}};
  const {WardrobePricingForm}=loadTypeScriptModule("src/features/furniture/wardrobe-pricing-form.tsx",{
    react:{...React,useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==="function"?initial():initial;return [state[i],()=>{}];},useEffect:()=>{},useRef:()=>({current:null})},
    "./wardrobe-project-context":{useWardrobeProject:()=>project},
  });
  const render=initialEstimate=>{cursor=0;return WardrobePricingForm({configuration:config,initialEstimate});};
  render(undefined);
  let tree=render(fixture);
  assert.ok(tree.props.children.some(child=>child?.props?.estimate===fixture));
  project.pricing={...project.pricing,pal_18:"25"};
  tree=render(fixture);
  assert.ok(!tree.props.children.some(child=>child?.props?.estimate===fixture));
});
