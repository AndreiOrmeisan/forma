# Sprint 13 — Professional workshop readiness audit

## Record provenance

The referenced audit file was absent from this checkout and had no Git history at the start of Sprint 14A. This document reconstructs the original findings from the prior audit recorded in the working-session context; it is not a claim that the missing original file was recovered byte-for-byte. Original IDs, severities, conclusions and key evidence are retained below. Sprint 14A status is appended separately; other findings have not been fixed or re-audited by this change.

## Original assessment (Sprint 13)

**NO-GO for direct unsupervised workshop cutting.** Supervised estimation remains possible with explicit construction/cutting checks and manual review. Two P0, three P1, seven P2 and two P3 findings were recorded. Original checks: 96 frontend tests, 165 backend tests, lint, TypeScript and build passed. Synthetic PDFs of 1/4/2/13 pages were inspected. Browser approval timed out and public live addresses could not be fetched; neither native browser behavior nor deployed feature parity was verified.

### WR-01 — P1: Raw versus finished edge-banded dimensions are undefined

The profile does not define whether the listed cutting dimensions are raw boards or finished ABS dimensions, including any pre-milling. Reference doors are 1996 × 397 mm; adding 2 mm ABS at both ends without compensation produces 2000 × 401 mm. Workshop approval and a versioned convention are required before direct production. **Original finding retained; open.**

### WR-02 — P0: Invalid replacement destroys unsaved image and derived work

`SketchUploader.selectImage` cleared the active image before awaiting validation. The image-dependent provider reset then removed configuration, pricing and other derived work even when the candidate was rejected. Cancellation/overlap and URL lifetime required regression coverage. **Original finding retained; see Sprint 14A resolution below.**

### WR-03 — P0: Internal navigation destroys unsaved project state

Providers were scoped to the new-project route layout and saved editor. Same-tab links, including supplier catalog access, could tear down unnamed projects/configuration/pricing. The previous name-only save-form warning missed meaningful unnamed work and internal links. Local Next Cache Components/Activity could mask teardown; Pages explicitly disables `cacheComponents`, and Activity effect cleanup also makes URL lifetime relevant. **Original finding retained; see Sprint 14A resolution below.**

### WR-04 — P1: Catalog export can exceed its own import limit

A valid 900-offer catalog with 1950-character URL paths exported 2,336,572 characters / 2,338,372 bytes, exceeding the 2 MiB import cap. Its own backup could not be restored. **Original finding retained; open.**

### WR-05 — P1: Saved browser projects lack restorable backup

Catalog JSON export excludes projects. Browser saved records have no project export/import backup; clearing site storage/device loss can destroy them. **Original finding retained; open.**

### WR-06 — P2: Requested reference totals conflict with the panel arithmetic

For 800 × 2000 × 600 mm, two doors and three shelves, current consistent panel sums are PAL 6.162224 m², HDF 1.6 m² and ABS 2 mm 17.392 m; requested reference totals were PAL 6.300424 m² / ABS 17.404 m. Panels: sides 2000 × 600 (2), top/bottom 764 × 600 (1 each), shelves 764 × 550 (3), doors 1996 × 397 (2), HDF 800 × 2000 (1). Hardware: 8 hinges, 12 supports, 2 handles, 8 connectors, 40 HDF fixings. Do not force calculations to match inconsistent expected totals. **Original finding retained; open specification clarification.**

### WR-07 — P2: Depth semantics need clarification

Configured 600 mm is body depth; externally mounted 3 mm HDF and 18 mm doors can make nominal outer depth 621 mm. Clarify body versus finished exterior dimensions. **Original finding retained; open.**

### WR-08 — P2: Preview/PDF door depiction differs from applied-door construction

Shared SVG/PDF geometry depicts inset-looking doors rather than applied doors. Reference width ratio 0.4270073 differs from 397/800 = 0.49625; schematic side ratio 0.0456204 differs from 18/800 = 0.0225. Treat illustration as schematic, not manufacturing geometry. **Original finding retained; open.**

### WR-09 — P2: Homepage recent projects stays empty

The homepage `RecentProjects` component always renders its static empty state even when actual persisted history contains records. **Original finding retained; open.**

