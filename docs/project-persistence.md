# Project persistence

For the complete laptop setup see [INIT](INIT.md); for actual service addresses and deployment variables see [services and deployment](services-and-deployment.md). Cloud setup status is owner-managed; source support is not a claim that it is active online.

## Online account mode

Private online projects are now supported through Supabase Auth (Google OAuth) and PostgreSQL with row-level ownership policies. This is an explicitly configured alternative to local SQLite, not anonymous public access. See [free online setup](free-online-setup.md) for the Free-plan setup, SQL migration, OAuth dashboard settings, Render/GitHub variables and external verification steps. No cloud account/resource is provisioned automatically. Local projects are not automatically imported.

## Scope and deployment boundary

SQLite saves wardrobe configuration and manual pricing inputs, not photographs or derived totals. No image blobs, object URLs, temporary image paths or HTML deviz are persisted. Existing anonymous mock, quantity and pricing endpoints remain available.

**Project CRUD remains disabled by default.** Local SQLite requires both `FORMA_ENV=local` and `ENABLE_LOCAL_PROJECTS=true`; a Render runtime cannot enable unauthenticated SQLite CRUD. Cloud CRUD requires `ENABLE_CLOUD_PROJECTS=true`, a valid HTTPS Supabase URL/public key, and a verified user bearer token on every request. No SQLite database is initialized in cloud/disabled mode. The public read-only `GET /api/v1/furniture/project-capabilities` indicates mode and login requirements; it is not an authorization token.

Run local development bound to `127.0.0.1`, never through a public tunnel or a public reverse proxy. Local routes additionally require a direct loopback peer, a loopback Host, and no non-loopback Origin. Forwarding headers and custom "development" headers are not trusted. CORS and hidden buttons are not access control. Environment switches are operator configuration, not authentication. Never enable these switches on another publicly hosted service either.

GitHub Pages remains a static frontend. A local database on an ephemeral Render filesystem is not production persistence. The configured cloud mode stores projects in Supabase PostgreSQL independently of Render restarts, with per-user authorization and no administrative key. Account/provider configuration and the SQL migration must be applied before online saving is active. No paid resource is purchased by this implementation.

## Local setup (PowerShell)

From `backend/`, after installing `.[dev]` in `.venv`:

```powershell
$env:FORMA_ENV = "local"
$env:ENABLE_LOCAL_PROJECTS = "true"
$env:ENABLE_CLOUD_PROJECTS = "false"
$env:DATABASE_URL = "sqlite:///./.local/forma.db"
.\.venv\Scripts\python.exe -m uvicorn forma.main:app --reload --host 127.0.0.1 --port 8000
```

The default file URL resolves relative to the backend process working directory. For an absolute Windows path use `sqlite:///C:/path/to/forma-data/forma.db`. Only file-based SQLite URLs are supported. The directory is created at startup. `.local/`, database files and journal/WAL companions are ignored by Git. No new Python dependency is required; SQLite uses the Python standard library. Environment files are templates; the commands above explicitly set process variables.

Start `frontend/` with `npm run dev` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`. Use a local browser origin. GitHub Pages targets the public backend; online saving there is available only after its cloud mode, auth and RLS configuration/deployment are complete. Otherwise it remains disabled. To disable local SQLite, remove its switches or set `FORMA_ENV=production` and restart the backend; cloud mode has its own explicit switch.

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

Each local SQLite operation uses its own connection and explicit transaction, parameterized SQL, a five-second busy timeout and rollback on failure. Optimistic revisions prevent lost updates across sessions. This store is intended for local usage, not public multi-tenant scaling. Cloud mode instead uses user-scoped PostgREST requests, PostgreSQL row writes and conditional revision filters. Neither mode implements automatic backup or schema downgrade.

Stop the local backend before copying the database file to a secure backup location. Alternatively use Python's SQLite backup API for a consistent live backup; copying an active database file without its journal is unsafe. Test restoring a copy before relying on a backup. Keep backups outside Git and protect them as project data.

Cloud mode retains UUIDs, UTC timestamps, JSON input contracts and optimistic revisions. Every list/read/write/duplicate/delete uses the user verified by Supabase Auth, explicit owner filters and PostgreSQL RLS. Future work includes private image storage if requested, quotas/backups and reviewed migrations as schemas evolve. A persistent volume alone does not solve access control. Never trust a submitted owner ID or an unverified JWT; never replace a failed cloud request with anonymous SQLite access.
