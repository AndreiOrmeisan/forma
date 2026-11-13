# FORMA architecture

Start with the [documentation index](README.md) and [agent handoff](agent-handoff.md). [INIT](INIT.md) covers laptop setup; [services and deployment](services-and-deployment.md) records hosting and environment ownership. This document describes source architecture, not proof of completed external setup.

## Project persistence

Furniture projects persist validated configuration/pricing inputs with UUID, UTC timestamps, schema/profile/calculation versions and optimistic revisions. Domain-local `project_store.py` supplies explicit local SQLite; `cloud_project_store.py` reuses the same contracts for authenticated Supabase PostgreSQL. Shared `cloud_auth.py` verifies the user's token at Supabase Auth; every cloud query uses that token and an owner filter, with SQL RLS independently enforcing ownership. No admin/service-role key is used. Default CRUD is absent; local SQLite remains loopback-only and disabled on Render. Cloud CRUD is explicitly configured and requires authentication. See [free online setup](free-online-setup.md).

The official browser Supabase SDK manages sessions/refresh and Google OAuth in a popup, preserving the current image flow. Account changes clear private in-memory state. Inputs remain editable before authentication/storage availability; saving waits for both. Derived quantities/estimates are still recalculated after version compatibility checks; images stay temporary. The static-export-compatible editor restores the existing context and calculators. See [project persistence](project-persistence.md) for lifecycle and backups.

## Manual pricing

The furniture estimate endpoint separates existing quantity engines, manual price sourcing and Decimal cost estimation. It accepts confirmed configuration and a typed manual catalog, never authoritative client quantities. Temporary frontend project context preserves pricing inputs across navigation. The backend owns totals; missing required prices suppress the final selling price. Stable item codes and a minimal PriceProvider protocol allow future authorized supplier adapters without changing geometry or cost formulas. See [future supplier pricing](future-supplier-pricing.md).

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
| `/domenii/mobilier/proiect-nou/rezultat` | Confirmed inputs, cutting/ABS/hardware results, manual pricing/deviz and save action |
| `/domenii/mobilier/proiecte` | Saved project list, pagination, duplicate and confirmed deletion |
| `/domenii/mobilier/proiecte/deschide?id=<UUID>` | Static-export-compatible saved editor, reload, 2D preview and recalculation |
| `/domenii/mobilier/profil` | Account status and Google sign-in/sign-out UI, when configured |
| `/proiect-nou` | Permanent redirect preserving earlier links |

`src/config/domains.ts` owns typed domain metadata and furniture route constants. Available entries require a route. Upcoming entries require a null route and render without interactive elements. Explicit App Router files determine which domains are reachable. A shared furniture layout provides navigation and a visible return link to the platform dashboard. The existing mode selector retains its `forma-mode` localStorage key and values across route changes and reloads.

Furniture components remain reusable at their existing paths. Domain boundaries are currently established through routing and configuration. Moving presentation components into domain directories can follow when another implemented domain gives that separation a concrete use.

The Python package uses a `src/forma` layout. `main.py` creates middleware, capability reporting and conditionally mounted project routes. `config.py` reads CORS and local/cloud storage settings. `api/health.py` owns `GET /api/health`, returning `{"status":"ok"}`. `api/furniture.py` exposes the mock analysis, quantity and estimate POST endpoints. `api/projects.py` exposes CRUD only in enabled modes. Shared image validation checks MIME/size/decoding; shared cloud auth verifies identity. Interpretation remains fixed demonstration data and performs no external AI requests.

| API method/path | Input / responsibility | Access |
| --- | --- | --- |
| `GET /api/health` | Health status | Public |
| `POST /api/v1/furniture/analyze-sketch` | Multipart `file`; validate then fixed mock | Public |
| `POST /api/v1/furniture/calculate` | `{configuration, confirmed: true}`; deterministic quantities | Public |
| `POST /api/v1/furniture/estimate` | Confirmed configuration, manual `price_catalog`, `waste_allowances`, `labor_cost_ron`, `markup_percent` | Public; recomputes quantities, accepts no authoritative client quantities |
| `GET /api/v1/furniture/project-capabilities` | `enabled`, `requires_auth`, `storage`, `reason` | Public; not an authorization credential |
| `GET /api/v1/furniture/projects` | Paginated owner-scoped list (`limit`, `offset`) | Enabled local loopback mode or verified cloud account |
| `POST /api/v1/furniture/projects` | Validated project inputs; new UUID | Same conditional access |
| `GET /api/v1/furniture/projects/{id}` | Saved inputs / current completeness, compatibility warnings | Same conditional access |
| `PATCH /api/v1/furniture/projects/{id}` | Allowed fields + `expected_revision`; same UUID | Same conditional access |
| `POST /api/v1/furniture/projects/{id}/duplicate` | Copy inputs, new UUID, draft status | Same conditional access |
| `DELETE /api/v1/furniture/projects/{id}` | Selected UUID + `expected_revision` query parameter | Same conditional access; frontend confirmation |

