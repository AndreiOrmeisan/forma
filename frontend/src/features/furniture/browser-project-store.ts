import { isProject, projectUuid, type FurnitureProject, type ProjectInput, type ProjectPage } from "./project-contract";
import { pricingError } from "./wardrobe-pricing";

export const browserProjectPrefix = "forma:wardrobe-project:v1:";
const lockName = "forma:wardrobe-project-writes:v1";
type StoredProject = ProjectInput & {id:string; created_at:string; updated_at:string; revision:number};
const inputFields = ["domain","name","description","status","confirmed_configuration","manual_price_catalog","waste_allowances","labor_cost","markup_percentage","schema_version","construction_profile_id","calculation_version"];

export class BrowserProjectError extends Error {
  constructor(message:string, public status=422) {super(message);}
}

function storage(): Storage {
  try {
    if (typeof window === "undefined") throw new Error();
    const value = window.localStorage;
    value.getItem(browserProjectPrefix + "availability");
    return value;
  } catch {
    throw new BrowserProjectError("Browserul nu permite salvarea locală. Permite datele site-ului sau folosește o fereastră normală. Nu am salvat proiectul.", 0);
  }
}

export function browserProjectCapabilities() {
  try {storage();return {enabled:true,requires_auth:false,storage:"browser" as const,reason:null};}
  catch(reason){return {enabled:false,requires_auth:false,storage:"browser" as const,reason:reason instanceof Error ? reason.message : "Salvarea în browser nu este disponibilă."};}
}

function onlyKeys(value:unknown, allowed:string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every(key=>allowed.includes(key));
}

function validateInput(value:unknown, historical=false): ProjectInput {
  const fail = () => {throw new BrowserProjectError("Datele proiectului sunt invalide sau incompatibile. Verifică numele, configurația și prețurile. Datele existente nu au fost șterse.");};
  if (!onlyKeys(value,inputFields)) return fail();
  const input = value as unknown as ProjectInput;
  const compatible = input.schema_version === 1 && input.construction_profile_id === "forma-wardrobe-poc-v1" && input.calculation_version === "wardrobe-v1";
  if ((!historical && !compatible) || !Number.isSafeInteger(input.schema_version) || input.schema_version < 1 ||
    typeof input.construction_profile_id !== "string" || !input.construction_profile_id || typeof input.calculation_version !== "string" || !input.calculation_version) return fail();
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > 120 || (input.description !== null && (typeof input.description !== "string" || input.description.length > 2000))) return fail();
  if (!onlyKeys(input.confirmed_configuration,["width_mm","height_mm","depth_mm","doors_count","shelves_count","furniture_type"]) ||
    !onlyKeys(input.waste_allowances,["pal","hdf","abs"])) return fail();
  const decimal = (v:unknown, percentage=false) => typeof v === "string" && v.length <= 32 && /^\d+(?:\.\d{1,6})?$/.test(v) && !pricingError(v,percentage);
  if (!decimal(input.labor_cost) || !decimal(input.markup_percentage,true) ||
    ![input.waste_allowances.pal,input.waste_allowances.hdf,input.waste_allowances.abs].every(v=>decimal(v,true))) return fail();
  if (!Array.isArray(input.manual_price_catalog) || input.manual_price_catalog.length > 100 ||
    new Set(input.manual_price_catalog.map(entry=>entry?.item_code)).size !== input.manual_price_catalog.length) return fail();
  for (const entry of input.manual_price_catalog) {
    if (!onlyKeys(entry,["item_code","item_name","unit","unit_price_ron","currency","source_type","source_name","updated_at"]) ||
      !decimal(entry.unit_price_ron) || typeof entry.item_name !== "string" || !entry.item_name || entry.item_name.length > 200 ||
      typeof entry.source_name !== "string" || !entry.source_name || entry.source_name.length > 200 ||
      typeof entry.updated_at !== "string" || !/(Z|[+-]\d{2}:\d{2})$/.test(entry.updated_at)) return fail();
  }
  const candidate = {...input,name,id:"00000000-0000-4000-8000-000000000000",created_at:new Date().toISOString(),updated_at:new Date().toISOString(),revision:1,compatible,deviz_complete:null,warnings:[]};
  if (!isProject(candidate)) return fail();
  return structuredClone({...input,name});
}

function record(stored:StoredProject): FurnitureProject {
  const compatible = stored.schema_version === 1 && stored.construction_profile_id === "forma-wardrobe-poc-v1" && stored.calculation_version === "wardrobe-v1";
  return {...stored,compatible,deviz_complete:null,warnings:compatible ? [] : ["Versiunea proiectului este incompatibilă. Editarea și recalcularea sunt blocate; datele originale au fost păstrate."]};
}

function read(id:string): FurnitureProject {
  if (!projectUuid.test(id)) throw new BrowserProjectError("Identificatorul proiectului este invalid.",404);
  const raw = storage().getItem(browserProjectPrefix+id);
  if (raw === null) throw new BrowserProjectError("Proiectul nu există în acest browser sau a fost șters.",404);
  try {
    const envelope = JSON.parse(raw);
    if (!onlyKeys(envelope,["storage_version","project"]) || envelope.storage_version !== 1 ||
      !onlyKeys(envelope.project,[...inputFields,"id","created_at","updated_at","revision"])) throw new Error();
    const {id:storedId,created_at,updated_at,revision,...input} = envelope.project;
    if (storedId !== id || !Number.isSafeInteger(revision) || Number(revision) < 1 ||
      ![created_at,updated_at].every(v=>typeof v === "string" && Number.isFinite(Date.parse(v)))) throw new Error();
    const validated = validateInput(input,true);
    return record({...validated,id,created_at:created_at as string,updated_at:updated_at as string,revision:revision as number});
  } catch {
    throw new BrowserProjectError("Proiectul salvat nu poate fi citit în această versiune. Nu am șters și nu am înlocuit datele existente.",409);
  }
}

