# Agent handoff and current project context

Source/context snapshot: 2026-11-13. Read [INIT](INIT.md) for installation, then [services and deployment](services-and-deployment.md). This is a handoff snapshot, not a substitute for reading the user's current request and inspecting current Git/dashboard state.

## Product and communication

FORMA is a modular estimation platform. The implemented POC is exclusively **wardrobes made from PAL**. Other domains are visible but unavailable. UI and explanations to the owner are Romanian; code, identifiers and technical docs are English.

Use the established Minimal Premium design: background `#F8F7F4`, white surface, charcoal `#22201E`, secondary `#817C75`, warm accent `#EAD9C9`, Geist and Lucide. Keep mobile layouts intentional at 360/390/430 px and desktop constrained. Avoid new component frameworks or unrelated product features.

## Implemented in source

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

The owner is handling Supabase/Google account setup. Its actual Supabase project URL/ref and completed dashboard configuration are **not recorded in this repository** at the audit. Do not invent them or assume setup is finished. Real Google login, live database RLS and multi-device sync still require owner configuration and real-account verification.

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
8. Keep all list/read/update/duplicate/delete operations owner-scoped. RLS must also protect direct database API access. CORS and hidden buttons are not authorization.
9. Default project CRUD stays absent. Local SQLite requires explicit local flags, loopback access and no Render runtime. Cloud mode requires configured auth and never falls back to public SQLite after failure.
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

At the last code verification before this documentation task, 156 backend tests and 48 frontend tests passed, alongside ESLint, TypeScript, production build and Pages export. Production dependency audit reported zero findings. Pre-existing Node module-type and Starlette TestClient warnings were present; do not confuse them with a failing test. Re-run relevant checks after code changes instead of treating this snapshot as a permanent guarantee.

Backend cloud tests use fake Auth/PostgREST responses. They exercise API ownership/revision behavior but do not execute the SQL policies on a real Supabase instance. Browser automation was unavailable in the last implementation sessions; mobile/desktop screenshots, actual Google OAuth and multi-device cloud behavior were not visually verified. A new agent should use browser tooling if now available and state what it actually observed.

For the current activation work, use [free online setup](free-online-setup.md): apply SQL, configure Google/provider redirect URLs, set the separate Render/GitHub variables, authorize deployments, then test with two real users and a second device. Do not deploy unauthenticated project storage or upgrade a plan to work around setup errors.
