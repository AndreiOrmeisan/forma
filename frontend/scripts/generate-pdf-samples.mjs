// Synthetic fixtures only: never import real browser/company data into this script.
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {loadTypeScriptModule} from "../tests/helpers/load-typescript.mjs";

const {preparePdfData,pdfFilename}=loadTypeScriptModule("src/features/pdf/pdf-data.ts");
const {generatePdf}=loadTypeScriptModule("src/features/pdf/generate-pdf.ts");
const {emptyCompanyProfile}=loadTypeScriptModule("src/features/company/company-profile.ts");
const fixture=name=>JSON.parse(readFileSync(new URL(`../tests/fixtures/${name}.json`,import.meta.url),"utf8"));
const calculation=fixture("wardrobe-calculation"),estimate=fixture("wardrobe-estimate");
const fonts={regular:readFileSync("public/fonts/Lato-Regular.ttf").toString("base64"),bold:readFileSync("public/fonts/Lato-Bold.ttf").toString("base64")};
const company={...emptyCompanyProfile(),display_name:"Atelier demonstrativ - Știință și meșteșug",contact_person:"Date fictive pentru verificarea PDF",phone:"",email:"",address:"Adresă demonstrativă, România",registration_info:"",tax_info:"",quotation_notes:"Exemplu pentru verificare: ă â î ș ț. Configurația și termenul de execuție se confirmă înainte de comandă.",validity_days:14};
const output=path.resolve("../output/pdf");mkdirSync(output,{recursive:true});
const common={company,configuration:calculation.input_configuration,calculation,estimate,projectName:"Dulap demonstrație - ă â î ș ț",projectId:null,generatedAt:"2026-11-13T10:00:00.000Z",referenceId:"SAMPLE000001"};
function sample(name,input){const data=preparePdfData(input),bytes=generatePdf(data,fonts);writeFileSync(path.join(output,name),Buffer.from(bytes));return {name,pagesHint:input.kind,downloadName:pdfFilename(data),bytes:bytes.byteLength};}
const samples=[];
samples.push(sample("quotation-sample.pdf",{...common,kind:"quotation"}));
samples.push(sample("workshop-sample.pdf",{...common,kind:"workshop"}));
const longCompany={...company,display_name:"Atelier demonstrativ de mobilier și tâmplărie - ".repeat(3),address:"Adresă demonstrativă foarte lungă pentru verificarea încadrării textului. ".repeat(5),quotation_notes:"Condiție demonstrativă: verificați schița, dimensiunile și materialele înainte de comandă. ".repeat(18)};
const logo={data_url:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQUpADAADIAGEoI+qMAAAAAElFTkSuQmCC",format:"PNG",width:1,height:1};
samples.push(sample("quotation-long-logo.pdf",{...common,kind:"quotation",company:{...longCompany,logo},projectName:"Proiect demonstrativ cu denumire lungă pentru verificarea încadrării în documentul PDF - mobilier dormitor"}));
const stress=structuredClone(calculation);
// Pagination fixture, deliberately not a real wardrobe calculation. Keep rows and
// edge references coherent while exercising table headers across multiple pages.
stress.panels=Array.from({length:10},(_,index)=>calculation.panels.map(p=>({...p,id:`${p.id}-${index}`,name:`${p.name} (test paginare ${index+1})`}))).flat();
stress.edge_banding.panel_edges=Array.from({length:10},(_,index)=>calculation.edge_banding.panel_edges.map(p=>({...p,panel_id:`${p.panel_id}-${index}`,name:`${p.name} (test paginare ${index+1})`}))).flat();
stress.warnings=["FIȘIER DE TEST PENTRU PAGINARE. Rânduri repetate artificial, nu utilizați pentru execuție."];
samples.push(sample("workshop-pagination-test.pdf",{...common,kind:"workshop",calculation:stress,projectName:"TEST DE PAGINARE - nu este proiect executabil"}));
console.log(JSON.stringify({output,samples},null,2));