### WR-10 — P2: Corrupt catalog/company data lacks an accessible recovery path

Corrupt data is preserved, but catalog backup requires successfully loaded catalog data; company `ready=false` disables editing. Preservation alone does not provide usable recovery. **Original finding retained; open.**

### WR-11 — P2: Browser/CI and coherent saved-PDF coverage gaps

No browser E2E/backend CI coverage was established. A saved-PDF test saves PAL 47 but passes an unrelated estimate fixture (951.54); the original coherent manual probe passed, but that test does not prove consistent end-to-end recalculation. **Original finding retained; open.**

### WR-12 — P2: Network failure messaging is misleading

Manual estimation can show raw `Failed to fetch`; hosted review can refer to a local server. **Original finding retained; open.**

### WR-13 — P3: UTC reference date and printed local date can differ

At 13 November 23:30 UTC, Bucharest output prints 14 November while UTC-based reference/filename dates remain 13 November. **Original finding retained; open.**

### WR-14 — P3: Dense handlers/JSX increase maintenance risk

Several complex stateful handlers and rendering paths are compressed onto single lines, making lifecycle/integrity reviews harder. **Original finding retained; open.**

## Sprint 14A — WR-02 / WR-03 remediation

### WR-02 status: implemented; automated regression checks pass

- `SketchUploader.selectImage` validates before committing. Invalid candidates and cancelled picker changes leave the existing image/configuration/pricing untouched. Request sequence tokens reject stale completions and completions after unmount.
- Only a successful image commit changes the image URL and resets furniture state. Image ownership centrally revokes obsolete URLs; rejected/stale candidates cannot revoke the active URL. Delete is disabled during validation.
- Provider ownership moved above route/Activity boundaries; active sketch URLs are no longer revoked by route hiding/unmount effects.
- Evidence: `frontend/tests/unsaved-project.test.mjs` tests invalid replacement, cancelled camera/gallery inputs, newest-wins overlap, unmount, URL ownership and valid replacement/reset.

### WR-03 status: implemented; handler/state regression checks pass; native verification pending

- Root `ProjectWorkspace` owns one active temporary draft under `AuthProvider`, including Pages (`cacheComponents=false`). No browser storage snapshot/schema or image blob storage was added.
- `hasUnsavedProject` covers unnamed images/configurations, temporary invalid configuration edits, metadata, prices and price provenance. Existing saved-record comparisons reuse pricing restoration/fingerprints and snapshot migration.
- Capture-phase internal anchor handling opens an accessible native `<dialog>` with **Rămâi**, **Salvează proiectul**, **Continuă fără salvare**. Save requires a name and confirmed configuration/valid prices; unsaveable work can be retained or explicitly discarded. Failed persistence never resumes navigation. A successful write resumes only when no newer unsaved edit remains.
- Save form and guard share the provider's single pending write. Existing UUID/revision/conflict behavior remains unchanged. Configuration/pricing/PDF formulas and storage feature flags are untouched.
- Supplier links in the furniture header and project pricing use a separate tab, keeping the active draft in its original tab.
- Same-document Back/Forward uses stamped history positions while preserving Next state; traversal is bounced to the source before asking. Older/untracked entries restore the source state/URL and require explicit new navigation, potentially changing history shape. Cross-document traversal uses the native unload warning.
- Reload/close warnings are native `beforeunload`, in addition to internal handling. Browser policies, user activation and mobile process termination can suppress them. No crash/reload recovery for unsaved drafts is promised; the dialog explicitly explains that the image must be reselected after reload. Previously saved project inputs remain recoverable from the selected persistence store.
- Evidence: `navigation-protection.ts`, `project-navigation-guard.tsx`, `persist-project-draft.ts`, root provider composition, separate-tab links and `frontend/tests/unsaved-project.test.mjs`.

### Executed checks

