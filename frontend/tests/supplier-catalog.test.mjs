import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {loadTypeScriptModule as load} from "./helpers/load-typescript.mjs";

process.env.NEXT_PUBLIC_PROJECT_STORAGE="browser";
const model=load("src/features/catalog/catalog-model.ts");
const repo=load("src/features/catalog/catalog-repository.ts");
const source=load("src/features/catalog/catalog-price-source.ts");
const pricing=load("src/features/furniture/wardrobe-pricing.ts");
const snapshots=load("src/features/furniture/project-price-snapshot.ts");
const api=load("src/features/furniture/project-api.ts");
const date="2026-11-13T10:00:00.000Z";
const fixture=JSON.parse(readFileSync(new URL("./fixtures/wardrobe-project.json",import.meta.url),"utf8"));
const calculation=JSON.parse(readFileSync(new URL("./fixtures/wardrobe-calculation.json",import.meta.url),"utf8"));
const estimate=JSON.parse(readFileSync(new URL("./fixtures/wardrobe-estimate.json",import.meta.url),"utf8"));
function environment(context){const rows=new Map(),previous=globalThis.window;globalThis.window={localStorage:{getItem:k=>rows.get(k) ?? null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k),get length(){return rows.size;},key:i=>Array.from(rows.keys())[i] ?? null},setTimeout,clearTimeout};context.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});return rows;}
function supplier(name="Atelier test"){return {name,website_url:null,contact_details:null,notes:null};}
function item(changes={}){return {item_code:"pal_18",name:"PAL test",category:"PAL",supplier_id:null,supplier_sku:null,material_type:null,thickness_mm:18,color_or_finish:null,sheet_width_mm:null,sheet_length_mm:null,purchase_unit:"m²",calculation_unit:"m²",unit_price_ron:"50",conversion_factor:"1",product_url:null,source_type:"manual",is_active:true,is_preferred:false,...changes};}
async function createOffer(state,changes={}){return repo.localCatalogRepository.saveItem(item(changes),null,state.revision);}

