# FORMA engineering conventions

## Scope

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain. Shared platform functionality must remain domain-agnostic, while calculation rules and domain-specific validation must remain isolated.

The current POC is exclusively focused on furniture and particleboard (PAL) wardrobes. Furniture has sketch upload, deterministic mock review, editable configuration, an SVG preview, and a deterministic panel cutting list with separate net PAL/HDF areas.

## Architecture

- `frontend/` contains Next.js App Router, React, TypeScript, and Tailwind CSS with source under `src/`.
- `backend/` contains a Python FastAPI package under `src/forma/` and pytest tests.
- `docs/architecture.md` records architectural boundaries and future directions.
- `/` is the platform domain selector. Furniture routes live under `/domenii/mobilier`, with `/proiect-nou` and `/proiecte` children.
- `frontend/src/config/domains.ts` is the single source for domain definitions, availability, and furniture routes. Unavailable domains have null routes and static cards.
- The furniture layout owns its shared header and navigation. Preserve the existing Minimal Premium tokens, components, and `forma-mode` localStorage preference.
- HTTP endpoints use the `/api` prefix. Furniture exposes the multipart `POST /api/v1/furniture/analyze-sketch` mock and JSON `POST /api/v1/furniture/calculate`. Health remains `GET /api/health`.
- Backend input validation is centralized in `domains/furniture/schemas.py`, shared by mock interpretation and panel calculation. Keep the frontend POC ranges aligned with this schema.
- Calculation requires `{ configuration, confirmed: true }`, uses the fixed FORMA POC v1 profile, and is independent of the image and mock provider. Use Decimal arithmetic and JSON decimal strings. Panel `area_m2` includes quantity, `unit_area_m2` describes one piece, and HDF totals remain separate from PAL.
- Extend the same calculation with `edge_banding` and `hardware`, derived from its existing panels. Each PAL panel has four explicit `edges`; HDF uses null. Length-axis end edges measure `width_mm`, width-axis end edges measure `length_mm`, and `width_start` is the front of carcass/shelf panels. Keep cutting dimensions separate from net banding lengths and the zero procurement allowance.
- FORMA v1 hardware uses actual door height for hinge thresholds, four supports per adjustable shelf, one handle per door, four connectors at each top/bottom assembly, and HDF perimeter intervals at most 150 mm with shared corners counted once. Label hinge and HDF quantities as preliminary estimates and expose all assumptions. Return a complete result or fail the calculation.
- Wardrobe review rules live in `frontend/src/features/furniture/wardrobe-configuration.ts`. Keep image state generic and separate from furniture interpretation, editable draft, and confirmed configuration. Clear derived state when an image changes.
- AI will produce structured interpretations. Deterministic Python domain logic will calculate geometry, materials, hardware, and costs.
- Current interpretation must use deterministic mock data. Do not integrate paid AI APIs, install the OpenAI SDK, or make external AI requests.

## Conventions

- Project persistence is local-only: mount CRUD only with explicit `FORMA_ENV=local` and `ENABLE_LOCAL_PROJECTS=true`, and never on Render. Keep default/production routes absent; do not treat CORS or request headers as authentication. Bind local servers to loopback. See `docs/project-persistence.md`.
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

## Validation

From `frontend/`, run `npm run lint`, `npm run typecheck`, and `npm run build`.
Run `npm test` for wardrobe configuration rules. Verify upload, mock review, field validation, confirmation, result recovery, and image replacement.
From `backend/`, after installing `.[dev]` in a virtual environment, run `python -m pytest`.
Verify the dashboard, furniture homepage, new-project placeholder, projects route, and legacy redirect. Check active navigation, mode persistence, and that upcoming domain cards have no links or buttons and their paths return 404.
Start the backend and verify `GET http://localhost:8000/api/health` returns `{"status":"ok"}`.
See the root README for Windows commands.
