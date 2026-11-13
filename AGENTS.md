# FORMA engineering conventions

## Read first

Before changing code, read [docs/README.md](docs/README.md), [docs/agent-handoff.md](docs/agent-handoff.md), [docs/INIT.md](docs/INIT.md) and [docs/services-and-deployment.md](docs/services-and-deployment.md). These are the central onboarding/context pack. Follow the user's latest instructions over an older handoff snapshot. Do not mistake implemented cloud support for completed account setup or deployed code. Keep onboarding and feature documentation together in `docs/`.

## Scope

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain. Shared platform functionality must remain domain-agnostic, while calculation rules and domain-specific validation must remain isolated.

The current POC is exclusively focused on furniture and particleboard (PAL) wardrobes. Furniture has temporary sketch upload, deterministic mock review, editable configuration, SVG preview, cutting/material/ABS/hardware calculations, manual pricing and browser project persistence by default. Supabase setup is intentionally deferred; retain the implemented SQLite/cloud code for explicit later API-mode activation.

## Architecture

- `frontend/` contains Next.js App Router, React, TypeScript, and Tailwind CSS with source under `src/`.
- `backend/` contains a Python FastAPI package under `src/forma/` and pytest tests.
- `docs/architecture.md` records architectural boundaries and future directions.
- `/` is the platform domain selector. Furniture routes live under `/domenii/mobilier`, with `/proiect-nou` and `/proiecte` children.
- `frontend/src/config/domains.ts` is the single source for domain definitions, availability, and furniture routes. Unavailable domains have null routes and static cards.
- The furniture layout owns its shared header and navigation. Preserve the existing Minimal Premium tokens, components, and `forma-mode` localStorage preference.
- HTTP endpoints use the `/api` prefix. Public furniture endpoints include mock `analyze-sketch`, `calculate`, `estimate` and read-only `project-capabilities` under `/api/v1/furniture`. Health remains `GET /api/health`. Project CRUD routes are mounted only in an explicitly enabled storage mode; cloud mode verifies bearer identity and ownership on every operation.
- Backend input validation is centralized in `domains/furniture/schemas.py`, shared by mock interpretation and panel calculation. Keep the frontend POC ranges aligned with this schema.
- Calculation requires `{ configuration, confirmed: true }`, uses the fixed FORMA POC v1 profile, and is independent of the image and mock provider. Use Decimal arithmetic and JSON decimal strings. Panel `area_m2` includes quantity, `unit_area_m2` describes one piece, and HDF totals remain separate from PAL.
- Extend the same calculation with `edge_banding` and `hardware`, derived from its existing panels. Each PAL panel has four explicit `edges`; HDF uses null. Length-axis end edges measure `width_mm`, width-axis end edges measure `length_mm`, and `width_start` is the front of carcass/shelf panels. Keep cutting dimensions separate from net banding lengths and the zero procurement allowance.
- FORMA v1 hardware uses actual door height for hinge thresholds, four supports per adjustable shelf, one handle per door, four connectors at each top/bottom assembly, and HDF perimeter intervals at most 150 mm with shared corners counted once. Label hinge and HDF quantities as preliminary estimates and expose all assumptions. Return a complete result or fail the calculation.
- Wardrobe review rules live in `frontend/src/features/furniture/wardrobe-configuration.ts`. Keep image state generic and separate from furniture interpretation, editable draft, and confirmed configuration. Clear derived state when an image changes.
- AI will produce structured interpretations. Deterministic Python domain logic will calculate geometry, materials, hardware, and costs.
- Current interpretation must use deterministic mock data. Do not integrate paid AI APIs, install the OpenAI SDK, or make external AI requests.

## Conventions

- Current POC default: `NEXT_PUBLIC_PROJECT_STORAGE=browser` saves validated project inputs/metadata in localStorage with no account/Supabase setup. Keep API/SQLite/cloud code intact; select it only with `api`. Never silently fall back between stores or migrate/upload/delete data on a mode switch. Browser CRUD/capabilities need no HTTP; calculations still use FastAPI. Never add images, sessions or derived totals to project records. Explain device/origin isolation, shared-browser visibility and possible data loss. See `docs/browser-projects.md`.