test("supplier lifecycle persists across module reload and blocks referenced deletion",async context=>{
  environment(context);let state=await repo.localCatalogRepository.load();assert.deepEqual(state.items,[]);assert.deepEqual(state.suppliers,[]);
  state=await repo.localCatalogRepository.saveSupplier(supplier(),null,0);const id=state.suppliers[0].id;
  assert.match(id,model.uuidPattern);assert.ok(state.suppliers[0].created_at.endsWith("Z"));
  state=await repo.localCatalogRepository.saveSupplier(supplier("Editat"),id,state.revision);assert.equal(state.suppliers[0].name,"Editat");
  state=await createOffer(state,{supplier_id:id});await assert.rejects(repo.localCatalogRepository.deleteSupplier(id,state.revision),/oferte asociate/);
  assert.deepEqual(await load("src/features/catalog/catalog-repository.ts").localCatalogRepository.load(),state);
  state=await repo.localCatalogRepository.deleteItem(state.items[0].id,state.revision);state=await repo.localCatalogRepository.deleteSupplier(id,state.revision);assert.equal(state.suppliers.length,0);
});
test("offer edit preserves ID and only explicitly preferred active offer resolves",async context=>{
  environment(context);let state=await createOffer(model.emptyCatalog(),{unit_price_ron:"100"});
  const first=state.items[0].id;state=await createOffer(state,{unit_price_ron:"1"});
  const resolve=()=>new source.ManualCatalogPriceSource().resolve(["pal_18","hdf_3"],state,date);
  assert.equal(resolve()[0].state,"selection_needed");assert.equal(resolve()[1].state,"missing");
  state=await repo.localCatalogRepository.saveItem(item({unit_price_ron:"100",is_preferred:true}),first,state.revision);
  assert.equal(resolve()[0].snapshot.unit_price_ron,"100");assert.equal(resolve()[0].snapshot.catalog_item_id,first);
  const second=state.items.find(i=>i.id!==first);state=await repo.localCatalogRepository.saveItem({...repo.itemInput(second),is_preferred:true},second.id,state.revision);
  assert.equal(state.items.filter(i=>i.is_preferred).length,1);assert.equal(resolve()[0].snapshot.unit_price_ron,"1");
  state=await repo.localCatalogRepository.saveItem({...repo.itemInput(state.items.find(i=>i.id===second.id)),is_active:false,is_preferred:false},second.id,state.revision);
  assert.equal(resolve()[0].state,"selection_needed");await assert.rejects(repo.localCatalogRepository.saveItem(item({is_active:false,is_preferred:true}),null,state.revision));
});
test("duplicate stable codes across suppliers are independent offers",async context=>{
  environment(context);let state=await repo.localCatalogRepository.saveSupplier(supplier("A"),null,0);state=await repo.localCatalogRepository.saveSupplier(supplier("B"),null,state.revision);
  for(const s of state.suppliers)state=await createOffer(state,{supplier_id:s.id});assert.equal(state.items.length,2);assert.notEqual(state.items[0].supplier_id,state.items[1].supplier_id);
});
test("price validation rejects unsupported units, unsafe links, invalid dimensions and non-finite values",()=>{
  for(const value of ["-1","NaN","Infinity","1e3","","1.1234567","1000000001"])assert.throws(()=>model.validateItem(item({unit_price_ron:value})));
  for(const unit of ["roll","pack","sheet"])assert.throws(()=>model.validateItem(item({purchase_unit:unit})));
  assert.throws(()=>model.validateSupplier({...supplier(),website_url:"javascript:alert(1)"}));
  assert.throws(()=>model.validateSupplier({...supplier(),website_url:"https://user:password@example.org"}));
  assert.throws(()=>model.validateItem(item({item_code:"hinges",category:"hinges",purchase_unit:"m²"})));
  assert.equal(model.validateItem(item({unit_price_ron:"0"})).unit_price_ron,"0");
  assert.equal(model.validateSupplier({...supplier(),website_url:"https://example.org"}).website_url,"https://example.org");
});
test("sheet normalization is exact decimal half-up to six places, never a sheet count",()=>{
  const sheet=item({purchase_unit:"sheet",sheet_width_mm:2000,sheet_length_mm:3000,conversion_factor:"6",unit_price_ron:"100"});
  assert.equal(model.sheetArea(2000,3000),"6");assert.equal(model.normalizedPrice(model.validateItem(sheet)),"16.666667");
  assert.equal(model.normalizedPrice({...sheet,unit_price_ron:"0"}),"0");
  assert.throws(()=>model.validateItem({...sheet,conversion_factor:"1"}));assert.throws(()=>model.validateItem({...sheet,sheet_width_mm:0}));
  assert.throws(()=>model.validateItem({...sheet,unit_price_ron:"0.000001",sheet_width_mm:10000,sheet_length_mm:10000,conversion_factor:"100"}));
});
test("catalog corruption, quota failures and stale revisions preserve original data",async context=>{
  const rows=environment(context);let state=await createOffer(model.emptyCatalog());const original=rows.get(repo.catalogStorageKey);
  await assert.rejects(repo.localCatalogRepository.deleteItem(state.items[0].id,0),/altă filă/);assert.equal(rows.get(repo.catalogStorageKey),original);
  const set=window.localStorage.setItem;window.localStorage.setItem=()=>{throw new Error("Quota");};await assert.rejects(createOffer(state),/nu a putut fi salvat/);assert.equal(rows.get(repo.catalogStorageKey),original);window.localStorage.setItem=set;
  rows.set(repo.catalogStorageKey,'{"schema_version":99}');await assert.rejects(repo.localCatalogRepository.load(),/Nu am șters/);assert.equal(rows.get(repo.catalogStorageKey),'{"schema_version":99}');
});
test("versioned backup merge previews conflicts, preserves IDs and never touches projects",async context=>{
  const rows=environment(context);rows.set("forma:wardrobe-project:v1:keep","unchanged");let state=await createOffer(model.emptyCatalog(),{is_preferred:true});
  const backup=repo.exportCatalog(state);assert.deepEqual(repo.parseCatalogBackup(JSON.stringify(backup)),backup);
  const incoming={...backup,items:[{...backup.items[0],id:crypto.randomUUID(),unit_price_ron:"5"}]};
  const plan=repo.previewImport(state,incoming,"merge");assert.equal(plan.addedItems,1);assert.equal(plan.next.items[1].is_preferred,false);assert.equal(plan.warnings.length,1);
  state=await repo.localCatalogRepository.importBackup(incoming,"merge",state.revision);assert.equal(state.items[0].unit_price_ron,"50");
  const skipped=repo.previewImport(state,{...backup,items:[{...backup.items[0],unit_price_ron:"999"}]},"merge");assert.equal(skipped.skipped,1);assert.equal(skipped.next.items[0].unit_price_ron,"50");
  const replace=repo.previewImport(state,backup,"replace");assert.equal(replace.removed,2);
  state=await repo.localCatalogRepository.importBackup(backup,"replace",state.revision);assert.equal(state.items.length,1);assert.equal(rows.get("forma:wardrobe-project:v1:keep"),"unchanged");
});
test("backup rejects malformed, unknown, dangling and image data before storage writes",async context=>{
  const rows=environment(context);const backup=repo.exportCatalog(model.emptyCatalog());
  for(const value of ["{",JSON.stringify({...backup,schema_version:2}),JSON.stringify({...backup,image:"blob:test"})," ".repeat(2*1024*1024+1)])assert.throws(()=>repo.parseCatalogBackup(value));
  assert.throws(()=>repo.parseCatalogBackup(JSON.stringify({...backup,items:[{...item({supplier_id:crypto.randomUUID()}),id:crypto.randomUUID(),updated_at:date}]})));
  assert.equal(rows.size,0);
});
test("required codes use calculated quantities, omit zero and never infer material counts",()=>{
  assert.deepEqual(source.requiredPriceCodes(calculation),pricing.priceItems.map(([code])=>code).filter(code=>code!=="abs_0_4"));
  const zero=structuredClone(calculation);zero.hardware.items=zero.hardware.items.map(i=>({...i,quantity:0}));zero.totals.total_pal_area_m2="0";zero.totals.total_hdf_area_m2="0";zero.edge_banding.totals_by_type={abs_2_total_m:"0",abs_0_4_total_m:"0"};assert.deepEqual(source.requiredPriceCodes(zero),[]);
});
test("automatic prefill freezes source metadata; override and missing refresh never alter catalog",async context=>{
  environment(context);let state=await repo.localCatalogRepository.saveSupplier(supplier(),null,0);state=await createOffer(state,{supplier_id:state.suppliers[0].id,is_preferred:true});
  const original=JSON.stringify(state),offers=new source.ManualCatalogPriceSource().resolve(["pal_18","hdf_3"],state,date);
  const initial=source.applyOffers(pricing.initialPricing(),[],offers,"initial");assert.equal(initial.pricing.pal_18,"50");assert.equal(initial.pricing.hdf_3,"");assert.equal(initial.snapshots[0].supplier_name,"Atelier test");
  const overridden=source.overrideSnapshot(initial.snapshots,"pal_18","75");
  assert.equal(source.applyOffers({...initial.pricing,pal_18:"75"},overridden,offers,"refresh").pricing.pal_18,"75");
  assert.equal(source.applyOffers({...initial.pricing,pal_18:"75"},overridden,offers,"refresh",false).pricing.pal_18,"50");
  const deleted=source.overrideSnapshot(initial.snapshots,"pal_18",null);assert.equal(source.applyOffers({...initial.pricing,pal_18:""},deleted,offers,"initial").pricing.pal_18,"");
  assert.equal(JSON.stringify(state),original);
  state=await repo.localCatalogRepository.saveSupplier(supplier("Renamed"),state.suppliers[0].id,state.revision);assert.equal(initial.snapshots[0].supplier_name,"Atelier test");
});
test("legacy project migration is read-only until save and keeps manual rates",async context=>{
  const rows=environment(context);const legacy={...fixture};delete legacy.price_snapshots;delete legacy.compatible;delete legacy.deviz_complete;delete legacy.warnings;
  legacy.manual_price_catalog=pricing.pricingPayload(fixture.confirmed_configuration,{...pricing.initialPricing(),pal_18:"47.123456",hinges:"0"}).price_catalog;
  const key=`forma:wardrobe-project:v1:${fixture.id}`,raw=JSON.stringify({storage_version:1,project:legacy});rows.set(key,raw);
  const project=await api.getProject(fixture.id);assert.equal(rows.get(key),raw);
  assert.equal(project.price_snapshots.length,project.manual_price_catalog.length);
  assert.ok(project.price_snapshots.every(s=>s.is_override && s.source_type==="manual"));
  assert.equal(project.price_snapshots[0].unit_price_ron,project.manual_price_catalog[0].unit_price_ron);
  const saved=await api.saveProject(api.projectPayload(project.confirmed_configuration,api.restorePricing(project),{name:project.name,description:project.description || "",status:project.status},project,project.price_snapshots),project);
  assert.equal(saved.id,fixture.id);assert.equal(JSON.parse(rows.get(key)).storage_version,2);
});
test("explicit refresh persists prices only, keeps unsaved configuration out and detects stale writes",async context=>{
  const rows=environment(context);let state=await createOffer(model.emptyCatalog(),{is_preferred:true});const resolved=new source.ManualCatalogPriceSource().resolve(["pal_18"],state,date);
  const old=await api.saveProject(api.projectPayload(fixture.confirmed_configuration,pricing.initialPricing(),{name:"Original",description:"",status:"draft"},null),null),before=rows.get(`forma:wardrobe-project:v1:${old.id}`);
  const next=source.applyOffers(pricing.initialPricing(),[],resolved,"refresh");assert.equal(rows.get(`forma:wardrobe-project:v1:${old.id}`),before);
  const saved=await api.saveProjectPrices(old,{...fixture.confirmed_configuration,width_mm:1200},next.pricing,next.snapshots);
  assert.equal(saved.confirmed_configuration.width_mm,fixture.confirmed_configuration.width_mm);assert.equal(saved.name,"Original");assert.equal(saved.price_snapshots[0].unit_price_ron,"50");
  state=await repo.localCatalogRepository.saveItem(item({unit_price_ron:"99",is_preferred:true}),state.items[0].id,state.revision);assert.equal((await api.getProject(old.id)).price_snapshots[0].unit_price_ron,"50");
  await assert.rejects(api.saveProjectPrices(old,fixture.confirmed_configuration,next.pricing,next.snapshots),e=>e.status===409);
});
test("snapshot mismatch is rejected instead of persisting conflicting provenance",async context=>{
  environment(context);const draft={...pricing.initialPricing(),pal_18:"50"};const snapshot=snapshots.manualSnapshot("pal_18","60",undefined,date);
  await assert.rejects(api.saveProject(api.projectPayload(fixture.confirmed_configuration,draft,{name:"Invalid",description:"",status:"draft"},null,[snapshot]),null));
  assert.equal(snapshots.snapshotsMatchPrices([{...snapshot,unit_price_ron:"50.000000"}],[{item_code:"pal_18",unit_price_ron:"50"}]),true);
});
test("catalog forms use Romanian labels, consistent units and no hardware thickness default",()=>{
  const forms=load("src/features/catalog/catalog-forms.tsx");
  const hardware={...item({item_code:"hinges",name:"Balamale test",category:"hinges",thickness_mm:null,purchase_unit:"buc.",calculation_unit:"buc."}),id:crypto.randomUUID(),updated_at:date};
  assert.equal(forms.itemFromDraft(forms.itemDraft(hardware)).thickness_mm,null);
  const html=renderToStaticMarkup(React.createElement(forms.CatalogItemForm,{initial:null,catalog:model.emptyCatalog(),busy:false,onSave:async()=>{},onCancel:()=>{}}));assert.match(html,/Ofertă nouă/);assert.match(html,/Nu alegem automat/);assert.match(html,/Rolele și pachetele nu sunt suportate/);
});
test("refresh UI requires explicit preview then backend recalculation before saving",async context=>{
  environment(context);let catalog=await createOffer(model.emptyCatalog(),{is_preferred:true});
  const state=[],effects=[];let cursor=0;const saved={...fixture,price_snapshots:[]};let applied=0,writes=0,estimates=0;
  const project={calculation,pricing:pricing.initialPricing(),priceSnapshots:[],savedProject:saved,catalogInitialized:true,applyProjectPrices(){applied++;}};
  const {ProjectCatalogPricing}=load("src/features/catalog/project-catalog-pricing.tsx",{
    react:{...React,useEffect:effect=>effects.push(effect),useRef:()=>({current:null}),useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==="function" ? initial():initial;return[state[i],v=>{state[i]=typeof v==="function" ? v(state[i]):v;}];}},
    "../furniture/wardrobe-project-context":{useWardrobeProject:()=>project},
    "../furniture/estimate-wardrobe":{estimateWardrobe:async()=>{estimates++;return estimate;}},
    "../furniture/project-api":{invalidPricing:()=>false,saveProjectPrices:async()=>{assert.equal(estimates,1);writes++;return saved;}},
  });
  const render=()=>{cursor=0;return ProjectCatalogPricing({configuration:fixture.confirmed_configuration});};
  function nodes(tree){return tree && typeof tree==="object" ? [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)]:[];}
  let tree=render();const refresh=nodes(tree).find(n=>n.type==="button" && n.props.children==="Actualizează prețurile din catalog");await refresh.props.onClick();
  for(let i=0;i<8;i++)await Promise.resolve();assert.equal(writes,0);assert.equal(estimates,0);tree=render();
  const confirm=nodes(tree).find(n=>n.type==="button" && n.props.children==="Confirmă actualizarea prețurilor");assert.ok(confirm);
  // A concurrent catalog edit invalidates the preview before any estimate or write.
  await createOffer(catalog,{item_code:"hdf_3",category:"HDF",thickness_mm:3});confirm.props.onClick();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(writes,0);assert.equal(estimates,0);
  tree=render();await nodes(tree).find(n=>n.type==="button" && n.props.children==="Actualizează prețurile din catalog").props.onClick();for(let i=0;i<8;i++)await Promise.resolve();tree=render();
  nodes(tree).find(n=>n.type==="button" && n.props.children==="Confirmă actualizarea prețurilor").props.onClick();for(let i=0;i<15;i++)await Promise.resolve();assert.equal(estimates,1);assert.equal(writes,1);assert.equal(applied,1);
});

