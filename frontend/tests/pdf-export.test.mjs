import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {loadTypeScriptModule as load} from "./helpers/load-typescript.mjs";

process.env.NEXT_PUBLIC_PROJECT_STORAGE="browser";
const profile=load("src/features/company/company-profile.ts");
const data=load("src/features/pdf/pdf-data.ts");
const generator=load("src/features/pdf/generate-pdf.ts");
const api=load("src/features/furniture/project-api.ts");
const pricing=load("src/features/furniture/wardrobe-pricing.ts");
const fixture=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`,import.meta.url),"utf8"));
const calculation=fixture("wardrobe-calculation"),estimate=fixture("wardrobe-estimate"),configuration=calculation.input_configuration;
const company={...profile.emptyCompanyProfile(),display_name:"Atelier de test - ă â î ș ț"};
const fonts={regular:readFileSync("public/fonts/Lato-Regular.ttf").toString("base64"),bold:readFileSync("public/fonts/Lato-Bold.ttf").toString("base64")};
const png="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQUpADAADIAGEoI+qMAAAAAElFTkSuQmCC";
const logo={data_url:`data:image/png;base64,${png}`,format:"PNG",width:1,height:1};
const jpegLogo={data_url:`data:image/jpeg;base64,${readFileSync("tests/fixtures/logo-test.jpg").toString("base64")}`,format:"JPEG",width:1,height:1};
const input=(changes={})=>({kind:"quotation",company,configuration,calculation,estimate,projectName:"Dulap test",projectId:null,generatedAt:"2026-11-13T10:00:00Z",referenceId:"TESTREF",...changes});
function environment(context){const rows=new Map(),previous=globalThis.window;globalThis.window={localStorage:{getItem:k=>rows.get(k) ?? null,setItem:(k,v)=>rows.set(k,String(v)),removeItem:k=>rows.delete(k),get length(){return rows.size;},key:i=>Array.from(rows.keys())[i] ?? null},setTimeout,clearTimeout};context.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});return rows;}

test("company profile starts empty, persists exact optional data and survives reload",context=>{
  const rows=environment(context);assert.equal(profile.loadCompanyProfile(),null);
  const saved=profile.saveCompanyProfile({...company,phone:"01234",website:"https://example.org",quotation_notes:"Verificați dimensiunile.",validity_days:14,logo});
  assert.deepEqual(load("src/features/company/company-profile.ts").loadCompanyProfile(),saved);
  assert.equal(JSON.parse(rows.get(profile.companyProfileKey)).schema_version,1);assert.equal(saved.logo.data_url,logo.data_url);
});
test("company validation rejects invalid email, credentials, URLs, oversized data and validity",()=>{
  for(const changes of [{display_name:" "},{email:"invalid"},{website:"javascript:alert(1)"},{website:"https://user:pass@example.org"},{validity_days:0},{validity_days:366},{validity_days:1.5},{quotation_notes:"x".repeat(2001)},{secret:"not allowed"}])assert.throws(()=>profile.validateCompanyProfile({...company,...changes}));
  assert.equal(profile.validateCompanyProfile(company).logo,null);assert.equal(profile.validateCompanyProfile(company).validity_days,null);
});
test("corrupt/future company storage and quota errors preserve previous content",context=>{
  const rows=environment(context);profile.saveCompanyProfile(company);const original=rows.get(profile.companyProfileKey);
  window.localStorage.setItem=()=>{throw new Error("Quota");};assert.throws(()=>profile.saveCompanyProfile({...company,display_name:"Changed"}),/nu a putut fi salvat/);assert.equal(rows.get(profile.companyProfileKey),original);
  rows.set(profile.companyProfileKey,'{"schema_version":99}');assert.throws(()=>profile.loadCompanyProfile(),/nu au fost șterse/);assert.equal(rows.get(profile.companyProfileKey),'{"schema_version":99}');
});
test("logo validation checks actual signature, dimensions and bounded data URLs",()=>{
  assert.deepEqual(profile.validateLogo(logo),logo);
  assert.deepEqual(profile.validateLogo(jpegLogo),jpegLogo);
  for(const value of [{...logo,format:"JPEG"},{...logo,width:2049},{...logo,data_url:"https://example.org/logo.png"},{...logo,data_url:"data:image/png;base64,"+"A".repeat(200000)},{...logo,data_url:"data:image/png;base64,PHN2Zz4="}])assert.throws(()=>profile.validateLogo(value));
});
test("logo file selection rejects wrong MIME, excessive size and corrupt decode",async context=>{
  await assert.rejects(profile.readCompanyLogo(new File(["test"],"logo.webp",{type:"image/webp"})),/PNG sau JPEG/);
  await assert.rejects(profile.readCompanyLogo(new File([new Uint8Array(profile.logoMaxBytes+1)],"logo.png",{type:"image/png"})),/128 KB/);
  await assert.rejects(profile.readCompanyLogo(new File(["not a PNG"],"logo.png",{type:"image/png"})),/nu conține/);
  const previous=globalThis.Image;context.after(()=>{if(previous===undefined)delete globalThis.Image;else globalThis.Image=previous;});
  globalThis.Image=class{async decode(){throw new Error("Decode failure");}};
  await assert.rejects(profile.readCompanyLogo(new File([Buffer.from(png,"base64")],"logo.png",{type:"image/png"})),/corupt/);
});
test("valid PNG file is decoded and object URL is revoked before storing bounded logo",async context=>{
  const oldImage=globalThis.Image,oldReader=globalThis.FileReader;context.after(()=>{if(oldImage===undefined)delete globalThis.Image;else globalThis.Image=oldImage;if(oldReader===undefined)delete globalThis.FileReader;else globalThis.FileReader=oldReader;});
  let revoked=0;context.mock.method(URL,"revokeObjectURL",()=>{revoked++;});
  globalThis.Image=class{naturalWidth=1;naturalHeight=1;async decode(){}};
  globalThis.FileReader=class{readAsDataURL(){this.result=logo.data_url;this.onload();}};
  assert.deepEqual(await profile.readCompanyLogo(new File([Buffer.from(png,"base64")],"logo.png",{type:"image/png"})),logo);assert.equal(revoked,1);
});
test("client DTO includes final price only and never receives internal pricing/catalog data",()=>{
  const prepared=data.preparePdfData(input());assert.equal(prepared.selling_price_ron,estimate.selling_price_before_tax_ron);
  assert.deepEqual(Object.keys(prepared).sort(),["identity","company","configuration","kind","selling_price_ron","valid_until"].sort());
  const serialized=JSON.stringify(prepared);for(const field of ["markup","labor_cost","unit_price_ron","material_subtotal","price_snapshots","supplier_id"])assert.ok(!serialized.includes(field));
  assert.equal(prepared.valid_until,null);
  const valid=data.preparePdfData(input({company:{...company,validity_days:14}}));assert.equal(valid.valid_until.slice(0,10),"2026-11-27");
});
test("incomplete, stale and invalid quotations are blocked while technical export needs no financial estimate",()=>{
  for(const value of [null,{...estimate,is_complete:false,selling_price_before_tax_ron:null},{...estimate,missing_item_codes:["pal_18"]},{...estimate,configuration:{...configuration,width_mm:901}}])assert.throws(()=>data.preparePdfData(input({estimate:value})),/toate prețurile/);
  const technical=data.preparePdfData(input({kind:"workshop",estimate:null}));assert.equal(technical.calculation.totals.total_pal_area_m2,calculation.totals.total_pal_area_m2);assert.deepEqual(technical.calculation.hardware,calculation.hardware);
  assert.ok(!("selling_price_ron" in technical));assert.throws(()=>data.preparePdfData(input({kind:"workshop",calculation:{...calculation,input_configuration:{...configuration,width_mm:901}}})),/Lista tehnică/);
  assert.throws(()=>data.preparePdfData(input({projectName:""})),/nume/);
});
test("filenames are safe, bounded and contain neither contact nor client metadata",()=>{
  const prepared=data.preparePdfData(input({projectName:'Dulap / dormitor : Ș ț \\ ? " < >',company:{...company,email:"private@example.org"}}));
  const filename=data.pdfFilename(prepared);assert.match(filename,/^FORMA_Deviz_[a-zA-Z0-9_-]+_2026-11-13\.pdf$/);assert.ok(filename.length<110);assert.ok(!filename.includes("private"));
});
test("real PDF generation embeds fonts, handles diacritics, long text, logo and missing logo",()=>{
  for(const changes of [{},{company:{...company,logo}},{company:{...company,logo:jpegLogo}},{company:{...company,display_name:"Știință și tâmplărie ".repeat(7),quotation_notes:"Verificați schița înainte de execuție. ".repeat(45)},projectName:"Dulap foarte lung pentru verificarea încadrării în document, cu diacritice românești"},{kind:"workshop",estimate:null}]){
    const pdf=Buffer.from(generator.generatePdf(data.preparePdfData(input(changes)),fonts));assert.equal(pdf.subarray(0,5).toString(),"%PDF-");assert.ok(pdf.length>20000);assert.ok(pdf.includes(Buffer.from("/FontFile2")));assert.ok(pdf.includes(Buffer.from("/Creator (FORMA)")));
  }
});
test("PDF generation errors are recoverable Romanian messages",()=>{
  assert.throws(()=>generator.generatePdf(data.preparePdfData(input({company:{...company,logo:{...logo,data_url:"data:image/png;base64,iVBORw0KGgo="}}})),fonts),/PDF-ul nu a putut fi generat/);
});
test("saved-project export restores its exact prices without reading the supplier catalog",async context=>{
  const rows=environment(context);const initial={...pricing.initialPricing(),pal_18:"47",hdf_3:"0"};
  const saved=await api.saveProject(api.projectPayload(configuration,initial,{name:"Istoric",description:"",status:"draft"},null),null);
  rows.set("forma:supplier-catalog:furniture:v1",'{"schema_version":99}');
  const loaded=await api.getProject(saved.id);assert.equal(api.restorePricing(loaded).pal_18,"47");assert.equal(loaded.price_snapshots[0].unit_price_ron,"47");
  const prepared=data.preparePdfData(input({projectName:loaded.name,projectId:loaded.id}));assert.equal(prepared.identity.project_id,saved.id);assert.equal(prepared.selling_price_ron,estimate.selling_price_before_tax_ron);
  assert.equal((await api.getProject(saved.id)).price_snapshots[0].unit_price_ron,"47");
});
test("font loading uses same-origin base path and failed responses do not return fallback glyphs",async context=>{
  const {loadPdfFonts}=load("src/features/pdf/pdf-fonts.ts"),urls=[];process.env.NEXT_PUBLIC_ASSET_BASE_PATH="/forma";context.after(()=>delete process.env.NEXT_PUBLIC_ASSET_BASE_PATH);
  context.mock.method(globalThis,"fetch",async(url,options)=>{urls.push(url);assert.equal(options.credentials,"same-origin");return new Response(readFileSync("public/fonts/Lato-Regular.ttf"));});
  const loaded=await loadPdfFonts(new AbortController().signal);assert.equal(loaded.regular,fonts.regular);assert.ok(urls.every(url=>url.startsWith("/forma/fonts/")));
  context.mock.method(globalThis,"fetch",async()=>new Response("",{status:404}));await assert.rejects(loadPdfFonts(new AbortController().signal),/Fontul PDF/);
});
test("export choices are accessible and disable client quotation for missing prices",()=>{
  const state=[true,company,null,"",""];let cursor=0;
  const {PdfExportActions}=load("src/features/pdf/pdf-export-actions.tsx",{react:{...React,useEffect:()=>{},useRef:()=>({current:null}),useState:()=>[state[cursor++],()=>{}]},"../furniture/wardrobe-project-context":{useWardrobeProject:()=>({calculation,projectName:"Dulap",savedProject:null,pricing:pricing.initialPricing(),priceSnapshots:[]})}});
  const incomplete={...estimate,is_complete:false,missing_item_codes:["pal_18"],selling_price_before_tax_ron:null};
  const html=renderToStaticMarkup(React.createElement(PdfExportActions,{configuration,estimate:incomplete}));assert.match(html,/Deviz incomplet/);assert.match(html,/PAL 18 mm/);assert.match(html,/Deviz pentru client/);assert.match(html,/Fișă tehnică pentru atelier/);assert.match(html,/disabled="">Descarcă devizul/);assert.ok(!/disabled="">Descarcă fișa tehnică/.test(html));assert.match(html,/aria-expanded="true"/);
});

test("export errors release the busy lock and repeated clicks cannot duplicate generation",async context=>{
  environment(context);let generated=0;
  const state=[true,company,null,"",""];let cursor=0,refIndex=0;const refs=[{current:false},{current:null}];
  const {PdfExportActions}=load("src/features/pdf/pdf-export-actions.tsx",{
    react:{...React,useEffect:()=>{},useRef:()=>refs[refIndex++],useState:()=>{const i=cursor++;return[state[i],v=>{state[i]=typeof v==="function" ? v(state[i]):v;}];}},
    "../furniture/wardrobe-project-context":{useWardrobeProject:()=>({calculation,projectName:"Dulap",savedProject:null,pricing:pricing.initialPricing(),priceSnapshots:[]})},
    "./generate-pdf":{generatePdf(){generated++;throw new Error("PDF-ul nu a putut fi generat.");}},"./pdf-fonts":{loadPdfFonts:async()=>fonts},
  });
  const tree=PdfExportActions({configuration,estimate});
  const nodes=tree=>tree && typeof tree==="object" ? [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)]:[];
  const button=nodes(tree).find(n=>n.type==="button" && n.props.children==="Descarcă devizul");button.props.onClick();button.props.onClick();
  for(let i=0;i<20;i++)await Promise.resolve();
  assert.equal(generated,1);assert.match(state[3],/PDF-ul nu a putut fi generat/);assert.equal(state[2],null);assert.equal(refs[0].current,false);
});

test("pricing integration passes only the current visible estimate to PDF export",()=>{
  const states=[];let cursor=0;const project={pricing:pricing.initialPricing(),updatePricing(){}};
  const {WardrobePricingForm}=load("src/features/furniture/wardrobe-pricing-form.tsx",{
    react:{...React,useEffect:()=>{},useRef:()=>({current:null}),useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==="function" ? initial():initial;return[states[i],()=>{}];}},
    "./wardrobe-project-context":{useWardrobeProject:()=>project},
  });
  const render=()=>{cursor=0;return WardrobePricingForm({configuration,initialEstimate:estimate});};
  let tree=render();assert.ok(tree.props.children.some(child=>child?.type?.name==="PdfExportActions" && child.props.estimate===estimate));
  project.pricing={...project.pricing,pal_18:"99"};tree=render();assert.ok(tree.props.children.some(child=>child?.type?.name==="PdfExportActions" && child.props.estimate===null));
});