- Frontend: **110 passing tests**, including 14 new regression tests; ESLint and TypeScript checks pass.
- Production builds: standard Next build and `GITHUB_PAGES=true` static export both pass (14 routes). The Pages build disables Cache Components as configured; no feature flags were changed.
- Backend: **165 passing tests**; one existing Starlette/httpx deprecation warning. No backend files modified.
- Existing Node test run also reports its pre-existing module-type warning; neither warning is a test failure.
- Browser automation discovery returned `The browser access host is unavailable`. No actual rendered/native workflow, screenshots, hydration/console capture, camera capture, browser warning text or focus trap was verified in this change. Component-handler tests and the deterministic event/history model do **not** prove native browser behavior.

### Required manual release checks

Serve the static Pages export with `/forma` base path and `cacheComponents=false`. On desktop and mobile: select a valid sketch, confirm configuration and prices without a name, try invalid/cancelled replacement, then a valid replacement; verify retention/reset. Edit a saved project's dimensions/prices/metadata; attempt navbar links and Back/Forward; test **Rămâi**, save failure (blocked storage/conflict), successful save, explicit discard, reload and tab close after user interaction. Open the supplier catalog in its separate tab and return. Confirm no duplicate project after repeated save clicks, no unexpected revision overwrite and no stale preview URL. Also check focus/keyboard escape, 360/390/430 px layouts, cross-document history and mobile browser lifecycle behavior.

The remaining original findings, especially WR-01/WR-04/WR-05, still block an unqualified professional workshop readiness claim. This remediation does not convert the original overall assessment to GO.

## Sprint 14B — WR-04 / WR-05 / WR-10 remediation

The original findings above describe the Sprint 13 implementation and are preserved. The statuses below supersede their historical open status for the tested local implementation; they do not claim live deployment or native browser E2E verification.

### WR-04 status: resolved in implementation, verified with regression tests

One shared UTF-8-byte policy now applies to catalog export/import: 16 MiB, retaining the existing 500-supplier / 3000-offer caps and v1 backup format. Compact exports are checked before download; over-limit data fails without truncation. The audit reproduction (900 offers, 1950-character URL paths, greater than 2 MiB) round-trips through both catalog and full-backup importers. Tests exercise exactly 16 MiB and one byte over, 3000/3001 offers, 500 suppliers, Romanian multibyte characters and a valid-record catalog whose export exceeds the supported byte cap. Previous valid furniture backups remain accepted. Evidence: `size-policy.ts`, `catalog-repository.ts`, `catalog-backup.tsx`, `backup-recovery.test.mjs`.

### WR-05 status: resolved in implementation, verified with regression tests

`/setari/backup-si-restaurare` exports a versioned `forma-backup` v1 envelope with all saved browser project envelopes, furniture catalog and company profile/logo. It validates and reparses the serialized file before offering download; corrupt owned data blocks a supposedly complete export. The preview is read-only. Merge lists/skips every ID conflict; explicit replacement affects only selected sections. IDs, configurations, historical timestamps, construction versions and exact saved prices/supplier snapshots survive restoration. Existing-record revisions are rebased to reject ordinary stale editors; new records retain incoming metadata. No sketch/draft/auth/server project data is exported, and no calculation/catalog price refresh occurs during restore. Evidence: full/partial/empty export/import, historical version, same-ID conflict, changed-current-catalog price, explicit replacement and unrelated-key tests in `backup-recovery.test.mjs`.

### WR-10 status: resolved for supported local records, verified with regression tests

Dedicated recovery inspection and raw record download do not depend on successful catalog/company loading. Discoverable recovery links remain outside disabled/loading normal forms. Corrupt or unknown-version project/catalog/company records are retained until explicitly replaced from a valid backup. Interrupted restores retain an allowlisted before/after journal; normal repository access blocks until recovery. Staging failure leaves data untouched; write failure rolls back; rollback failure lists exact keys/sections and retains the downloadable journal. Retry restores supported journals without overwriting a different concurrent value. Malformed/future journals intentionally require developer-assisted recovery after raw download; they are never guessed or automatically deleted. Evidence: corrupted records/raw artifact, explicit recovery, quota, interruption, normal-writer blocking, concurrent-value and rollback failure/retry tests.

### Sprint 14B executed checks and remaining gaps

