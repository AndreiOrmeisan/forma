# Personal supplier and price catalog

## Current scope and access

First enter **Mobilier & Tâmplărie**, then open the prominent **Furnizori și prețuri** card or highlighted furniture header button, at `/domenii/mobilier/furnizori` (GitHub Pages adds the existing `/forma` base path). There is no global catalog link on the domain-selection dashboard. Old `/setari/furnizori` bookmarks redirect to furniture, including static GitHub Pages builds. The catalog starts empty. All prices are entered by the user; there are no market/demo prices, supplier requests, scraping, AI calls or synchronization jobs.

Suppliers and offers belong to their domain. Future customer management must follow the same domain-local routing/ownership principle, rather than a shared global list. There is no customer-management feature yet. Domain storage isolation alone does not implement another domain's item schemas, pricing rules or calculators.

No additional installation, environment variable, account, database or paid service is required. Keep `NEXT_PUBLIC_PROJECT_STORAGE=browser` and backend persistence flags disabled for the deployed POC. The catalog stays browser-local even if project API mode is selected later; switching project stores does not move it.

Browser data is origin/profile/device-specific and visible to anyone sharing that profile. Localhost and GitHub Pages have separate data. Clearing site data or private-session cleanup can remove it. This is neither encrypted account storage nor cloud backup.

## Models and ownership

Sprint 14C adds optional supplier `status:active|archived` and reversible archive controls for manufacturing associations. Missing status preserves legacy active behavior without rewriting data. Archive does not change offers or active/preferred price resolution; historical price snapshots stay frozen. Multiple local [manufacturing profiles](manufacturing-profiles.md) can reference a supplier or remain standalone. Deleted/archived supplier references are retained with warnings instead of reassignment. Profiles/settings remain distinct from commercial prices and have their own versioned store/backup section.

`frontend/src/features/catalog/catalog-model.ts` defines suppliers and offers. Stable item codes and calculation units derive from the existing `wardrobe-pricing.ts` list: `pal_18`, `hdf_3`, `abs_2`, `abs_0_4`, `hinges`, `shelf_supports`, `handles`, `cabinet_connectors`, `hdf_fasteners`. Names do not participate in price matching. Material/thickness metadata must remain compatible with the fixed current construction profile.

Suppliers have UUIDs, a required name, optional website/contact/notes and UTC creation/update timestamps. Links accept HTTP(S), reject embedded credentials and are never fetched by the app. Deletion needs confirmation and is blocked while any offer references the supplier, including inactive offers.

Offers have independent UUIDs, supplier references, optional product metadata, manual source, active state and explicit preferred state. Several suppliers may offer the same code. At most one active preferred offer exists per code; selecting a new default explicitly clears the prior preference. Inactive offers cannot be preferred. No cheapest/latest/first-offer fallback exists, even with only one unpreferred active offer.

`CatalogRepository` is the typed persistence boundary; `createLocalCatalogRepository(domainId)` isolates browser keys, write locks and revisions by domain. `localCatalogRepository` is explicitly the furniture instance. Existing item validation and `ManualCatalogPriceSource` support furniture only; future domains must supply their own item definitions/validation and pricing sources before being enabled. Do not add placeholder adapters or generic plugin loading.

## Units and price precision

Direct rates support RON/m², RON/m and RON/piece as appropriate for each stable code. PAL/HDF also support whole-sheet purchase rates with integer dimensions from 1 to 10,000 mm. Other direct-unit offers omit sheet dimensions. Rolls and packs are explicitly unsupported, never interpreted as one meter/piece.

Sheet area = width × length / 1,000,000 m². The conversion factor is that area; direct-unit factors are 1. Equivalent rate = sheet price / area, rounded **HALF_UP to six decimal places** to fit the existing backend unit-price contract. BigInt decimal arithmetic performs this rate normalization; positive rates that round to zero or exceed the existing price limit are rejected. Price input supports zero, at most six decimals and the existing 1-billion-RON limit.

Equivalent area pricing is not procurement of whole sheets. There is no nesting, sheet-count rounding, roll/pack conversion or currency conversion. Enter rates excluding VAT for the current before-tax estimate. Freight is not automatically included. Python still owns all quantities, line rounding and financial totals through the unchanged calculation/estimate endpoints.

## Project lifecycle and snapshots

After confirmed geometry has been calculated by the existing backend, new unsaved projects resolve only positive-quantity item codes. Active preferred offers fill untouched empty price fields and are sent to the existing backend estimate endpoint. Missing offers remain missing; active offers without a default display a selection-needed explanation. Backend failure leaves the project unchanged and offers a retry/manual path.

Each applied project snapshot stores code, normalized price/unit, supplier ID/name, catalog offer ID, application timestamp, source and an explicit override marker. These are copied values, not live joins. Renaming/deleting a supplier or changing/replacing the catalog never rewrites saved projects. Manual project edits affect only the project, retain source references for traceability and mark an override. Clearing a field is also an explicit override with a null price.