Project persistence field names are intentionally different from an estimate request: `confirmed_configuration`, `manual_price_catalog`, `labor_cost` and `markup_percentage`. Reuse the existing mapping/validators rather than passing one DTO unchanged into the other endpoint. Contracts live in [schemas.py](../backend/src/forma/domains/furniture/schemas.py), [pricing.py](../backend/src/forma/domains/furniture/pricing.py) and [projects.py](../backend/src/forma/domains/furniture/projects.py). Cloud identity always comes from the verified user token; there is no client-writable owner field.

The furniture frontend keeps interpretation, editable draft, confirmed configuration and pricing in a domain provider inside the generic image provider; root AuthProvider manages account sessions. Replacing an image clears image-dependent state while preserving upload lifecycle. `features/furniture/wardrobe-configuration.ts` centralizes validation. Unsaved workflows use in-memory state and refresh recovery. Saved projects instead reload configuration/pricing from the selected store without an image, check historical compatibility and recalculate. Account changes clear private draft state; first guest login preserves the unsaved workflow. The homepage's `RecentProjects` presentation is still static; actual persisted history is in the projects route.

### Wardrobe calculation boundary

`domains/furniture/schemas.py` owns the shared backend wardrobe input and calculation output contracts. `wardrobe_geometry.py` defines the fixed FORMA POC v1 profile and positive panel dimensions. `panel_calculation.py` uses an isolated Decimal context for exact areas and separate PAL/HDF totals. `POST /api/v1/furniture/calculate` requires explicit boolean confirmation and accepts configuration without an image. Mock-response metadata is rejected as input.

The profile has full-height sides, top/bottom and shelves between the sides, one continuous interior bay, 18 mm PAL, a 50 mm shelf setback, 2 mm door gaps, and a separate surface-mounted 3 mm HDF back. Decimal dimensions and areas cross the JSON boundary as strings. Each row exposes both single-piece and quantity-inclusive area. Orientation remains unspecified. The frontend formats these values without calculating or rounding them. A confirmed-snapshot change discards the previous request/result. The SVG elevation remains a schematic configuration aid.

`edge_banding_rules.py` assigns the four physical edges in the panel cutting coordinate frame. `length_start/end` measure the panel width, and `width_start/end` measure its length. `width_start` is the front of sides, top, bottom, and shelves. These fronts and all door edges receive ABS 2 mm. HDF stays outside banding totals. `edge_banding.py` derives exact meter quantities from those dimensions and quantities, with separate type totals and zero procurement allowance.

`hardware_rules.py` defines provisional hinge thresholds and HDF perimeter intervals. `hardware.py` consumes the same panels to estimate hinges, shelf supports, handles, top/bottom connectors, and back fasteners. Actual door panel height determines hinge count. HDF fasteners use `2 × (ceil(L / 150) + ceil(W / 150))` per back panel, counting each corner once. Their selection and positioning are preliminary.

The existing calculation service composes manufacturing geometry, area, edge banding and hardware atomically in one Decimal context. It produces the existing response fields plus typed `edge_banding` and `hardware` sections. The frontend validates complete responses and panel/edge associations before rendering, with expandable rule details. React's schematic SVG layout calculations are presentation only; authoritative manufacturing quantity and cost formulas are not duplicated there.

## Future backend boundaries

The following shared boundaries describe future cross-domain extraction. Current furniture project persistence and mock interpretation already live under the concrete furniture domain; do not create a parallel generic system until implemented reuse justifies it.

| Proposed package | Responsibility |
| --- | --- |
| `forma/shared/` | Domain-agnostic file handling, shared units, and infrastructure helpers with actual reuse |
| `forma/domains/furniture/` | Furniture schemas, validation, geometry, materials, hardware, and cost rules |
| `forma/interpretation/` | Image interpretation orchestration and future AI provider integration |
| `forma/projects/` | Common project identity, domain selection, lifecycle, and project metadata |
| `forma/exports/` | Shared document/file delivery and export orchestration |
| `forma/api/` | Thin HTTP adapters calling concrete capabilities |

Domain packages own their calculation inputs, validation, results, and domain-specific export data. Shared services must accept explicit inputs without importing domain calculation rules. Projects will carry an explicit domain identifier, with domain-specific payloads validated by that domain. Export orchestration will receive validated results, while domain-specific output formatting remains with its domain when needed.

Future real image interpretation would convert evidence into structured candidate inputs, if separately authorized. Domain schemas/instructions remain domain-specific and candidates must be validated before deterministic calculation. Python owns quantities/totals. Current wardrobe API, price and persistence contracts are already implemented; new domains or shared extractions must define their own justified contracts without replacing those working paths.

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
