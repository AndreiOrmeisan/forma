import { CatalogError, normalizedPrice, type CatalogState, type ItemCode } from "./catalog-model";
import { priceItems, type PricingDraft } from "../furniture/wardrobe-pricing";
import { manualSnapshot, type ProjectPriceSnapshot } from "../furniture/project-price-snapshot";
import type { WardrobeCalculationResult } from "../furniture/calculate-wardrobe";

export type ResolvedOffer={item_code:ItemCode;state:"ready"|"missing"|"selection_needed";snapshot:ProjectPriceSnapshot|null;message:string};
export interface PriceSource {resolve(codes:ItemCode[],catalog:CatalogState,appliedAt:string):ResolvedOffer[];}
export class ManualCatalogPriceSource implements PriceSource {
  resolve(codes:ItemCode[],catalog:CatalogState,appliedAt:string):ResolvedOffer[]{
    return codes.map(code=>{
      const active=catalog.items.filter(item=>item.item_code===code && item.is_active);
      const preferred=active.filter(item=>item.is_preferred);
      const name=priceItems.find(([id])=>id===code)![1];
      if(preferred.length!==1)return {item_code:code,state:active.length ? "selection_needed":"missing",snapshot:null,
        message:active.length ? `${name}: alege explicit o ofertă implicită activă în catalog.` : `${name}: nu există ofertă activă; prețul rămâne necompletat.`};
      const item=preferred[0],supplier=catalog.suppliers.find(s=>s.id===item.supplier_id);
      return {item_code:code,state:"ready",message:`${name}: ${supplier?.name || "Catalog personal"}`,
        snapshot:{item_code:code,unit_price_ron:normalizedPrice(item),normalized_unit:item.calculation_unit,
          supplier_id:item.supplier_id,supplier_name:supplier?.name || null,catalog_item_id:item.id,applied_at:appliedAt,source_type:"manual_catalog",is_override:false}};
    });
  }
}
export function requiredPriceCodes(result:WardrobeCalculationResult):ItemCode[]{
  const codes:ItemCode[]=[];
  if(/[1-9]/.test(result.totals.total_pal_area_m2))codes.push("pal_18");
  if(/[1-9]/.test(result.totals.total_hdf_area_m2))codes.push("hdf_3");
  if(/[1-9]/.test(result.edge_banding.totals_by_type.abs_2_total_m))codes.push("abs_2");
  if(/[1-9]/.test(result.edge_banding.totals_by_type.abs_0_4_total_m))codes.push("abs_0_4");
  for(const item of result.hardware.items)if(item.quantity>0){
    if(!priceItems.some(([code])=>code===item.id))throw new CatalogError("Cantitățile conțin un cod de feronerie neacceptat.");
    codes.push(item.id as ItemCode);
  }
  return codes;
}
export function applyOffers(pricing:PricingDraft,snapshots:ProjectPriceSnapshot[],offers:ResolvedOffer[],mode:"initial"|"refresh",retainOverrides=true){
  const next={...pricing},byCode=new Map(snapshots.map(snapshot=>[snapshot.item_code,snapshot]));
  for(const offer of offers){
    const current=byCode.get(offer.item_code);
    if(mode==="initial" && (current || next[offer.item_code].trim()!==""))continue;
    if(mode==="refresh" && retainOverrides && current?.is_override)continue;
    if(!offer.snapshot)continue; // Missing/ambiguous offers never erase a project price.
    next[offer.item_code]=offer.snapshot.unit_price_ron!;
    byCode.set(offer.item_code,structuredClone(offer.snapshot));
  }
  return {pricing:next,snapshots:Array.from(byCode.values())};
}
export function overrideSnapshot(snapshots:ProjectPriceSnapshot[],code:string,value:string|null){
  return [...snapshots.filter(s=>s.item_code!==code),manualSnapshot(code,value,snapshots.find(s=>s.item_code===code))];
}