for(const backendAvailable of [true,false])test(`new-project automatic pricing ${backendAvailable ? "waits for backend before applying":"preserves inputs on backend failure"}`,async context=>{
  environment(context);await createOffer(model.emptyCatalog(),{is_preferred:true});const effects=[];let applied=null,request=null;
  const project={calculation,pricing:pricing.initialPricing(),priceSnapshots:[],savedProject:null,catalogInitialized:false,applyProjectPrices(...args){applied=args;}};
  const {ProjectCatalogPricing}=load("src/features/catalog/project-catalog-pricing.tsx",{
    react:{...React,useEffect:effect=>effects.push(effect),useRef:()=>({current:null}),useState:initial=>[typeof initial==="function" ? initial():initial,()=>{}]},
    "../furniture/wardrobe-project-context":{useWardrobeProject:()=>project},
    "../furniture/estimate-wardrobe":{estimateWardrobe:async(configuration,draft,prices)=>{request={configuration,draft,prices};assert.equal(applied,null);if(!backendAvailable)throw new Error("Offline");return estimate;}},
  });
  ProjectCatalogPricing({configuration:fixture.confirmed_configuration});const cleanups=effects.map(effect=>effect());for(let i=0;i<15;i++)await Promise.resolve();
  assert.equal(request.draft.pal_18,"50");assert.equal(project.pricing.pal_18,"");
  if(backendAvailable){assert.equal(applied[0].pal_18,"50");assert.equal(applied[1][0].catalog_item_id,request.prices[0].catalog_item_id);assert.equal(applied[2],estimate);}else assert.equal(applied,null);
  cleanups.forEach(cleanup=>cleanup?.());
});