- SQLite project persistence is local-only: explicit `FORMA_ENV=local` and `ENABLE_LOCAL_PROJECTS=true`, never on Render. Cloud projects require explicit `ENABLE_CLOUD_PROJECTS=true`, Supabase Auth verification and per-user PostgreSQL RLS. Default routes stay absent; configured public CRUD requires a verified bearer token. Never use service_role/secret keys, trust owner headers, or treat CORS as authentication. See `docs/free-online-setup.md` and `docs/project-persistence.md`.
- The user requires free services only. Do not activate paid plans, paid add-ons or billing. Supabase Free setup is manual and has quotas/pausing; never promise unlimited/free-forever infrastructure. Google OAuth avoids requiring a separate email delivery service. Do not add real AI.
- `domains/furniture/projects.py` reuses current input validators; `project_store.py` uses stdlib SQLite, explicit transactions and numbered schema initialization. Save inputs, never image blobs or authoritative derived totals. Preserve UUIDs on edit, require revision checks, and block incompatible historical profiles/calculation versions instead of silently migrating them.

- Furniture pricing lives in `domains/furniture/pricing.py`: reuse quantity calculation, match stable item codes, and obtain prices via the small PriceProvider boundary. Manual RON input is the only current source. Missing positive-quantity prices make final totals null; explicit zero is valid. See `docs/future-supplier-pricing.md` for rounding, allowances and future adapters.

- Write code, identifiers, filenames, and technical documentation in English. User-facing UI copy is Romanian.
- Keep frontend presentation and backend calculations separate.
- Prefer simple functions, explicit types, Pydantic boundary validation, and minimal dependencies.
- Add modules when implementation requires them. Keep HTTP handlers thin as domain functionality is introduced.
- Keep shared platform code independent of furniture assumptions. Introduce concrete domain modules under `forma/domains/<domain>/` when calculation or domain-specific validation is implemented.
- Future backend boundaries include shared services, domain logic, interpretation, projects, and exports. See `docs/architecture.md` before adding these capabilities.
- Enable a new domain only after its routes and supported workflow are implemented and verified. Avoid registries, abstract base classes, and dynamic plugin loading without an existing concrete need.
- Use npm and commit `frontend/package-lock.json`. Manage Python dependencies in `backend/pyproject.toml`.
- Never commit secrets, virtual environments, generated builds, or dependency directories.
- Do not introduce product UI, AI integrations, furniture calculations, databases, authentication, Docker, or external services without a task requesting them.
- Preserve existing behavior and run relevant checks before completing changes.
- Do not push or publish/deploy without explicit user permission. Keep feature/setup docs in `docs/` current with implementation and deployment changes; never record secrets or assert unverified live service state.

## Validation

From `frontend/`, run `npm run lint`, `npm run typecheck`, and `npm run build`.
Run `npm test` for configuration, SVG, pricing, project and auth behavior. Verify upload, mock review, field validation, confirmation, result recovery, image replacement and project lifecycle as relevant. Run frontend type generation and build sequentially because both write generated `.next` files.
From `backend/`, after installing `.[dev]` in a virtual environment, run `python -m pytest`.
Verify the dashboard, furniture homepage, upload/review/result, project history/editor, profile and legacy redirect. Check active navigation, mode persistence and unavailable domain paths. Cloud mock tests are not evidence that live SQL RLS, Google OAuth or multi-device access has been configured; test those explicitly before claiming verification.
Start the backend and verify `GET http://localhost:8000/api/health` returns `{"status":"ok"}`.
See `docs/INIT.md` for full Windows/macOS/Linux setup and `docs/troubleshooting.md` for known issues. Read `frontend/AGENTS.md` and the relevant locally installed Next.js guide before framework-specific frontend work.
