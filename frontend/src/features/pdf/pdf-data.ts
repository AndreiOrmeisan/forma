import { validateCompanyProfile, type CompanyProfile } from "../company/company-profile";
import { isWardrobeConfiguration, wardrobeFields, type WardrobeConfiguration } from "../furniture/wardrobe-configuration";
import { isWardrobeCalculationResult, type WardrobeCalculationResult } from "../furniture/calculate-wardrobe";
import { isEstimate, type Estimate } from "../furniture/wardrobe-pricing";
import { validateManufacturingSnapshot, type ManufacturingSnapshot } from "../manufacturing/manufacturing-model";
import { isManufacturingResult, type ManufacturingResult } from "../manufacturing/manufacturing-api";

export type PdfKind="quotation"|"workshop";
type DocumentIdentity={project_name:string;project_id:string|null;generated_at:string;reference:string};
type BaseDocument={identity:DocumentIdentity;company:CompanyProfile;configuration:WardrobeConfiguration};
// Deliberately allowlisted: client documents never receive the financial estimate,
// price catalog, suppliers, labor, markup or internal production costs.
export type QuotationDocument=BaseDocument & {kind:"quotation";selling_price_ron:string;valid_until:string|null};
export type WorkshopDocument=BaseDocument & {kind:"workshop";calculation:WardrobeCalculationResult;manufacturing?:{snapshot:ManufacturingSnapshot;result:ManufacturingResult}};
export type PdfDocumentData=QuotationDocument|WorkshopDocument;
export function sameConfiguration(a:WardrobeConfiguration,b:WardrobeConfiguration){return wardrobeFields.every(key=>a[key]===b[key]) && a.furniture_type===b.furniture_type;}
export function quotationAvailable(estimate:Estimate|null,configuration:WardrobeConfiguration):boolean {
  return !!estimate && isEstimate(estimate) && estimate.is_complete && estimate.missing_item_codes.length===0 && estimate.selling_price_before_tax_ron!==null && sameConfiguration(configuration,estimate.configuration);
}
export function preparePdfData(input:{kind:PdfKind;company:CompanyProfile;configuration:WardrobeConfiguration;calculation:WardrobeCalculationResult|null;estimate:Estimate|null;projectName:string;projectId:string|null;generatedAt?:string;referenceId?:string;manufacturingSnapshot?:ManufacturingSnapshot|null;manufacturingResult?:ManufacturingResult|null}):PdfDocumentData {
  const company=validateCompanyProfile(input.company),configuration=input.configuration;
  if(!isWardrobeConfiguration(configuration))throw new Error("Confirmă o configurație validă înainte de export.");
  const name=input.projectName.trim();
  if(!name || name.length>120 || /[\u0000-\u001f]/.test(name))throw new Error("Completează un nume de proiect valid, de maximum 120 de caractere.");
  const generatedAt=input.generatedAt || new Date().toISOString();
  if(!Number.isFinite(Date.parse(generatedAt)))throw new Error("Data documentului este invalidă.");
  const token=(input.referenceId || crypto.randomUUID()).replace(/[^a-z0-9]/gi,"").slice(0,12).toUpperCase();
  const identity={project_name:name,project_id:input.projectId,generated_at:generatedAt,reference:`FORMA-${generatedAt.slice(0,10).replaceAll("-","")}-${token}`};
  const base={identity,company:structuredClone(company),configuration:structuredClone(configuration)};
  if(input.kind==="quotation"){
    if(!quotationAvailable(input.estimate,configuration))throw new Error("Devizul pentru client necesită toate prețurile și un calcul actualizat. Nu exportăm sume parțiale.");
    const validity=company.validity_days===null ? null:new Date(generatedAt);
    if(validity)validity.setUTCDate(validity.getUTCDate()+company.validity_days!);
    return {...base,kind:"quotation",selling_price_ron:input.estimate!.selling_price_before_tax_ron!,valid_until:validity?.toISOString() || null};
  }
  if(input.kind!=="workshop" || !input.calculation || !isWardrobeCalculationResult(input.calculation) || !sameConfiguration(configuration,input.calculation.input_configuration))throw new Error("Lista tehnică nu este disponibilă pentru configurația confirmată.");
  if(input.manufacturingSnapshot){
    const snapshot=validateManufacturingSnapshot(input.manufacturingSnapshot),result=input.manufacturingResult;
    if(!isManufacturingResult(result) || !sameConfiguration(configuration,result.configuration) || result.profile_id!==snapshot.profile.id || result.profile_revision!==snapshot.profile.revision)throw new Error("Așteaptă calculul actual al profilului de prelucrare înainte de fișa tehnică.");
    return {...base,kind:"workshop",calculation:structuredClone(input.calculation),manufacturing:{snapshot,result:structuredClone(result)}};
  }
  return {...base,kind:"workshop",calculation:structuredClone(input.calculation)};
}
export function pdfFilename(data:PdfDocumentData):string {
  const name=data.identity.project_name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^[-_]+|[-_]+$/g,"").slice(0,60) || "Proiect";
  return `FORMA_${data.kind==="quotation" ? "Deviz":"Fisa-Tehnica"}_${name}_${data.identity.generated_at.slice(0,10)}.pdf`;
}