test("snapshot comparison accepts equivalent backend decimal and UTC serialization",()=>{
  const original=snapshots.manualSnapshot("pal_18","50",undefined,date);
  assert.equal(snapshots.snapshotFingerprint([original]),snapshots.snapshotFingerprint([{...original,unit_price_ron:"50.000000",applied_at:"2026-11-13T10:00:00Z"}]));
});

test("legacy global catalog is assigned only to furniture without deleting or rewriting it",async context=>{
  const rows=environment(context);let state=await repo.localCatalogRepository.saveSupplier(supplier("Existing furniture supplier"),null,0);
  state=await createOffer(state,{supplier_id:state.suppliers[0].id,is_preferred:true});
  const legacy=rows.get(repo.catalogStorageKey);rows.set(repo.legacyCatalogStorageKey,legacy);rows.delete(repo.catalogStorageKey);
  assert.deepEqual(await repo.localCatalogRepository.load(),state);assert.equal(rows.has(repo.catalogStorageKey),false);
  const electrical=repo.createLocalCatalogRepository("electrical");assert.equal((await electrical.load()).suppliers.length,0);
  state=await repo.localCatalogRepository.saveSupplier(supplier("Updated furniture supplier"),state.suppliers[0].id,state.revision);
  assert.equal(rows.get(repo.legacyCatalogStorageKey),legacy);assert.equal(JSON.parse(rows.get(repo.catalogStorageKey)).suppliers[0].name,"Updated furniture supplier");
  assert.equal(state.items.length,1);assert.equal(state.items[0].is_preferred,true);
  // A scoped empty catalog is intentional: never revive older global data.
  rows.set(repo.catalogStorageKey,JSON.stringify(model.emptyCatalog()));assert.equal((await repo.localCatalogRepository.load()).suppliers.length,0);
});

