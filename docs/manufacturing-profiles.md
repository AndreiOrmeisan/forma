# Manufacturing profiles and production dimensions — Sprint 14C

## Contract and boundaries

The optional dimensional adapter is **`forma-wardrobe-manufacturing-v1`**, calculation version **`manufacturing-dimensions-v1`**. It explicitly interprets existing geometry rows as **finished functional dimensions after edge processing** and computes separate raw/cutting outputs. This opt-in interpretation has a distinct dimensional identifier; it does not silently reinterpret the legacy profile.

Legacy `forma-wardrobe-poc-v1` / `wardrobe-v1` geometry, panel assignments, hardware and Decimal financial formulas remain unchanged. Root project construction/calculation identifiers continue to describe that nominal/financial basis. An additive snapshot records the separate dimensional ID/version and `geometry_basis:forma-wardrobe-poc-v1`. No automatic project migration or startup rewrite occurs. Without a snapshot, basic estimation works and manufacturing status is `legacy_provisional`; no raw dimensions are invented.

**Finished L × l** means dimensions after processing. **Raw exact L × l** is compensated board geometry. **Cutting L × l** is explicitly quantized raw geometry, subject to configured tolerance; it is not a physically approved cutting order. Python owns calculations; React never recomputes quantities or money.

## Models and persistence

`frontend/src/features/manufacturing/` owns typed validation, local repository, Romanian management/selection UI and API presentation. Backend `domains/furniture/manufacturing.py` owns Pydantic validation/Decimal arithmetic. Public stateless endpoint: `POST /api/v1/furniture/manufacturing-dimensions`, body `{configuration,confirmed:true,snapshot}`. No AI, external profile service or profile persistence endpoint.

Process profile v1 fields: UUID, name, nullable supplier UUID, schema version, optimistic revision, `draft|validated|archived` status, supported ABS types, per-type processing rules, nullable cutting precision/rounding/tolerance, `depth_convention:carcass_plus_projections_v1`, nullable back/front projections, notes and timezone-aware creation/update timestamps. Prices are not part of this model. Local key: `forma:manufacturing-profiles:furniture:v1`, envelope `{schema_version:1,domain_id:furniture,revision,profiles}`, maximum 200 profiles. Corrupt/unknown data remains intact and recoverable through the backup page.

New profiles have **no technical defaults**. Incomplete drafts are allowed; the checklist identifies missing settings. **Salvează ciorna** never validates automatically. **Validează explicit setările** requires complete valid fields and records only the user's explicit settings validation. Editing/saving validated settings returns them to draft. Archive prevents new selection; edit/save can restore a draft. No physical assembly evidence is modeled.

Project snapshots store snapshot schema, dimensional profile/calculation IDs, legacy geometry basis, selection timestamp, approval status at selection, supplier name/availability at selection and the entire profile including ID/schema/revision/rules/depth settings. Selection, refresh and removal require a readable comparison and explicit confirmation; normal project save is still required. No automatic saved-project/revision/price overwrite. Source edits never mutate applied snapshots. Derived dimensional results are temporary and are not stored as authoritative project data.

## Suppliers

Multiple profiles may reference one furniture supplier; standalone workshops need none. Suppliers gain optional `status:active|archived`; missing status retains legacy active interpretation without startup migration. Reversible archive controls are on the supplier page. Archive does not change commercial offers, active/preferred price flags or price selection. Existing deletion rules still block suppliers referenced by offers; process-profile references do not block deletion. The profile retains its supplier UUID and warns on archive/deletion/unavailability instead of reassignment. Historical supplier names/status are retained in snapshots. Refresh lists explicitly after another tab changes data.

## Edge rules and axes

Unbanded edges contribute zero. Supported bands are ABS 0.4 and ABS 2; future materials require an explicit schema/version decision. Choose **one** representation per supported type:

- `mode:net` with `net_contribution_mm`, or
- `mode:layers` with `applied_thickness_mm` and `removal_mm`; net = applied thickness − removed material.

Extra fields from the other representation are rejected. Missing/null pre-milling is unresolved, **not zero**. Explicit `"0"` is valid. A negative net contribution can represent removal exceeding application. There is only one subtraction:

`raw_dimension = finished_dimension - contribution(edge A) - contribution(edge B)`

Local coordinates map `top=length_start`, `bottom=length_end`, `left=width_start`, `right=width_end`. Top/bottom affect L; left/right affect l. These are panel axes, not inferred cabinet orientation/grain. Existing edge metadata remains authoritative: carcass/shelf front is `width_start`; doors have ABS 2 on all four edges; HDF is unbanded. Existing ABS lengths retain the full finished/nominal edge basis without new corner deductions.

Illustrations only — **not workshop defaults**:

| Finished width | Left/right contributions | Raw width |
| --- | --- | --- |
| 397 mm | 2 mm + 2 mm | 393 mm |
| 397 mm | 1 mm + 1 mm | 395 mm |
| 397 mm | applied 2 − removal 1, each side | 395 mm; no second pre-milling subtraction |
| 397.5 mm | 0.125 mm + 0.125 mm | 397.25 mm |

Authoritative arithmetic uses Decimal in an isolated precision-28 context. JSON millimeters are decimal strings, at most six fractional digits; exponent notation/nonfinite numbers/JSON floats are rejected. Safety bounds, not recommended settings: applied/removal/precision/tolerance ≤20 mm, net −20…20 mm, projections 0…1000 mm. Precision must be positive; tolerance/projections may explicitly be zero. Nonpositive raw/cutting dimensions are unresolved with issues, never negative cutting rows.

