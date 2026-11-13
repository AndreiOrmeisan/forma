import { isEstimate, pricingPayload, type Estimate, type PricingDraft } from "./wardrobe-pricing";
import type { WardrobeConfiguration } from "./wardrobe-configuration";
import type { ProjectPriceSnapshot } from "./project-price-snapshot";

export async function estimateWardrobe(configuration:WardrobeConfiguration,pricing:PricingDraft,snapshots:ProjectPriceSnapshot[],signal:AbortSignal):Promise<Estimate>{
  const base=process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const response=await fetch(`${base.replace(/\/$/,"")}/api/v1/furniture/estimate`,{method:"POST",headers:{"Content-Type":"application/json"},signal,
    body:JSON.stringify(pricingPayload(configuration,pricing,snapshots))});
  if(!response.ok)throw new Error("Devizul nu a putut fi calculat. Verifică datele și încearcă din nou.");
  const value:unknown=await response.json();
  if(!isEstimate(value))throw new Error("Răspunsul de calcul este incomplet sau invalid.");
  return value;
}
