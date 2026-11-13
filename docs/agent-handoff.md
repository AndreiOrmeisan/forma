# Agent handoff and current project context

Source/context snapshot: 2026-11-13. Read [INIT](INIT.md) for installation, then [services and deployment](services-and-deployment.md). This is a handoff snapshot, not a substitute for reading the user's current request and inspecting current Git/dashboard state.

## Product and communication

FORMA is a modular estimation platform. The implemented POC is exclusively **wardrobes made from PAL**. Other domains are visible but unavailable. UI and explanations to the owner are Romanian; code, identifiers and technical docs are English.

Use the established Minimal Premium design: background `#F8F7F4`, white surface, charcoal `#22201E`, secondary `#817C75`, warm accent `#EAD9C9`, Geist and Lucide. Keep mobile layouts intentional at 360/390/430 px and desktop constrained. Avoid new component frameworks or unrelated product features.

## Implemented in source

Owner's post-Sprint-11 adjustment: supplier access is exclusively inside Furniture, with a prominent home card and highlighted header button. The global dashboard has no catalog action. `/setari/furnizori` is compatibility redirection only. Catalog data uses domain-specific keys, and backups carry `domain_id`. Previous unscoped data/backups belong to furniture only and remain preserved. Future customers should follow this domain-local organization; customer CRUD is not implemented.

Sprint 11 adds `/domenii/mobilier/furnizori`: browser-local supplier/offer CRUD, explicit preferred active rates, sheet-to-area normalization, safe JSON merge/replace backups and reusable project price snapshots. New projects prefill after backend quantity calculation; saved projects refresh prices only after a preview/confirmation/backend estimate. Manual overrides remain protected by default. No new services/dependencies/DB flags or external supplier access. Read [supplier catalog](supplier-catalog.md) before modifying this flow. Project envelope v1 is read without startup rewrites; explicit saves use v2. Backend project DTOs accept additive snapshots; calculation rules remain unchanged.

**Latest owner decision:** postpone Supabase/database configuration during the POC. Only a Supabase account was created. Default `NEXT_PUBLIC_PROJECT_STORAGE=browser` enables localStorage save/history/edit/duplicate/delete on localhost and GitHub Pages with no login. Preserve all API/SQLite/cloud code for later `api` mode; do not resume external setup unless requested. Browser data is device/profile/origin-specific, not private per-account or synced, and may be lost when cleared. See [browser saving](browser-projects.md).

- Domain dashboard; furniture homepage; persisted Simplu/Profesional mode (`forma-mode`).
- Camera/gallery image selection; JPEG/PNG/WebP <=10 MB; content/type/decoding validation, object-URL cleanup and temporary preview.
- Fixed, explicitly labeled mock interpretation; editable validated dimensions/door/shelf counts; confirmation and refresh recovery.
- Reusable SVG 2D view (interior/doors), proportions/dimensions, invalid-input handling.
- Deterministic cutting list, separate PAL/HDF areas, net ABS and provisional hardware quantities.
- Manual RON prices, cost-only waste allowances, fixed labor, commercial markup and detailed deviz excluding VAT.
- Project saving/history/editing/duplication/deletion using the same validated inputs and calculators. Local SQLite is explicitly opt-in.
- Private online account support in code: official Supabase JS sessions/Google OAuth, verified backend bearer identity, PostgreSQL owner filtering and RLS migration.
- Project-name fields remain editable before login/storage readiness. Saving itself waits for availability, valid inputs and login in cloud mode.

## External activation / release state

The owner created a Supabase account only and then deferred configuration. The current POC does not need it. Actual project URL/ref and dashboard setup are not recorded; do not invent them or activate them automatically. Future Google login, RLS and multi-device sync still need explicit API-mode configuration and real-account verification.

Feature-reference commits are `fea950a` (persistence/history) and `115da6d` (cloud account preparation and editable names). At the start of this documentation task they existed locally ahead of the tracked remote. These are historical source references, not instructions to reset/checkout/cherry-pick or a permanent statement about the remote. Run `git status --short --branch`, inspect current log/remote and check deployed SHAs before continuing. Do not push without explicit user permission.

GitHub CLI metadata confirmed repository visibility **PUBLIC** and default branch **main** on 2026-11-13. The frontend address and Render API were established earlier; their latest deployed feature versions were not verified during this documentation audit. The web tool could not fetch those public addresses. Do not describe that as proof of an outage or claim the newest source is live.

## Non-negotiable engineering boundaries

