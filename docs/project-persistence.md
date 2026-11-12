# Local project persistence

## Scope and deployment boundary

SQLite saves wardrobe configuration and manual pricing inputs, not photographs or derived totals. No image blobs, object URLs, temporary image paths or HTML deviz are persisted. Existing anonymous mock, quantity and pricing endpoints remain available.

There is no authentication or ownership model yet. **Project CRUD is disabled by default** and is absent from routes and OpenAPI unless both `FORMA_ENV=local` and `ENABLE_LOCAL_PROJECTS=true` are set. A Render runtime (`RENDER` present) cannot enable it. No database is opened or initialized when disabled. A public read-only `GET /api/v1/furniture/project-capabilities` lets the UI explain disabled saving. This capability is not an authorization token.

Run local development bound to `127.0.0.1`, never through a public tunnel or a public reverse proxy. Local routes additionally require a direct loopback peer, a loopback Host, and no non-loopback Origin. Forwarding headers and custom "development" headers are not trusted. CORS and hidden buttons are not access control. Environment switches are operator configuration, not authentication. Never enable these switches on another publicly hosted service either.

The current repository defines a GitHub Pages static frontend and no backend persistent-volume configuration. No authenticated production project storage is implemented. A database on an ephemeral deployment filesystem can disappear during restart/redeploy; it must not be used for production persistence. This sprint intentionally does not deploy a public project database or purchase a service.

## Local setup (PowerShell)

From `backend/`, after installing `.[dev]` in `.venv`:

```powershell
$env:FORMA_ENV = "local"
$env:ENABLE_LOCAL_PROJECTS = "true"
$env:DATABASE_URL = "sqlite:///./.local/forma.db"
.\.venv\Scripts\python.exe -m uvicorn forma.main:app --reload --host 127.0.0.1 --port 8000
```

The default file URL resolves relative to the backend process working directory. For an absolute Windows path use `sqlite:///C:/path/to/forma-data/forma.db`. Only file-based SQLite URLs are supported. The directory is created at startup. `.local/`, database files and journal/WAL companions are ignored by Git. No new Python dependency is required; SQLite uses the Python standard library. Environment files are templates; the commands above explicitly set process variables.

Start `frontend/` with `npm run dev` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`. Use a local browser origin. The deployed GitHub Pages frontend continues to target the public backend, where project saving is disabled. To disable persistence locally, remove both local switches or set `FORMA_ENV=production` and restart the backend.

## Lifecycle and API

- `GET /api/v1/furniture/projects?limit=20&offset=0` (limit 1–50, offset >= 0).
- `POST /api/v1/furniture/projects` creates a UUID project.
- `GET /api/v1/furniture/projects/{id}` loads inputs and recalculates deviz completeness.
- `PATCH /api/v1/furniture/projects/{id}` updates allowed inputs only; `expected_revision` is required.
- `POST /api/v1/furniture/projects/{id}/duplicate` creates a new UUID/timestamps, copies inputs and starts as draft.
- `DELETE /api/v1/furniture/projects/{id}?expected_revision=1` deletes one selected record after frontend confirmation, returning 204.

Names are trimmed, required and limited to 120 characters; descriptions are optional and limited to 2000. Status is `draft` (În lucru) or explicitly selected `completed` (Finalizat). Status does not imply a complete deviz. Lists use updated-at descending then UUID ascending ordering. Timestamps are UTC with fixed microsecond serialization; writes advance timestamps even when the local clock resolution repeats a value. Revision checks return 409 on stale edits/deletes, avoiding silent lost updates. Missing records return 404. SQLite failures return generic 503 messages without database paths. Invalid stored structures return 409 without rewriting the original data.

Saved data contains `confirmed_configuration`, the typed `manual_price_catalog` with provenance/timestamps, separate PAL/HDF/ABS `waste_allowances`, `labor_cost`, `markup_percentage`, metadata and versions. It reuses the existing wardrobe and pricing validators. Missing prices remain missing and explicitly entered zero remains zero. Empty catalogs can be saved as incomplete estimates. Manual-price provenance timestamps are preserved when prices are unchanged.

The result page saves after the server confirms persistence. The history page supports paging, opening, duplication and a native confirmation dialog for deletion. `/domenii/mobilier/proiecte/deschide?id=<UUID>` is a static-export-compatible editor: refresh reloads its saved project without an image; it restores the existing wardrobe context, 2D preview and forms. Quantities and deviz are recalculated with current engines after checking compatibility. Edits must be confirmed, recalculated as needed and saved using PATCH to the same UUID. Unsaved edits are indicated and browser refresh/close warns when the browser supports it. Save before following in-app navigation. New unsaved image workflows retain their existing refresh-recovery behavior.

## Schema migrations and calculation compatibility

Database schema uses SQLite `PRAGMA user_version`. Migration 1 creates the input table and ordering index inside an explicit transaction. Unsupported future database versions fail startup without dropping or replacing data. Add ordered, transactional migration steps for future schema changes; never infer schema solely from a file's existence.

Project JSON has independent `schema_version=1`, `construction_profile_id=forma-wardrobe-poc-v1` and `calculation_version=wardrobe-v1`. Bump calculation version whenever rules change in a way that affects historical results. Current writes accept only supported versions. Existing incompatible records are returned read-only with warnings and unknown completeness; no new-profile recalculation, update or duplication is silently performed. A future migration needs either the old engine or an explicitly confirmed conversion preserving original inputs. Do not silently replace historical profile identifiers.

## Transactions, backups and future production

Each operation uses its own SQLite connection and explicit transaction, parameterized SQL, a five-second busy timeout and rollback on failure. Optimistic revisions prevent lost updates across sessions. Single-process/local usage is intended, not public multi-tenant scaling. There is no automatic backup or schema downgrade.

Stop the local backend before copying the database file to a secure backup location. Alternatively use Python's SQLite backup API for a consistent live backup; copying an active database file without its journal is unsafe. Test restoring a copy before relying on a backup. Keep backups outside Git and protect them as project data.

Production needs real authentication, ownership on every project, authorization tests, private image storage if added later, quotas and backups. A persistent volume alone does not solve access control. Future PostgreSQL migration should retain UUIDs, UTC timestamps, JSON contracts and revisions while replacing the store/transaction adapter and adding a reviewed migration tool. Scope every read/write/duplicate/delete to authenticated ownership; never trust a submitted owner ID. Enable production routes only after these controls and durable storage are implemented and verified.