test("domain storage writes and revisions are isolated and backups cannot cross domains",async context=>{
  const rows=environment(context);const furniture=repo.localCatalogRepository,electrical=repo.createLocalCatalogRepository("electrical");
  const state=await furniture.saveSupplier(supplier("Furniture only"),null,0),original=rows.get(repo.catalogStorageKey);
  let other=await electrical.saveSupplier(supplier("Electrical only"),null,0);
  assert.notEqual(repo.catalogStorageKey,repo.catalogStorageKeyFor("electrical"));assert.equal((await furniture.load()).suppliers[0].name,"Furniture only");assert.equal(other.suppliers[0].name,"Electrical only");
  const backup=repo.exportCatalog(state);assert.equal(backup.domain_id,"furniture");
  await assert.rejects(electrical.importBackup(backup,"replace",other.revision),/altui domeniu/);
  other=await electrical.deleteSupplier(other.suppliers[0].id,other.revision);assert.equal(other.suppliers.length,0);assert.equal(rows.get(repo.catalogStorageKey),original);
  const legacyBackup={...backup};delete legacyBackup.domain_id;
  assert.equal(repo.parseCatalogBackup(JSON.stringify(legacyBackup)).domain_id,"furniture");assert.throws(()=>repo.parseCatalogBackup(JSON.stringify(legacyBackup),"electrical"),/altui domeniu/);
  assert.throws(()=>repo.catalogStorageKeyFor("../furniture"));
});

test("supplier access is visible within furniture and absent from the domain dashboard header",()=>{
  const domains=load("src/config/domains.ts");
  const {AppHeader}=load("src/components/app-header.tsx",{"@/config/domains":domains});
  const platform=renderToStaticMarkup(React.createElement(AppHeader));assert.ok(!platform.includes("Furnizori și prețuri"));
  const furniture=renderToStaticMarkup(React.createElement(AppHeader,{showDomainLink:true}));assert.match(furniture,/catalog-header-link/);assert.ok(furniture.includes(`href="${domains.furnitureRoutes.suppliers}"`));
  const {FurnitureCatalogCard}=load("src/components/furniture-catalog-card.tsx",{"@/config/domains":domains});
  const card=renderToStaticMarkup(React.createElement(FurnitureCatalogCard));assert.match(card,/Furnizori și prețuri/);assert.match(card,/SPAȚIUL TĂU DE MOBILIER/);assert.ok(card.includes(`href="${domains.furnitureRoutes.suppliers}"`));
});
