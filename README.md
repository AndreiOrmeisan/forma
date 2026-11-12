# FORMA

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain. Shared platform functionality must remain domain-agnostic, while calculation rules and domain-specific validation must remain isolated.

The current POC focuses on particleboard (PAL) wardrobes from photographs of hand-drawn sketches. The frontend provides domain selection, the furniture homepage, sketch upload, mock review and editing, a confirmed-configuration placeholder, and an empty projects page. The backend exposes application health and deterministic mock interpretation.

## Requirements

- Node.js 24 LTS and npm
- Python 3.12 or later with pip and venv
- Git

## Frontend

Run from the repository root. Commands use `npm.cmd` to work with Windows PowerShell execution policies. On macOS/Linux, use `npm`.

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000 to select a domain.

| Route | Purpose |
| --- | --- |
| `/` | Domain selection dashboard |
| `/domenii/mobilier` | Furniture homepage and persisted mode selector |
| `/domenii/mobilier/proiect-nou` | Validated sketch upload and camera input |
| `/domenii/mobilier/proiect-nou/verificare` | Mock wardrobe interpretation and editable configuration |
| `/domenii/mobilier/proiect-nou/rezultat` | Confirmed configuration placeholder |
| `/domenii/mobilier/proiecte` | Furniture projects empty state |
| `/proiect-nou` | Permanent redirect to the furniture new-project route |

`frontend/src/config/domains.ts` defines the domain catalog, availability, and furniture routes. Upcoming domains have null routes and render as static cards. The shared furniture layout includes a visible return link to domain selection. The mode selector preserves the existing `forma-mode` localStorage key.

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
```

## Backend

Run in a separate terminal from the repository root. On Windows, replace `python` with `py -3.12` if required by your installation.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn forma.main:app --reload --port 8000
```

On macOS/Linux, use `.venv/bin/python` for the virtual environment commands.

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
Invoke-RestMethod http://localhost:8000/api/health
```

The health endpoint returns `{"status":"ok"}`. Interactive API documentation is at http://localhost:8000/docs.

## Wardrobe review POC

Upload a sketch, then review and edit the demonstration configuration under `/domenii/mobilier/proiect-nou/verificare`. Start both applications for this workflow. The frontend uses `NEXT_PUBLIC_API_BASE_URL`, defaulting to `http://localhost:8000`.

`POST /api/v1/furniture/analyze-sketch` accepts a multipart `file` in JPEG, PNG, or WebP format up to 10 MB. The backend validates the declared MIME type and decodes the image, then returns fixed example wardrobe data with `is_mock: true`, `requires_confirmation: true`, and a demonstration notice. Interpretation is deterministic and independent of image content. External AI requests and paid AI integrations are prohibited in the current project.

Editable POC ranges are centralized in `frontend/src/features/furniture/wardrobe-configuration.ts`. The original response, editable draft, and confirmed configuration are separate. Confirmation opens `/domenii/mobilier/proiect-nou/rezultat`, which displays the configuration and a material-estimation placeholder. State stays in memory and resets when the image changes or the page reloads. The upload and review screens provide recovery links when that state is missing.

## Environment configuration

Local defaults work without environment files. `.env.example` documents configuration and an unused placeholder for future AI credentials. Copy the frontend variable to `frontend/.env.local` if needed. Set `CORS_ORIGINS` in the backend process environment, or place it in `backend/.env` and start Uvicorn with `--env-file .env`. Root `.env` files are not loaded automatically. Never put private credentials in `NEXT_PUBLIC_*` variables.

## Repository layout

```text
frontend/
  src/app/            Platform dashboard and domain-scoped routes
  src/components/     Shared presentation and furniture components
  src/config/         Typed domain catalog and routes
backend/
  src/forma/          FastAPI application and HTTP routes
  tests/              Backend automated tests
  pyproject.toml      Python package and dependencies
docs/architecture.md  Architectural boundaries
AGENTS.md             Engineering conventions for Codex
.env.example          Configuration placeholders
```

Dependency versions for the frontend are recorded in `frontend/package-lock.json`. Python compatible version ranges are declared in `backend/pyproject.toml`.

## GitHub setup

If GitHub CLI is unavailable, install it, open a new terminal, authenticate, and publish from the repository root.

```powershell
winget install --id GitHub.cli --exact
gh auth login
gh repo create forma --private --source=. --remote=origin --push
```

See `AGENTS.md` and `docs/architecture.md` for engineering conventions and future scope.

## Domain extension strategy

Add a domain's routes and deterministic backend implementation when its product scope is approved. Keep its schemas, validation, and calculation rules together. Reuse platform services for common project lifecycle, file handling, and exports as those capabilities are implemented. AI interpretation will produce inputs that each domain validates before deterministic calculation. Enable the catalog entry only when its destination is implemented and verified. See `docs/architecture.md` for the proposed backend boundaries.