function list(limit:number,offset:number): ProjectPage {
  const source = storage(), projects:FurnitureProject[] = [], warnings:string[] = [];
  const keys = Array.from({length:source.length},(_,index)=>source.key(index)).filter((key):key is string=>!!key && key.startsWith(browserProjectPrefix));
  for (const key of keys) {
    try {projects.push(read(key.slice(browserProjectPrefix.length)));}
    catch {warnings.push("Un proiect salvat nu poate fi citit. Celelalte proiecte sunt disponibile; datele incompatibile au fost păstrate.");}
  }
  projects.sort((a,b)=>Date.parse(b.updated_at)-Date.parse(a.updated_at) || a.id.localeCompare(b.id));
  return {items:projects.slice(offset,offset+limit),total:projects.length,limit,offset,warnings:Array.from(new Set(warnings))};
}

function write(project:StoredProject): FurnitureProject {
  // Persist only inputs and identity metadata. Never an image, session or derived total.
  const {id,created_at,updated_at,revision} = project;
  const input = Object.fromEntries(inputFields.map(key=>[key,project[key as keyof ProjectInput]]));
  const validated = validateInput(input);
  const clean = {...validated,id,created_at,updated_at,revision};
  try {storage().setItem(browserProjectPrefix+id,JSON.stringify({storage_version:1,project:clean}));}
  catch {throw new BrowserProjectError("Proiectul nu a putut fi salvat. Spațiul browserului poate fi plin sau blocat. Datele introduse rămân în pagină; nu am înlocuit proiectul existent.",0);}
  return record(clean);
}

async function mutation<T>(action:()=>T): Promise<T> {
  // Web Locks serialize concurrent writes across same-origin tabs where supported.
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(lockName,async()=>action());
  return action(); // Per-project keys avoid overwriting unrelated projects on older browsers.
}

function nowAfter(value?:string) {return new Date(Math.max(Date.now(),value ? Date.parse(value)+1 : 0)).toISOString();}
function conflict():never {throw new BrowserProjectError("Proiectul a fost modificat în altă filă sau versiunea este incompatibilă. Redeschide-l înainte de a salva.",409);}

export async function browserProjectRequest(path:string, options:RequestInit={}): Promise<unknown> {
  const [pathname,query] = path.split("?");
  const params = new URLSearchParams(query);
  const method = (options.method || "GET").toUpperCase();
  const body = () => {
    try {if (typeof options.body !== "string") throw new Error();return JSON.parse(options.body);}
    catch {throw new BrowserProjectError("Datele proiectului sunt invalide.");}
  };
  if (pathname === "projects" && method === "GET") {
    const limit=Number(params.get("limit") || 20),offset=Number(params.get("offset") || 0);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 || !Number.isSafeInteger(offset) || offset < 0) throw new BrowserProjectError("Paginarea proiectelor este invalidă.");
    return list(limit,offset);
  }
  if (pathname === "projects" && method === "POST") return mutation(()=>{
    const input=validateInput(body()),id=crypto.randomUUID(),now=nowAfter();
    return write({...input,id,created_at:now,updated_at:now,revision:1});
  });
  const match = /^projects\/([0-9a-f-]+)(\/duplicate)?$/i.exec(pathname);
  if (!match || !projectUuid.test(match[1])) throw new BrowserProjectError("Proiectul nu există în acest browser.",404);
  const id = match[1].toLowerCase();
  if (method === "GET" && !match[2]) return read(id);
  return mutation(()=>{
    const current = read(id);
    if (method === "POST" && match[2]) {
      if (!current.compatible) return conflict();
      const input = Object.fromEntries(inputFields.map(key=>[key,current[key as keyof ProjectInput]]));
      const now=nowAfter(current.created_at);
      return write({...validateInput({...input,name:("Copie — "+current.name).slice(0,120),status:"draft"}),id:crypto.randomUUID(),created_at:now,updated_at:now,revision:1});
    }
    if (method === "PATCH" && !match[2]) {
      const patch = body();
      const mutable = ["name","description","status","confirmed_configuration","manual_price_catalog","waste_allowances","labor_cost","markup_percentage"];
      if (!onlyKeys(patch,["expected_revision",...mutable]) || !Number.isSafeInteger(patch.expected_revision) || Number(patch.expected_revision)<1) throw new BrowserProjectError("Modificările proiectului sunt invalide.");
      if (patch.expected_revision !== current.revision || !current.compatible) return conflict();
      const input = Object.fromEntries(inputFields.map(key=>[key,current[key as keyof ProjectInput]]));
      const changes = Object.fromEntries(Object.entries(patch).filter(([key])=>key !== "expected_revision"));
      return write({...validateInput({...input,...changes}),id,created_at:current.created_at,updated_at:nowAfter(current.updated_at),revision:current.revision+1});
    }
    if (method === "DELETE" && !match[2]) {
      const revision=Number(params.get("expected_revision"));
      if (!Number.isSafeInteger(revision) || revision<1) throw new BrowserProjectError("Revizia proiectului este invalidă.");
      if (revision !== current.revision) return conflict();
      try {storage().removeItem(browserProjectPrefix+id);}
      catch {throw new BrowserProjectError("Browserul nu a permis ștergerea proiectului. Încearcă din nou.",0);}
      return null;
    }
    throw new BrowserProjectError("Operația nu este disponibilă pentru acest proiect.");
  });
}
