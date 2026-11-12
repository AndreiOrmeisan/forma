# FORMA engineering conventions

## Scope

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain. Shared platform functionality must remain domain-agnostic, while calculation rules and domain-specific validation must remain isolated.

The current POC is exclusively focused on furniture and particleboard (PAL) wardrobes. Furniture currently has the homepage, projects empty state, and new-project placeholder. Estimation functionality will be implemented in future tasks.

## Architecture

- `frontend/` contains Next.js App Router, React, TypeScript, and Tailwind CSS with source under `src/`.
- `backend/` contains a Python FastAPI package under `src/forma/` and pytest tests.
- `docs/architecture.md` records architectural boundaries and future directions.
- `/` is the platform domain selector. Furniture routes live under `/domenii/mobilier`, with `/proiect-nou` and `/proiecte` children.
- `frontend/src/config/domains.ts` is the single source for domain definitions, availability, and furniture routes. Unavailable domains have null routes and static cards.
- The furniture layout owns its shared header and navigation. Preserve the existing Minimal Premium tokens, components, and `forma-mode` localStorage preference.
- HTTP endpoints use the `/api` prefix. The current endpoint is `GET /api/health`.
- AI will produce structured interpretations. Deterministic Python domain logic will calculate geometry, materials, hardware, and costs.

## Conventions

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
From `backend/`, after installing `.[dev]` in a virtual environment, run `python -m pytest`.
Verify the dashboard, furniture homepage, new-project placeholder, projects route, and legacy redirect. Check active navigation, mode persistence, and that upcoming domain cards have no links or buttons and their paths return 404.
Start the backend and verify `GET http://localhost:8000/api/health` returns `{"status":"ok"}`.
See the root README for Windows commands.
