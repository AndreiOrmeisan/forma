import { priceItems, pricingError, type PricingDraft } from "./wardrobe-pricing";

export type ProjectPriceSnapshot={item_code:string;unit_price_ron:string|null;normalized_unit:"m²"|"m"|"buc.";
  supplier_id:string|null;supplier_name:string|null;catalog_item_id:string|null;applied_at:string;
  source_type:"manual"|"manual_catalog";is_override:boolean};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isPriceSnapshots(value:unknown):value is ProjectPriceSnapshot[] {
  return Array.isArray(value) && value.length<=priceItems.length && new Set(value.map(v=>v?.item_code)).size===value.length && value.every(v=>
    v && typeof v==="object" && Object.keys(v).every(key=>["item_code","unit_price_ron","normalized_unit","supplier_id","supplier_name","catalog_item_id","applied_at","source_type","is_override"].includes(key)) &&
    priceItems.some(([code,,unit])=>code===v.item_code && unit===v.normalized_unit) &&
    (v.unit_price_ron===null ? v.source_type==="manual" && v.is_override===true : typeof v.unit_price_ron==="string" && /^\d+(?:\.\d{1,6})?$/.test(v.unit_price_ron) && !pricingError(v.unit_price_ron)) &&
    [v.supplier_id,v.catalog_item_id].every(id=>id===null || typeof id==="string" && uuid.test(id)) &&
    (v.supplier_name===null || typeof v.supplier_name==="string" && v.supplier_name.length<=120) &&
    typeof v.applied_at==="string" && /(Z|[+-]\d{2}:\d{2})$/.test(v.applied_at) && Number.isFinite(Date.parse(v.applied_at)) &&
    typeof v.is_override==="boolean" && ["manual","manual_catalog"].includes(v.source_type) &&
    (v.source_type!=="manual_catalog" || v.catalog_item_id!==null && v.is_override===false));
}
export function manualSnapshot(code:string,value:string|null,previous?:ProjectPriceSnapshot,appliedAt=new Date().toISOString()):ProjectPriceSnapshot {
  const definition=priceItems.find(([id])=>id===code);
  if(!definition)throw new Error("Cod de preț necunoscut.");
  return {item_code:code,unit_price_ron:value,normalized_unit:definition[2],supplier_id:previous?.supplier_id || null,
    supplier_name:previous?.supplier_name || null,catalog_item_id:previous?.catalog_item_id || null,applied_at:appliedAt,source_type:"manual",is_override:true};
}
export function migrateManualSnapshots(entries:{item_code:string;unit_price_ron:string;updated_at:string}[],snapshots?:ProjectPriceSnapshot[]):ProjectPriceSnapshot[] {
  const result=structuredClone(snapshots || []);
  for(const entry of entries)if(!result.some(s=>s.item_code===entry.item_code))result.push(manualSnapshot(entry.item_code,entry.unit_price_ron,undefined,entry.updated_at));
  return result;
}
export function priceStateSignature(configuration:unknown,pricing:PricingDraft,snapshots:ProjectPriceSnapshot[],projectId:string|null=null){return JSON.stringify({configuration,pricing,snapshots,projectId});}

export function snapshotsMatchPrices(snapshots:ProjectPriceSnapshot[],entries:{item_code:string;unit_price_ron:string}[]):boolean {
  const canonical=(value:string)=>{const [whole,fraction=""]=value.split(".");const rest=fraction.replace(/0+$/,"");return `${whole.replace(/^0+(?=\d)/,"")}${rest ? "."+rest:""}`;};
  return snapshots.every(snapshot=>{const entry=entries.find(e=>e.item_code===snapshot.item_code);return snapshot.unit_price_ron===null ? !entry : !!entry && canonical(entry.unit_price_ron)===canonical(snapshot.unit_price_ron);});
}

export function snapshotFingerprint(snapshots:ProjectPriceSnapshot[]):string {
  return JSON.stringify(snapshots.map(s=>({item_code:s.item_code,unit_price_ron:s.unit_price_ron===null ? null:s.unit_price_ron.replace(/^0+(?=\d)/,"").replace(/(\.\d*?)0+$/, "$1").replace(/\.$/,""),
    normalized_unit:s.normalized_unit,supplier_id:s.supplier_id,supplier_name:s.supplier_name,catalog_item_id:s.catalog_item_id,
    applied_at:new Date(s.applied_at).toISOString(),source_type:s.source_type,is_override:s.is_override})).sort((a,b)=>a.item_code.localeCompare(b.item_code)));
}
