# Furniture PDF exports

## Scope and entry points

The furniture result and saved-project editor expose **Exportă PDF** inside the pricing section. The choices are **Deviz pentru client** and **Fișă tehnică pentru atelier**. Exports use the confirmed configuration and current visible estimate; there is no new calculation engine, database activation, supplier refresh, authentication or third-party PDF service.

Set up the reusable issuer profile at `/setari/date-firma`, also linked from the furniture profile and PDF choices. The export link opens settings in a separate tab so the unsaved sketch/project remains mounted. After saving, use **Reîncarcă datele firmei** in the original project tab. Company identity is shared issuer information across domains; supplier/customer lists remain domain-owned.

Give the project a name in its existing save form. The name is now mirrored into temporary project context, including unsaved edits, and restored with saved projects. Saving the project is not mandatory for PDF export; unsaved documents are explicitly labeled and omit the unavailable project ID.

## Library and architecture

- `jspdf` **4.2.1** generates A4 portrait PDFs in the browser. `jspdf-autotable` **5.0.9** supplies repeating table headings, wrapped cells, multi-page flow and row-page-break avoidance. Both are open source and installed through the normal npm lockfile. Their modern browser support and direct vector primitives avoid another React renderer, HTML screenshot capture or cloud conversion.
- `frontend/src/features/pdf/pdf-data.ts` prepares validated discriminated document DTOs. The quotation DTO allowlists only company identity, project identity/configuration, final selling price and validity. It never receives the estimate's internal financial lines, markup, labor, supplier catalog or snapshots.
- `pdf-layout.ts` owns shared company header, project summary, text flow, tables, vector drawing and page footer. `generate-pdf.ts` selects the document template and returns an ArrayBuffer; it has no persistence or network behavior.
- `pdf-fonts.ts` fetches the bundled same-origin Lato Regular/Bold TTF files, then embeds used glyphs in the document. The OFL license is committed beside them under `frontend/public/fonts/`. No runtime font request goes to Google or another third party.
- `pdf-export-actions.tsx` owns the accessible choices, readiness/errors, generation lock, dynamic imports, download and object-URL cleanup. The heavy PDF code loads only when exporting. Changes to project inputs/company state cancel an in-flight export before download. Repeated clicks do not create duplicate exports.
- `company-profile.ts` validates/stores issuer data and the bounded logo. `company-settings.tsx` is the form; no company information is posted to the backend.