**Actualizează prețurile din catalog** loads a revision-bound preview of old/new rates, source, missing/selection-needed offers. Manual overrides are retained by default; the user can explicitly turn retention off. Missing offers never erase an existing project rate. Confirmation checks the catalog revision, recalculates through the backend, then updates the temporary project state. For an already saved project, it also saves only the price catalog/snapshots with project revision protection; other unsaved configuration/metadata changes still require the usual project save. No successful backend recalculation means no price write.

The existing backend `PriceEntry` remains a manual user-input contract, with supplier label/date metadata. A user-maintained catalog is not an external supplier integration. Snapshot provenance (`manual_catalog` versus manual override) is stored separately; the cost engine is unchanged. Backend project DTOs accept optional validated snapshots for retained opt-in API storage, without enabling any persistence flags or supplier CRUD routes.

## Storage migration and safety

- Furniture catalog: `forma:supplier-catalog:furniture:v1`, `{schema_version:1, revision, suppliers, items}`. Other domain IDs get independent keys/revisions. The old `forma:supplier-catalog:v1` catalog is furniture-only legacy data: read it only when the furniture key is absent. Opening does not rewrite/delete it; the next explicit furniture edit writes the scoped copy. Existing scoped data, including an empty catalog, always wins. A corrupt scoped catalog raises an error instead of falling back. No other domain reads the legacy key.
- Projects retain their stable `forma:wardrobe-project:v1:<UUID>` keys. Readers accept envelope storage versions 1 and 2; new writes use version 2. The domain/calculation schema stays version 1 because geometry rules have not changed.
- Legacy prices without snapshots are synthesized in memory as manual overrides, preserving their exact rates and original price timestamps. Opening/listing does not rewrite storage. A normal explicit save persists the additive metadata in envelope v2.
- Unknown/corrupt data is preserved and reported, never cleared/reset. Unrelated storage keys and mode/session preferences are untouched. Snapshots must match persisted price values; duplicate codes, malformed prices and incompatible units are rejected.
- Web Locks serialize same-origin catalog writes where supported, with expected revision checks. Without Web Locks, avoid concurrent tab edits; localStorage is not a transactional multi-user database. Quota/access errors never report a successful write.

## Manual backup

Export downloads `forma-mobilier-catalog.json`, a versioned `forma-supplier-catalog` JSON containing suppliers/offers only, with an export timestamp and `domain_id: furniture`. Cross-domain imports are rejected. Previous backups without a domain are accepted only as furniture backups. Sprint 14B applies one 16 MiB UTF-8-byte limit to compact export/import, retaining 500 suppliers and 3,000 offers. Oversized exports fail without truncation. Strict shape/version/IDs/references/units/prices/URLs/preferences are checked before any write; unknown fields such as images are rejected. Full backups and corrupted catalog recovery are separately available at [Backup and recovery](backup-and-recovery.md), including when normal catalog loading fails.

The user previews counts and warnings and confirms one mode:

- **Merge:** preserve every existing UUID record; skip conflicting IDs even if incoming data looks newer. Add new records. If an incoming default conflicts with an existing default, demote the incoming offer with an explicit preview warning.
- **Replace:** explicitly replace the whole catalog after showing the current removal count. Saved project keys and frozen snapshots are unaffected.

Import rechecks the catalog revision and writes one validated envelope. Backup is manual transfer, not sync. Project export/import remains outside this feature; this file does not contain projects or sketches.

## Future external suppliers

An authenticated backend repository will require identity, ownership checks and database isolation before catalog migration. Never expose unauthenticated shared CRUD. A future supplier API/feed adapter needs supplier authorization and terms-of-service compliance, exact product matching, validated unit conversions, price freshness, explicit currency policy, stock uncertainty, VAT inclusion/exclusion, shipping costs and user approval before applying prices. Do not implement scraping or paid endpoints as a shortcut. Current supplier/product URLs are references only.

## Validation and manual review

Automated coverage is in `frontend/tests/supplier-catalog.test.mjs`, existing browser/project/pricing suites and `backend/tests/test_projects.py`. It exercises CRUD, explicit defaults, sheet normalization, import conflicts, malformed/quota/stale storage, legacy migration, snapshots/overrides and confirmed refresh ordering. Run the existing commands in [INIT](INIT.md), including backend regressions. No dependency was added.

Post-Sprint-11 domain-organization validation: ESLint passed without warnings, TypeScript passed, all 80 frontend tests passed (including domain storage isolation, non-destructive legacy migration, domain-bound backups and visible furniture-only navigation). The earlier Sprint 11 backend regression suite passed all 165 tests; this adjustment does not change backend code. Both standard production and `GITHUB_PAGES=true` static-export builds are checked before handoff. Existing Node module-type and Starlette/httpx deprecation warnings remain in test output. These checks do not establish live deployment status.

Visual review is still required at 360/390/430 px and desktop: inspect empty catalog, add/edit forms, filters, equivalent sheet label, delete dialog, backup preview and project price-refresh preview. During Sprint 11, Chrome was discovered but Computer Use access was not approved; no rendered screenshot/mobile visual verification is claimed.
