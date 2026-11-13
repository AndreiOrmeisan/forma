# POC project saving in the browser

## Current decision

For the current POC, **Supabase configuration is postponed**. The owner has created an account but does not need to configure a database or Google OAuth now. Project saving defaults to browser `localStorage`, including GitHub Pages. Existing SQLite, Supabase Auth, PostgreSQL/RLS and cloud store code remain available for later activation.

```dotenv
NEXT_PUBLIC_PROJECT_STORAGE=browser
```

This is the default when unset/empty. No new dependency, paid service or database account is required. FastAPI is still needed for mock interpretation and authoritative material/cost calculations; browser storage does not make the entire application offline.

## Lifecycle and saved data

Sprint 14C adds optional immutable manufacturing snapshots, independent of price snapshots. Explicit saves with a selected process use browser envelope v3; v1/v2 legacy records remain readable and unchanged on open. Existing inputs/revisions and price rules stay authoritative. See [manufacturing profiles](manufacturing-profiles.md) for distinct financial/dimensional versions, process readiness and backup v2 support.

Save a named project → list → refresh/reopen → edit → confirm/recalculate → update the same UUID → duplicate → delete one selected project after confirmation. Configuration, exact price strings/provenance, allowances, labor, markup, metadata and construction/schema/calculation versions are preserved. Blank prices differ from explicit zero.

No image/blob/object URL, auth token, mock interpretation, HTML deviz or authoritative derived total is added to project records. Python remains responsible for calculations. Browser history says the deviz is checked on opening rather than inventing client-side completeness rules.

The saved editor restores configuration before waiting for an estimate. If the backend is unavailable, saved inputs and 2D editing remain accessible with a recovery notice; calculation requests can be retried. No fake totals are shown. Unsaved photographs still disappear on full refresh.

## Limits

### Unsaved work protection (Sprint 14A)

`ProjectWorkspace` keeps one active in-memory draft above the route boundary, including on GitHub Pages where `cacheComponents` is disabled. A selected sketch, an unnamed configuration, metadata changes, pricing edits and saved-project edits count as meaningful work. Invalid or cancelled image replacement preserves the current image/configuration/pricing. A valid replacement deliberately resets image-dependent work.

Leaving the workflow through a same-tab link opens an accessible Romanian dialog: **Rămâi**, **Salvează proiectul**, **Continuă fără salvare**. Saving requires a name, a confirmed valid configuration and valid prices; unconfirmed work cannot yet be saved as a project. Persistence must succeed and no newer edits may remain before navigation resumes. Errors/conflicts leave the draft intact. The normal save form and navigation dialog share a single pending write to avoid duplicate new projects. Existing UUID/revision checks remain authoritative; no automatic saved-project overwrite is introduced.

Supplier catalog links in the furniture header and project pricing open a separate tab; returning to the original tab preserves its draft. This is not cross-tab draft synchronization. Newly tracked same-document history entries are bounced back before asking whether to continue. Entries from before guard installation/reload have no reliable traversal delta: restore the source URL/router state at that entry and use an explicit new navigation if the user continues. That fallback can change history shape. Cross-document history, reload and close use `beforeunload`, subject to browser user-activation/mobile limitations; browsers choose their own warning text and can suppress it. Internal links have their own guard and do not rely solely on `beforeunload`.

There is **no persisted temporary draft snapshot**. Rejecting a navigation preserves the draft, but confirming reload/close or explicit discard loses unsaved work. Photographs cannot be restored after a full reload; saved projects retain only their previously saved inputs. Recovery screens offer upload again. This choice avoids extra localStorage schemas, image storage and implicit duplicate projects. Never describe the in-memory draft as a saved project or a crash-safe backup.

Regression tests in `frontend/tests/unsaved-project.test.mjs` exercise component handlers/state and a deterministic history/event model. These do not prove native browser dialogs, actual Next popstate scheduling, focus trapping, mobile suspension or bfcache behavior. See the [workshop audit](audits/sprint-13-workshop-readiness.md) for verification status and manual scenarios.

- Storage belongs to this browser profile/site origin on this device, not an account. Other devices/browsers and localhost vs GitHub Pages have separate histories.
- Clearing site data, browser eviction, private browsing cleanup or losing the device can remove projects. This is not durable backup or encryption.
- People sharing one browser profile can see the same projects; there is no per-user privacy in this mode.
- Browser quotas vary. Blocked/quota-exceeded writes show an error, never a false success or a replacement of the previous record.
- A shared UUID URL does not transfer the project to another device.
- Saved browser projects can be exported/restored through [full backup and recovery](backup-and-recovery.md) at `/setari/backup-si-restaurare`. Sketches/unsaved drafts/server projects are excluded. Automatic migration to SQLite/Supabase is not implemented; switching modes must not delete local records. Catalog-only backups still exclude projects.

## Implementation and integrity

- Switch: [project-storage.ts](../frontend/src/config/project-storage.ts).
- Shared DTOs/guards: [project-contract.ts](../frontend/src/features/furniture/project-contract.ts).
- Existing facade: [project-api.ts](../frontend/src/features/furniture/project-api.ts); browser mode redirects project CRUD/capabilities only. Calculations still use HTTP.
- Adapter: [browser-project-store.ts](../frontend/src/features/furniture/browser-project-store.ts).
- Tests: [browser-projects.test.mjs](../frontend/tests/browser-projects.test.mjs).

One record per stable key, `forma:wardrobe-project:v1:<UUID>`, now writes `{storage_version:2, project:...}` and also reads version 1. Legacy prices receive manual snapshots in memory without rewriting on open; explicit save persists v2. Catalog changes do not update historical project prices. See [supplier catalog](supplier-catalog.md) for snapshot/refresh rules. Existing `forma-mode`, SDK sessions and unrelated keys are untouched; no `localStorage.clear()` is used. Inputs use current wardrobe/pricing validation before writes. Edits advance revision/UTC time; duplication creates a new UUID and draft status.

Web Locks serialize same-origin writes where supported. Separate project keys prevent unrelated record overwrites. Stale edits/deletes fail revision checks. Without Web Locks, avoid simultaneous same-project edits in multiple tabs; this is not a production database transaction system.

Corrupt/unsupported envelopes remain untouched. History shows valid records plus a warning for unreadable records. A direct get fails clearly. Supported-shape records with incompatible schema/profile/calculation versions are read-only and cannot be silently recalculated, updated or duplicated. Stored totals are never trusted.

## Deploy now / activate the backend later

GitHub Actions uses its `NEXT_PUBLIC_PROJECT_STORAGE` variable with a `browser` fallback. Leave it unset or set `browser`; leave Supabase variables empty. Keep the existing public API URL for calculations. No Render disk, migration or Google provider setup is needed for browser saving. Publish only with permission.

Frontend capabilities resolve locally. A backend `/project-capabilities` response with disabled server CRUD is normal and does not disable browser saving. Diagnose browser permissions/quota errors in this mode.

Later set `NEXT_PUBLIC_PROJECT_STORAGE=api` in `frontend/.env.local` or GitHub Actions variables and restart/rebuild. Then use explicit SQLite settings from [INIT](INIT.md) or complete [free online setup](free-online-setup.md). API mode never falls back to browser writes on auth/storage errors. Browser mode never silently uploads projects. Each store retains its original data; migration needs a separate reviewed flow.