1. **Free services only.** No paid plans/add-ons/billing activation; do not promise unlimited/free-forever provider capacity.
2. **No real AI.** No OpenAI SDK, paid AI or external AI requests. Supabase Auth/PostgREST are authorized account/storage services, not AI integrations.
3. Python domain logic owns quantities and financial totals. Reuse the current engines; never accept client material quantities as authoritative or add a second calculator in React.
4. Use Decimal strings across JSON for exact dimensions/areas/prices. Costs use explicit HALF_UP cents; markup is not profit margin and no VAT is applied.
5. Missing price != explicit zero. Missing required prices produce an incomplete deviz and no final selling price.
6. Keep original mock response, editable draft, confirmed configuration and pricing separate. Never store image blobs in localStorage or a database.
7. Cloud project ownership comes from verified Supabase Auth, never an owner header/body field. Use public publishable/anon keys + the user token; never administrative/secret/service-role keys.
8. Keep all cloud list/read/update/duplicate/delete operations owner-scoped. RLS also protects direct database API access; CORS/hidden buttons are not authorization. Browser POC data is shared by people using that browser profile, not account-private.
9. Default backend project CRUD stays absent while default frontend browser CRUD works locally. SQLite requires explicit local flags, loopback and no Render runtime. API mode requires selected storage/auth and never silently falls back to browser or public SQLite.
10. Preserve project UUID on edit, revision checks on update/delete, explicit deletion confirmation and historical profile/schema compatibility warnings. No silent historical recalculation under new rules.

## Where to work

| Area | Main entry points |
| --- | --- |
| Domain catalog/navigation | `frontend/src/config/domains.ts`, `src/components/`, `src/app/domenii/mobilier/` |
| Generic upload | `frontend/src/components/image-upload/` |
| Workflow state | `frontend/src/features/furniture/wardrobe-project-context.tsx`, generic `image-draft-context.tsx` |
| Review / 2D / forms | `frontend/src/features/furniture/wardrobe-*`, new-project review route |
| Result / pricing | `wardrobe-calculation.tsx`, `wardrobe-pricing-form.tsx`, `wardrobe-estimate-sections.tsx` |
| Project history / edit / save | `project-api.ts`, `project-list.tsx`, `project-editor.tsx`, `project-save-form.tsx` |
| Browser auth | `frontend/src/features/auth/`, root AuthProvider, `/domenii/mobilier/profil` |
| API composition/config | `backend/src/forma/main.py`, `config.py`, `api/` |
| Deterministic rules / pricing | `backend/src/forma/domains/furniture/` |
| Local/cloud project stores | `project_store.py`, `cloud_project_store.py`, `projects.py` |
| Default browser projects | `frontend/src/features/furniture/browser-project-store.ts`, `project-contract.ts`, `frontend/src/config/project-storage.ts` |
| Verified cloud identity | `backend/src/forma/shared/cloud_auth.py` |
| RLS / PostgreSQL schema | `backend/migrations/001_cloud_projects.sql` |
| Automated tests | `backend/tests/`, `frontend/tests/`; frontend fixtures are test-only data |

Paths abbreviated in the table after the frontend entries are within their stated directory; inspect [architecture](architecture.md) for full responsibilities.

## Known limitations and easy mistakes

- The furniture homepage's `RecentProjects` component is still a static empty-state presentation. Actual saved history is on `/domenii/mobilier/proiecte`; do not mistake the homepage widget for proof that the database is empty.
- Unsaved image workflows lose temporary state on full refresh. Saved projects reopen from their inputs without the photograph. These are different behaviors.
- Account login opens a popup to preserve the current sketch tab. Popup blockers must be handled; switching accounts/logout clears private draft state. Save before navigating away or changing accounts.
- Manual draft prices are temporary until a project save succeeds. The SDK's auth session and the mode preference can use browser storage; image blobs do not.
- SQLite data is laptop-specific and is not automatically imported into Supabase. Images, PDFs, sheet nesting, actual AI and supplier price retrieval are not implemented.
- SVG panel thickness is schematic. Hardware rules are provisional, not a manufacturer's verified installation schedule.
- Scope is still wardrobe POC: no additional furniture/domain calculators, supplier scraping, tax/invoicing engine or PDF export.
- Critical styling repair: Tailwind's custom Turbopack loader targets **`globals.css` only**. Applying it to every `*.css` breaks CSS Modules/class exports and makes the upload flow look unstyled. Do not reinstall Tailwind or rewrite UI before inspecting that configuration.
- This Next.js version has local bundled documentation. Read `frontend/AGENTS.md` and relevant `frontend/node_modules/next/dist/docs/` guides before using framework APIs. Static Pages exports need valid client/Suspense boundaries; they do not supply a Next.js backend.

## Verification baseline and next checks

Current POC storage verification has 156 backend tests and 59 frontend tests passing, plus lint/TypeScript, production build and default-browser Pages export. Storage tests simulate reload, CRUD/revisions, blocked/full/corrupt data, deferred-backend recovery and API isolation; they are not screenshots or real multi-device sync. Re-run relevant checks after source changes rather than treating this snapshot as a guarantee. Existing Node module-type and Starlette TestClient warnings are not failing tests.

Backend cloud tests use fake Auth/PostgREST responses. They exercise API ownership/revision behavior but do not execute the SQL policies on a real Supabase instance. Browser automation was unavailable in the last implementation sessions; mobile/desktop screenshots, actual Google OAuth and multi-device cloud behavior were not visually verified. A new agent should use browser tooling if now available and state what it actually observed.

For current POC work use [browser saving](browser-projects.md), without Supabase setup. Only if requested later, follow [free online setup](free-online-setup.md), select frontend `api` mode, configure auth/RLS and both deployments, then test two real users and a second device. No automatic upload/migration, unauthenticated public database or paid upgrade.