## Precision, depth and readiness

Cutting precision is an explicit step. `exact` requires a raw value to be a multiple; `half_up`, `ceil`, `floor` quantize to that step. No silent integer rounding. Missing precision/policy leaves cutting dimensions null even if raw exact dimensions are known. Quantization error beyond tolerance makes a cutting value unresolved. Missing tolerance is an issue; a displayed quantized candidate remains unverified.

Existing `depth_mm` remains carcass depth. Overall depth = carcass + explicitly configured back projection + front projection, each added once. No assumption equates projections with HDF/door thickness. Unknown offsets return null / **Adâncime totală neconfigurată**. Example 600+3+18=621 mm applies only when those exact projections were entered; it is not a default or verified installation envelope.

Financial readiness independently uses the current estimate: `complete|incomplete`. Manufacturing states:

| State | Rule |
| --- | --- |
| `legacy_provisional` | No manufacturing snapshot |
| `configuration_incomplete` | Missing required process/depth settings, unsupported/unconfigured assigned edge, nonpositive/invalid dimensions, quantization/tolerance issue, or archived selected profile |
| `calculation_ready_unverified` | Confirmed geometry and resolvable dimensional/depth calculations; draft settings still receive an explicit validation warning |
| `workshop_approved` | Reserved, **unreachable in this sprint** |

Financial completeness and explicit settings validation cannot prove physical fit. Highest attainable state always retains **Dimensiuni brute neconfirmate — verificare în atelier necesară.** Supplier availability warns separately and never grants approval.

## Financial and historical compatibility

PAL/HDF area, ABS lengths, hardware and money keep the legacy nominal basis. Raw area is not substituted into pricing; procurement yield/nesting needs a future versioned decision. Reference results remain PAL 6.162224 m², HDF 1.600000 m², ABS 2 17.392 m, 8 hinges, 12 shelf supports, 2 handles, 8 connectors, 40 HDF fasteners.

Project DTOs add optional `manufacturing_snapshot`; missing/null stays legacy. Browser envelopes v1/v2 remain readable; explicit saves with a snapshot use v3. Existing UUID/revision/conflict and price-snapshot behavior remain. Backend retained API stores accept the additive snapshot without SQL/flag/auth changes. Do not treat the snapshot as physical approval or replace the root financial profile version.

Full backups now export `forma-backup` **v2**, with optional section `manufacturing_profiles` containing the domain-bound store. Project snapshots remain independent of source-profile existence. V1 full and catalog-only backups stay importable and do not clear manufacturing data; a v1 file introducing manufacturing fields is rejected. Unsupported future profile/snapshot versions fail safely. Merge lists/skips conflicts; replace requires confirmation and rebases conflicting profile revisions without changing project snapshots. The restore coordinator adds the manufacturing Web Lock/allowlisted key and uses journal v2 for manufacturing changes, while retaining supported v1 recovery. Existing file limits/rollback limitations apply; see [backup and recovery](backup-and-recovery.md).

## UI and PDF

Route `/domenii/mobilier/profiluri-prelucrare`, linked from furniture profile/suppliers. Optional selectors appear in review and result/saved-editor pricing. Management opens separately to preserve the active draft. Selection/refresh presents old/proposed rules and requires confirmation. The result panel shows separate readiness, finished/raw/cutting tables, depth and issues; stale replies are rejected and backend errors can be retried. No backend means no invented manufacturing result/PDF.

Legacy PDFs retain existing output/disclaimers. A selected process adds **Fișă tehnică de verificare**, profile name/ID/schema/revision, supplier association/status, finished/raw/cutting tables, edge rules/axes, precision/rounding/tolerance, carcass/overall depth and explicit unverified warnings. The old nominal/financial-basis table is separately labeled. Client quotation DTOs still exclude suppliers, processes and internal costs. Source changes invalidate in-flight exports.

## Tests, PDF QA and remaining physical work

Synthetic tests: `backend/tests/test_manufacturing.py`, `frontend/tests/manufacturing.test.mjs`; a shared fixture checks the actual Python-to-TypeScript contract. Existing legacy/pricing/storage/14A/14B/PDF suites remain. Developer PDF QA commands (from the indicated directory):

```powershell
# backend/
.\.venv\Scripts\python.exe tests/generate_manufacturing_samples.py
# frontend/
node tests/generate-manufacturing-pdfs.mjs
# backend/ — optional developer PyMuPDF, not a runtime dependency
.\.venv\Scripts\python.exe tests/render_manufacturing_pdfs.py
```

Synthetic PDFs/PNGs live in ignored `output/pdf/`. Two five-page PDFs (complete/incomplete settings) were rendered and visually inspected. Browser discovery reported `The browser access host is unavailable`; actual native/mobile/desktop selection remains unverified. Handler/static-render tests are not browser E2E. Manual release checks: 360/390/430 px and desktop, profile comparison/refresh, archived/deleted supplier, saved/reopened project, old/new backup, backend retry, PDF export and confidential-data boundaries with isolated synthetic data.

The workshop must verify effective compensation under actual machinery/glue/pre-milling, cutting step/policy/tolerance, banding corners, panel orientation, physical fit and final projections including handles/clearances. No certified drilling/hinge design, nesting, procurement yield or installation envelope is claimed. WR-08's schematic applied-door illustration remains unchanged. Automated tests do not establish professional production approval.
