# FORMA architecture

## Architectural principle

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain. Shared platform functionality must remain domain-agnostic, while calculation rules and domain-specific validation must remain isolated.

The current POC exclusively targets furniture and particleboard (PAL) wardrobes. Electrical installations, plumbing, construction, interiors, and HVAC are future domains displayed as unavailable in the catalog.

## Current implementation

The monorepo contains independently installed Next.js and FastAPI applications. The frontend uses App Router, React, TypeScript, Tailwind CSS, Geist, and Lucide. Existing Minimal Premium design tokens remain in `src/app/globals.css`.

| Frontend route | Responsibility |
| --- | --- |
| `/` | Platform domain selection |
| `/domenii/mobilier` | Existing furniture homepage |
| `/domenii/mobilier/proiect-nou` | Validated sketch upload and camera input |
| `/domenii/mobilier/proiect-nou/verificare` | Deterministic mock interpretation and editable configuration |
| `/domenii/mobilier/proiect-nou/rezultat` | Confirmed configuration, cutting list, and separate net PAL/HDF areas |
| `/domenii/mobilier/proiecte` | Furniture projects empty state |
| `/proiect-nou` | Permanent redirect preserving earlier links |

`src/config/domains.ts` owns typed domain metadata and furniture route constants. Available entries require a route. Upcoming entries require a null route and render without interactive elements. Explicit App Router files determine which domains are reachable. A shared furniture layout provides navigation and a visible return link to the platform dashboard. The existing mode selector retains its `forma-mode` localStorage key and values across route changes and reloads.

Furniture components remain reusable at their existing paths. Domain boundaries are currently established through routing and configuration. Moving presentation components into domain directories can follow when another implemented domain gives that separation a concrete use.

The Python package uses a `src/forma` layout. `main.py` creates the application and registers middleware and routes. `config.py` reads CORS configuration. `api/health.py` owns `GET /api/health`, returning `{"status":"ok"}`. `api/furniture.py` exposes `POST /api/v1/furniture/analyze-sketch`. Shared upload validation checks MIME type, size, and decoding. The concrete furniture mock returns fixed demonstration values and confirmation flags. Current interpretation uses deterministic mock data and performs no external AI requests.

The furniture frontend keeps interpretation, editable draft, and confirmed configuration in a domain-specific provider inside the generic image provider. Replacing an image clears derived domain state while preserving the upload component lifecycle. Edit validation is centralized in `features/furniture/wardrobe-configuration.ts`. The result route sends the confirmed snapshot to the calculation endpoint and displays the returned values. State stays in memory and refreshes show recovery links.

### Wardrobe calculation boundary

`domains/furniture/schemas.py` owns the shared backend wardrobe input and calculation output contracts. `wardrobe_geometry.py` defines the fixed FORMA POC v1 profile and positive panel dimensions. `panel_calculation.py` uses an isolated Decimal context for exact areas and separate PAL/HDF totals. `POST /api/v1/furniture/calculate` requires explicit boolean confirmation and accepts configuration without an image. Mock-response metadata is rejected as input.

The profile has full-height sides, top/bottom and shelves between the sides, one continuous interior bay, 18 mm PAL, a 50 mm shelf setback, 2 mm door gaps, and a separate surface-mounted 3 mm HDF back. Decimal dimensions and areas cross the JSON boundary as strings. Each row exposes both single-piece and quantity-inclusive area. Orientation remains unspecified. The frontend formats these values without calculating or rounding them. A confirmed-snapshot change discards the previous request/result. The SVG elevation remains a schematic configuration aid.

`edge_banding_rules.py` assigns the four physical edges in the panel cutting coordinate frame. `length_start/end` measure the panel width, and `width_start/end` measure its length. `width_start` is the front of sides, top, bottom, and shelves. These fronts and all door edges receive ABS 2 mm. HDF stays outside banding totals. `edge_banding.py` derives exact meter quantities from those dimensions and quantities, with separate type totals and zero procurement allowance.

`hardware_rules.py` defines provisional hinge thresholds and HDF perimeter intervals. `hardware.py` consumes the same panels to estimate hinges, shelf supports, handles, top/bottom connectors, and back fasteners. Actual door panel height determines hinge count. HDF fasteners use `2 × (ceil(L / 150) + ceil(W / 150))` per back panel, counting each corner once. Their selection and positioning are preliminary.

The existing calculation service composes geometry, area, edge banding, and hardware atomically in one Decimal context. It produces the existing response fields plus typed `edge_banding` and `hardware` sections. The frontend validates the complete response and its panel/edge associations before rendering, with expandable rule details. No geometry or estimation formulas are duplicated in the frontend.

## Future backend boundaries

Introduce the following concrete packages as their first functionality is implemented.

| Proposed package | Responsibility |
| --- | --- |
| `forma/shared/` | Domain-agnostic file handling, shared units, and infrastructure helpers with actual reuse |
| `forma/domains/furniture/` | Furniture schemas, validation, geometry, materials, hardware, and cost rules |
| `forma/interpretation/` | Image interpretation orchestration and future AI provider integration |
| `forma/projects/` | Common project identity, domain selection, lifecycle, and project metadata |
| `forma/exports/` | Shared document/file delivery and export orchestration |
| `forma/api/` | Thin HTTP adapters calling concrete capabilities |

Domain packages own their calculation inputs, validation, results, and domain-specific export data. Shared services must accept explicit inputs without importing domain calculation rules. Projects will carry an explicit domain identifier, with domain-specific payloads validated by that domain. Export orchestration will receive validated results, while domain-specific output formatting remains with its domain when needed.

Image interpretation will convert evidence into structured candidate inputs. Domain-specific schemas and interpretation instructions belong with their domain. Interpretation adapters validate those candidates before deterministic calculation. Python domain code owns quantities and totals. Exact schemas, persistence choices, API paths, and provider contracts will be defined with the implementing task.

Use direct calls and explicit router composition as domains arrive. Introduce common abstractions only when implemented domains demonstrate a shared requirement.

## Extension workflow

1. Define the next domain's supported workflow, inputs, validation, and deterministic calculation rules.
2. Implement its concrete backend modules and HTTP adapters with relevant tests.
3. Add its frontend routes under `/domenii/<slug>` and reuse the platform design system.
4. Add shared services justified by real cross-domain use, keeping domain rules isolated.
5. Verify the supported workflow and then enable its catalog route and availability.

The frontend catalog controls discoverability. Future backend APIs must independently validate domain identifiers and supported operations.

## Local runtime

The frontend runs on port 3000 and the backend on port 8000. Backend CORS defaults permit `http://localhost:3000` and `http://127.0.0.1:3000`. `CORS_ORIGINS` accepts a comma-separated override. Uvicorn can load an optional `backend/.env` via `--env-file .env`. The frontend reads optional public settings from `frontend/.env.local`.