Official library references: [jsPDF](https://github.com/parallax/jsPDF), [AutoTable options](https://github.com/simonbengtsson/jsPDF-AutoTable#options), [Lato font/license source](https://github.com/google/fonts/tree/main/ofl/lato). These references are documentation, not services used during PDF generation.

## Client quotation

The quotation includes company/contact details and optional logo, project name/UUID when available, generation date, random document reference, dimensions, door/shelf counts, final quoted RON amount, optional default client-visible notes and validity period. The amount is explicitly **Preț estimativ fără TVA**. VAT is not calculated or inferred from tax/registration fields. It is an estimate, not a fiscal invoice, signature or binding contractual commitment.

The final quotation is disabled until the visible estimate is current, complete and has no missing item codes. Missing rates are explained in the choices when reported by the estimate. Stale/invalid pricing hides the old amount and blocks client export. A zero price remains distinct from a missing price.

No internal unit/purchase prices, supplier names/prices, markup percentage, production costs or labor breakdown are rendered. Default notes are entered by the user and explicitly described as client-visible; the app cannot classify arbitrary confidential text the user deliberately types into them. Do not put internal commercial information in these notes.

References use `FORMA-YYYYMMDD-<random token>`, not an invoice sequence or tax authority reference. Metadata includes title, project name, date, type and FORMA as generating application. Download filenames use sanitized, length-bounded project names and ISO dates; company/contact details are not added to filenames.

## Workshop sheet

Sprint 14C adds a manufacturing-aware branch when a detached process snapshot and a matching current dimensional result exist. Its title is **Fișă tehnică de verificare**; it includes finished/raw/quantized tables, profile name/version/supplier, processing rules, carcass/overall depth, readiness and unverified warnings. The original nominal table is explicitly a separate financial basis. Missing/currently unavailable manufacturing results block this branch; incomplete settings remain visibly unverified, never production-approved. Legacy PDF output/disclaimers and client quotation allowlisting remain unchanged. See [manufacturing profiles](manufacturing-profiles.md), including synthetic PDF regeneration/rendering commands.

The technical sheet uses the current validated `WardrobeCalculationResult`: project/configuration identity, proportional front elevations (interior and doors), net PAL/HDF totals, cutting dimensions/thickness/quantities, assigned panel edges, net ABS 2/0.4 mm totals and per-edge lengths, hardware quantities/rules and construction assumptions/warnings.

Drawing geometry calls the same pure `createWardrobeLayout` function as the interactive SVG. A uniform drawing-to-page scale preserves width/height proportions. Depth is a numeric label; panel thickness in the elevation remains schematic. No new material, cutting, banding, hinge or cost formula is introduced. Technical dimensions/edge lengths come directly from existing backend fields. No drilling positions, nesting, whole-sheet purchasing or certified manufacturing plan is implied.

The sheet includes: “Document tehnic estimativ. Dimensiunile și soluțiile constructive trebuie verificate înainte de debitare și execuție.” It has no financial prices or final amount. It may be exported without any prices/estimate, provided the confirmed geometry has a valid matching calculation. When the backend is offline and no current calculation is available, export remains disabled; the app never fabricates a cutting list.

## Company data and logo

The browser key is `forma:company-profile:v1`, containing `{schema_version:1, profile}`. Only the display name is required. Contact person, telephone, email, address, website, registration/tax identifiers, logo, default notes and validity are optional. Email/HTTP(S) URL/length checks are applied; website credentials and unsupported fields are rejected. Optional validity is an integer 1–365 days. This is a user's commercial validity choice, not an automatic legal rule.

Logos accept **PNG and JPEG only**, maximum **128 KiB**, dimensions **1–2048 px per axis**. MIME and actual signature must agree, browser decoding must succeed, and the stored base64 data URL is bounded. WebP/SVG/remote logos are unsupported. Temporary object URLs are revoked. The image remains a local data URL and is embedded directly in the PDF. Without a logo, a typographic company header is used.

Storage quota/access errors show a clear failure and preserve previous data. Corrupt/unknown versions are reported without clearing them or silently replacing them with empty data. The settings form stays blocked when existing storage cannot be read safely. No passwords, tokens or credentials belong in this profile.

Profile/issuer data is specific to the current site origin/browser/device, not an account, cloud store or encrypted backup. Other users of the same browser profile can access it. Clearing site data can remove it. Sprint 14B includes company profile/logo in [local full backups](backup-and-recovery.md); cloud sync is not implemented. Profile saves use last-write-wins across tabs and block while a restore journal is pending; avoid editing the profile in multiple tabs simultaneously.

## Saved project prices and freshness

The saved editor restores the project's manual price catalog/snapshot and asks the existing backend for its estimate. The export component consumes the current visible estimate; it never reads the global supplier catalog. Catalog changes therefore cannot alter an old quotation. The existing confirmed catalog-price refresh is the only path that deliberately replaces the project's applied rates.

Manual edits and unsaved project configuration/name changes are reflected in export readiness. Geometry requires reconfirmation/recalculation; financial changes require a new estimate. A confirmed new snapshot/estimate enables the quotation again. Export itself does not write project/catalog records or persist derived financial totals.

## Rendering and download limitations

White A4 pages use restrained beige table headings, charcoal text, consistent margins, embedded Unicode text and vector furniture elevations. Page numbers and document headers/footers repeat. Tables repeat column headings and avoid splitting a row unless it is taller than a usable page, which current bounded fields avoid. Long text wraps and flows across pages.

The browser receives a Blob download after asynchronous generation. Modern desktop/mobile browsers are targeted; actual download behavior depends on browser settings. iOS may show a preview/share workflow or require the Downloads list. No native-phone end-to-end download test has been performed. Accessibility of the app controls does not imply the generated PDF is PDF/UA-tagged or PDF/A archival compliant; those standards are not implemented.

Generation is local, but it is not guaranteed offline: opening the deployed application, loading its lazy JS/font assets, or calculating/recalculating materials/prices may need connectivity. The existing Geist UI font remains fetched at Next build time; the newly bundled PDF fonts do not change that existing behavior.

## Validation and sample PDFs

Run the normal frontend lint/typecheck/test/build commands and backend pytest suite from [INIT](INIT.md). `tests/pdf-export.test.mjs` covers profile persistence/corruption/quota, optional fields, logo formats/decoding, client-field isolation, incomplete/stale estimates, current visible state, historical snapshots, filename safety, real PDF/font generation, font paths, generation errors and duplicate-click protection.

Generate reproducible **synthetic** samples from `frontend/`:

```powershell
node scripts/generate-pdf-samples.mjs
```

Outputs are intentionally ignored under `output/pdf/`: one-page client quote, four-page workshop sheet, two-page long-name/logo quotation and a 13-page pagination stress fixture. The stress fixture repeats rows artificially and is explicitly unsuitable for execution. No real company/customer data is used.

Optional local inspection (not a runtime/backend dependency): install `PyMuPDF==1.26.6` and `pypdf==7.0.1` into a development environment, then from the root run:

```powershell
.\backend\.venv\Scripts\python.exe frontend/scripts/inspect-pdf-samples.py
```

The script extracts text, checks Romanian glyphs, page dimensions, numbering, text bounding boxes, embedded vector drawing presence and client/technical information separation, then renders every page and a stress overview. Inspect the PNGs as well; text extraction alone does not validate layout. The sample PDFs and rendered normal/long/stress pages were actually inspected during Sprint 12, including repeated table headers and the drawing. Native browser UI/mobile downloads were not visually verified because the available Chrome automation had previously denied access; do not describe PDF inspection as an end-to-end phone test.

Sprint 12 local checks passed: ESLint, TypeScript, 96 frontend tests, 165 backend tests, standard production build and static GitHub Pages build. A first sandboxed build failed to retrieve the existing Geist UI font; rerunning with permitted network access passed. Production npm dependency audit reported zero advisories. Existing test-only Node module-type and Starlette/httpx deprecation warnings remain. No live deployment was performed.

## Extending templates

Keep validation/data preparation separate from layout and download handling. Add future client-visible fields explicitly to the quotation allowlist; never pass the entire estimate/project record into a client template. Reuse authoritative calculation DTOs and the shared drawing geometry. New templates must retain embedded fonts, safe filenames, bounds/line wrapping, multi-page tests and actual rendered sample inspection. Fiscal invoicing, VAT rules, signatures and external services need separate explicit requirements.