- **130 frontend tests pass**, including **20 new backup/recovery regressions**. Existing PDF tests remain included; no PDF template or amount formula changed.
- ESLint (zero warnings) and TypeScript pass. Standard production build and `GITHUB_PAGES=true` export pass; the new static backup route is generated (15 build entries). One initial Pages build attempt was blocked by an already-running standard build; it passed when retried after that process completed.
- **165 backend tests pass**, including project/revision, pricing, calculations and health regressions. Existing Node module-type and Starlette/httpx deprecation warnings remain; no backend files, database flags or dependencies changed.
- Browser discovery again returned `The browser access host is unavailable`. No destructive testing was performed against real browser data. Actual download persistence, native quotas/process interruption, multi-tab isolation, mobile/desktop screenshots and clean-profile project→backup→restore→quotation E2E remain manual checks. Source/handler/Map-storage tests do not prove these native behaviors.
- localStorage has no cross-key transactions. The journal/locks/baselines provide staging, observed-conflict detection and explicit recovery, not serializable database guarantees or protection from browser data eviction/old clients. See [backup and recovery](../backup-and-recovery.md) for guarantees, revision policy, privacy and manual verification checklist.

WR-01 and the other untouched findings remain open; this sprint does not establish unconditional professional workshop readiness.

## Sprint 14C — Manufacturing profiles and dimensional contract

Original findings/evidence remain above. **WR-01:** the new opt-in dimensional adapter explicitly treats functional panel dimensions as finished dimensions and derives separate raw/quantized outputs from user-configured process contributions. Legacy `forma-wardrobe-poc-v1` formulas/output are unchanged and remain provisional. New ID `forma-wardrobe-manufacturing-v1` / `manufacturing-dimensions-v1` is stored in a detached optional project snapshot alongside its legacy geometry/financial basis. Net versus applied-minus-removal rules are exclusive; missing removal never implies zero. Precision/policy/tolerance are explicit. The ambiguity is addressed for the new path, but physical workshop approval remains outstanding; do not upgrade the entire application to production GO.

**WR-07:** new snapshots define carcass depth and explicit back/front projections; overall depth is null when either projection is missing. No default 621 mm installation envelope is invented. Legacy 600 mm meaning is unchanged. Actual hardware projections/clearances and physical envelope still require workshop verification. **WR-08:** schematic doors/preview geometry remain unchanged and open.

Profiles may be standalone or supplier-associated, draft/explicitly settings-validated/archived. Source changes never auto-update saved project snapshots or prices; refresh requires comparison/confirmation and normal project save/revision checks. Supplier archive/deletion retains process references with warnings and does not alter commercial price resolution. Full backup v2/profile store support retains old backup/project readers without automatic migrations; manufacturing writes use a v2 rollback journal. No DB activation, paid service, AI or financial formula change.

Readiness is split: financial completeness is separate from `legacy_provisional`, `configuration_incomplete`, `calculation_ready_unverified`. `workshop_approved` is unreachable without physical evidence, which is not modeled. New workshop PDFs explicitly say **Dimensiuni brute neconfirmate — verificare în atelier necesară**, show finished/raw/quantized rows and depth/process/readiness, and use a verification title. Legacy PDFs remain unchanged; client quotations still exclude process/supplier/internal-cost payloads.

Verification: **143 frontend tests**, including **13 new manufacturing tests**; **195 backend tests**, including **30 new manufacturing cases**, passed. Shared synthetic Python/TypeScript result fixture is checked. Legacy reference is still PAL **6.162224 m²**, HDF **1.600000 m²**, ABS 2 **17.392 m**, hardware **8/12/2/8/40**. TypeScript and lint pass; standard production and Pages export are checked. Existing module-type/Starlette warnings are not failing tests.

Two synthetic complete/incomplete-process workshop PDFs were generated, rendered with PyMuPDF and visually inspected (five pages each); no physical workshop testing was performed. Browser access host remained unavailable, so actual mobile/desktop selection/refresh and multi-tab browser workflow are not claimed verified. See [manufacturing profiles](../manufacturing-profiles.md) for exact rules, schemas, examples, commands, backup compatibility and remaining physical/release checks. Other original findings remain open unless a prior resolution explicitly states otherwise.
