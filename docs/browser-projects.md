# POC project saving in the browser

## Current decision

For the current POC, **Supabase configuration is postponed**. The owner has created an account but does not need to configure a database or Google OAuth now. Project saving defaults to browser `localStorage`, including GitHub Pages. Existing SQLite, Supabase Auth, PostgreSQL/RLS and cloud store code remain available for later activation.

```dotenv
NEXT_PUBLIC_PROJECT_STORAGE=browser
```

This is the default when unset/empty. No new dependency, paid service or database account is required. FastAPI is still needed for mock interpretation and authoritative material/cost calculations; browser storage does not make the entire application offline.

## Lifecycle and saved data

Save a named project → list → refresh/reopen → edit → confirm/recalculate → update the same UUID → duplicate → delete one selected project after confirmation. Configuration, exact price strings/provenance, allowances, labor, markup, metadata and construction/schema/calculation versions are preserved. Blank prices differ from explicit zero.

No image/blob/object URL, auth token, mock interpretation, HTML deviz or authoritative derived total is added to project records. Python remains responsible for calculations. Browser history says the deviz is checked on opening rather than inventing client-side completeness rules.

The saved editor restores configuration before waiting for an estimate. If the backend is unavailable, saved inputs and 2D editing remain accessible with a recovery notice; calculation requests can be retried. No fake totals are shown. Unsaved photographs still disappear on full refresh.

## Limits

- Storage belongs to this browser profile/site origin on this device, not an account. Other devices/browsers and localhost vs GitHub Pages have separate histories.
- Clearing site data, browser eviction, private browsing cleanup or losing the device can remove projects. This is not durable backup or encryption.
- People sharing one browser profile can see the same projects; there is no per-user privacy in this mode.
- Browser quotas vary. Blocked/quota-exceeded writes show an error, never a false success or a replacement of the previous record.
- A shared UUID URL does not transfer the project to another device.
- Export/import and automatic migration to SQLite/Supabase are not implemented. Switching modes must not delete local records.

## Implementation and integrity

- Switch: [project-storage.ts](../frontend/src/config/project-storage.ts).
- Shared DTOs/guards: [project-contract.ts](../frontend/src/features/furniture/project-contract.ts).
- Existing facade: [project-api.ts](../frontend/src/features/furniture/project-api.ts); browser mode redirects project CRUD/capabilities only. Calculations still use HTTP.
- Adapter: [browser-project-store.ts](../frontend/src/features/furniture/browser-project-store.ts).
- Tests: [browser-projects.test.mjs](../frontend/tests/browser-projects.test.mjs).

One record per key, `forma:wardrobe-project:v1:<UUID>`, contains `{storage_version:1, project:...}`. Existing `forma-mode`, SDK sessions and unrelated keys are untouched; no `localStorage.clear()` is used. Inputs use current wardrobe/pricing validation before writes. Edits advance revision/UTC time; duplication creates a new UUID and draft status.

Web Locks serialize same-origin writes where supported. Separate project keys prevent unrelated record overwrites. Stale edits/deletes fail revision checks. Without Web Locks, avoid simultaneous same-project edits in multiple tabs; this is not a production database transaction system.

Corrupt/unsupported envelopes remain untouched. History shows valid records plus a warning for unreadable records. A direct get fails clearly. Supported-shape records with incompatible schema/profile/calculation versions are read-only and cannot be silently recalculated, updated or duplicated. Stored totals are never trusted.

## Deploy now / activate the backend later

GitHub Actions uses its `NEXT_PUBLIC_PROJECT_STORAGE` variable with a `browser` fallback. Leave it unset or set `browser`; leave Supabase variables empty. Keep the existing public API URL for calculations. No Render disk, migration or Google provider setup is needed for browser saving. Publish only with permission.

Frontend capabilities resolve locally. A backend `/project-capabilities` response with disabled server CRUD is normal and does not disable browser saving. Diagnose browser permissions/quota errors in this mode.

Later set `NEXT_PUBLIC_PROJECT_STORAGE=api` in `frontend/.env.local` or GitHub Actions variables and restart/rebuild. Then use explicit SQLite settings from [INIT](INIT.md) or complete [free online setup](free-online-setup.md). API mode never falls back to browser writes on auth/storage errors. Browser mode never silently uploads projects. Each store retains its original data; migration needs a separate reviewed flow.
