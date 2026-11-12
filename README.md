# FORMA

Manual wardrobe pricing is available on the result screen. Enter material/hardware unit prices, optional cost-only waste allowances, fixed labor and commercial markup, then explicitly apply them. Prices start empty; missing required prices produce an incomplete estimate. `POST /api/v1/furniture/estimate` recalculates quantities from confirmed configuration and returns Decimal monetary strings, rounded HALF_UP to cents, excluding VAT. See [pricing architecture](docs/future-supplier-pricing.md).

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain. Shared platform functionality must remain domain-agnostic, while calculation rules and domain-specific validation must remain isolated.

The current POC focuses on particleboard (PAL) wardrobes from photographs of hand-drawn sketches. The frontend provides domain selection, sketch upload, mock review and editing, SVG preview, cutting lists, edge banding, preliminary hardware estimates, and an empty projects page. The backend owns all deterministic material and hardware calculations.

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
| `/domenii/mobilier/proiect-nou/rezultat` | Confirmed configuration, cutting list, and net PAL/HDF areas |
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

Editable POC ranges are centralized in `frontend/src/features/furniture/wardrobe-configuration.ts` and match the backend's shared `WardrobeConfiguration` schema. The original response, editable draft, and confirmed configuration are separate. Confirmation opens `/domenii/mobilier/proiect-nou/rezultat`, which requests a cutting list from the backend. State stays in memory and resets when the image changes or the page reloads. The upload and review screens provide recovery links when that state is missing.

The review screen includes a live SVG front elevation driven by the editable draft. Switch between interior and door views independently of the form. Width and height remain proportional, depth is labeled separately, and panel thickness is schematic. Temporarily invalid input displays a validation state until the existing POC rules are satisfied.

### Deterministic panel calculation

`POST /api/v1/furniture/calculate` accepts an explicit confirmation and the existing configuration.

```json
{
  "configuration": {
    "width_mm": 800,
    "height_mm": 2000,
    "depth_mm": 600,
    "doors_count": 2,
    "shelves_count": 3,
    "furniture_type": "wardrobe"
  },
  "confirmed": true
}
```

The endpoint rejects missing or false confirmation, invalid configuration, and mock-response fields. It uses the fixed `forma-wardrobe-poc-v1` profile, which is returned with its construction assumptions. PAL is 18 mm, shelves are recessed by 50 mm, door gaps are 2 mm, and the surface-mounted HDF back is 3 mm. Two doors cover one continuous bay.

Decimal arithmetic preserves fractional dimensions such as a 397.5 mm door for an 801 mm wide wardrobe with two doors. Decimal dimensions and areas are serialized as JSON strings. A panel's `unit_area_m2` is its single-piece net area, while `area_m2` includes its quantity. PAL and HDF totals are separate. The standard two-door wardrobe above produces 6.162224 m² PAL, 1.6 m² HDF, and 10 pieces.

The backend calculation requires only confirmed dimensions and counts. The frontend displays server results with exact decimal formatting and recovery/retry states. Run `python -m pytest` in `backend/` and `npm.cmd test` in `frontend/` for the corresponding tests. The frontend calculation fixture is generated from the Python engine and is used only by tests.

### Edge banding and hardware, FORMA v1

The same calculation endpoint adds `edge_banding` and `hardware`. Existing panel dimensions, quantities, areas, and material totals retain their meaning. All estimates use the cutting-list panels from the same calculation. A failure in either new calculation fails the complete request.

Each PAL panel includes an `edges` object with four keys. With a length axis L and width axis W, `length_start` and `length_end` are the boundaries at the start/end of L and each measures `width_mm`. `width_start` and `width_end` are the boundaries at the start/end of W and each measures `length_mm`. For sides, top, bottom, and shelves, `width_start` denotes the front edge. The frontend renders this backend metadata directly.

The provisional profile applies ABS 2 mm to that front edge and to all four door edges. HDF has `edges: null` and is excluded from edge totals. The model supports `none`, `abs_0_4`, and `abs_2`, with zero ABS 0.4 mm assignments by default. Each edge exposes its physical length, net length per piece, and quantity-inclusive length. The response also exposes panel-level subtotals, exact meter totals by banding type, and total net meters. Procurement allowance is separately fixed at zero in this sprint. Banding quantities are independent of cutting dimensions.

Hardware uses the actual door height after the existing gaps. Hinges per door are 2 through 900 mm, 3 through 1600 mm, 4 through 2200 mm, and 5 above 2200 mm. Every configured shelf is adjustable with four supports. Each door receives one handle, and the top/bottom assembly uses four connectors per horizontal panel.

For an HDF panel of length L and width W, the provisional fastener count per panel is `2 × (ceil(L / 150) + ceil(W / 150))`. Each side is divided into intervals at most 150 mm long and shared corners are counted once. The count is multiplied by the number of HDF panels. This is a preliminary quantity estimate. Hinge selection also depends on door weight, width, material, and manufacturer specifications. Final fastener positioning and selection require installation verification.

For the standard wardrobe, ABS 2 mm is derived as `(2 × 2000 + (2 + 3) × 764 + 2 × 2 × (1996 + 397)) / 1000 = 17.392 m`. ABS 0.4 mm and procurement allowance are zero. Hardware is 8 hinges, 12 shelf supports, 2 handles, 8 cabinet connectors, and 40 HDF fasteners, totaling 70 pieces. Decimal quantities remain exact strings in JSON. The result page displays the two new sections with expandable details and provisional assumptions.

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

### GitHub Pages deployment

`.github/workflows/deploy-pages.yml` builds the Next.js frontend and publishes `frontend/out` using GitHub Actions. The Pages publishing source must be set to GitHub Actions. The repository root contains documentation and source files. The deploy artifact contains the exported application.

The workflow sets `GITHUB_PAGES=true` and uses the Pages base path, `/forma` for this repository. Exported routes include trailing slashes so direct navigation and refresh work on Pages. Standard local builds retain the Next.js server configuration. The legacy `/proiect-nou` route uses a client redirect in static exports.

GitHub Pages serves the frontend. The FastAPI mock endpoint requires a separately hosted HTTPS backend. Set repository Actions variable `NEXT_PUBLIC_API_BASE_URL` to that backend URL and allow the Pages origin in backend `CORS_ORIGINS`, then rerun the workflow. Without that backend configuration, domain selection and local image preview are available, while mock review displays the connection error and retry action.

### Repository creation

If GitHub CLI is unavailable, install it, open a new terminal, authenticate, and publish from the repository root.

```powershell
winget install --id GitHub.cli --exact
gh auth login
gh repo create forma --private --source=. --remote=origin --push
```

See `AGENTS.md` and `docs/architecture.md` for engineering conventions and future scope.

## Domain extension strategy

Add a domain's routes and deterministic backend implementation when its product scope is approved. Keep its schemas, validation, and calculation rules together. Reuse platform services for common project lifecycle, file handling, and exports as those capabilities are implemented. AI interpretation will produce inputs that each domain validates before deterministic calculation. Enable the catalog entry only when its destination is implemented and verified. See `docs/architecture.md` for the proposed backend boundaries.
