# Services, addresses, environment variables and deployment

Last source audit: 2026-11-13. These are the recorded project addresses and configuration, not a claim that the newest local commit is deployed. Public frontend/backend fetches could not be completed by the web tool during this documentation audit; do not infer either uptime or an outage from that tooling limitation. Check the actual service and deployment dashboard before reporting live status.

## Service directory

Sprint 11 adds a browser-local supplier catalog at `/setari/furnizori` (published under the existing `/forma` base). It needs no additional hosting, backend supplier endpoints, secrets or database activation. JSON export/import is a manual catalog backup; it is not cloud synchronization. See [supplier catalog](supplier-catalog.md).

**Current POC:** `NEXT_PUBLIC_PROJECT_STORAGE=browser` is the default and saves projects on the visitor's browser/device, including GitHub Pages. No database/account configuration is needed. The owner deferred Supabase setup; retained backend stores require an explicit later `api` selection. Calculations still use FastAPI. See [browser saving](browser-projects.md).

| Component | Provider / name | Address or dashboard | Role |
| --- | --- | --- | --- |
| Source repository | GitHub, `AndreiOrmeisan/forma` | [Repository](https://github.com/AndreiOrmeisan/forma) | PUBLIC, default branch `main`, verified through GitHub CLI on 2026-11-13. Write/admin access is owner-managed. Git remote confirms this exact username spelling. |
| Frontend | GitHub Pages, FORMA | [Public application](https://andreiormeisan.github.io/forma/) | Static Next.js export; base path `/forma`. |
| Frontend deployment | GitHub Actions | [Actions](https://github.com/AndreiOrmeisan/forma/actions), [Pages settings](https://github.com/AndreiOrmeisan/forma/settings/pages) | Workflow `Deploy FORMA frontend`; Pages source must be GitHub Actions. |
| Frontend build variables | GitHub repository Actions variables | [Variables settings](https://github.com/AndreiOrmeisan/forma/settings/variables/actions) | Public API/Supabase settings embedded at build time. Requires repository permission. |
| Backend | Render, FORMA API | [API base](https://forma-q8f6.onrender.com), [health](https://forma-q8f6.onrender.com/api/health), [API docs](https://forma-q8f6.onrender.com/docs) | FastAPI calculations and authorized project operations. |
| Backend administration | Render | [Render dashboard](https://dashboard.render.com/) | Select the service serving `forma-q8f6.onrender.com`. Its internal dashboard service ID is not recorded in the repo. |
| Online database and accounts | Supabase Free, project selected by owner | [Supabase dashboard](https://supabase.com/dashboard) | PostgreSQL, Auth and per-user row-level security. Actual project URL/ref is not recorded yet. |
| Login provider | Google OAuth via Supabase | [Google Auth Platform](https://console.cloud.google.com/auth/overview) | OAuth credentials/consent setup; not an AI or paid API integration. |
| Optional laptop database | Python SQLite | `backend/.local/forma.db` under the documented startup directory | Local development only; not shared online or automatically imported. |
| Default POC project store | Browser localStorage | Site origin/browser profile on the current device | Inputs only, no account/sync/photos; can be lost when site data is cleared. |

There is no Vercel deployment, separate cloud image bucket, supplier service, paid AI endpoint or application-owned SMTP service in the current implementation. Images are not permanently saved. The database is not hosted on GitHub Pages and online project data is not stored on Render's ephemeral disk.

Dashboard access requires the owner's legitimate permissions; it is not included in a Git clone. Record a future Supabase project URL/ref here only after the owner supplies it. Do not record its database password, Google Client Secret, access tokens or service-role keys.

## Runtime/environment map

All flags are case-sensitive string comparisons; use `true` exactly where enabled. Never publish an environment dump.

| Variable | Used by / configured where | Meaning and default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend `.env.local`; GitHub Actions repository variable | API origin. Local fallback `http://localhost:8000`; hosted value `https://forma-q8f6.onrender.com`. |
| `NEXT_PUBLIC_PROJECT_STORAGE` | Frontend `.env.local`; GitHub Actions repository variable | `browser` default/unset: localStorage CRUD, no auth/DB. `api`: retained backend capabilities/SQLite/cloud. Rebuild/restart after switching; no automatic migration/fallback. |
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend `.env.local`; GitHub Actions repository variable | Owner's HTTPS Supabase project URL. Optional; must be paired with its public key. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same frontend locations | Publishable key or legacy `anon` key only. Public by design, protected by user auth/RLS. Secret/service-role keys are forbidden. |
| `GITHUB_PAGES` | Workflow export step | `true` enables static export. Leave unset for normal local dev/server builds. |
| `NEXT_PUBLIC_BASE_PATH` | Workflow export step, from Configure Pages output | `/forma` for this repository. Also used by the OAuth return URL. Do not set it for normal root-path local dev. |
| `CORS_ORIGINS` | Backend shell / optional `.env`; Render Environment | Comma-separated full browser origins. Defaults to localhost/127.0.0.1 port 3000. Production Pages origin: `https://andreiormeisan.github.io` **without** `/forma`. |
| `FORMA_ENV` | Backend | `local` is one required SQLite switch. Default does not enable SQLite; examples use `production`. |
| `ENABLE_LOCAL_PROJECTS` | Backend | Must be `true` together with local environment and no `RENDER` marker. Otherwise unauthenticated SQLite CRUD stays disabled. |
| `DATABASE_URL` | Backend local mode | File-based `sqlite:///./.local/forma.db` fallback. Relative to process working directory. Not a Supabase PostgreSQL password/DSN. |
| `ENABLE_CLOUD_PROJECTS` | Backend; Render Environment | `true` enables authenticated online project routes and requires valid Supabase configuration. Default is disabled. Cloud mode takes precedence over SQLite. |
| `SUPABASE_URL` | Backend; Render Environment | Same HTTPS project URL as the frontend, used for Auth verification and PostgREST. Required only in cloud mode. |
| `SUPABASE_PUBLISHABLE_KEY` | Backend; Render Environment | Same project's public publishable/legacy anon key. No administrative key is used. |
| `RENDER` | Render-managed environment | Presence blocks unauthenticated SQLite mode. Do not spoof/remove it to bypass the protection. It does not block authenticated cloud mode. |
| `PYTHON_VERSION` | Render service runtime setting | Reference runtime used for this project: 3.12.14. Confirm in dashboard/build logs; `pyproject.toml` itself specifies >=3.12. |
| `PORT` | Render-managed environment / start command | Listening port assigned by Render; not a frontend or database setting. |
| `AI_API_KEY` | Unused placeholder in `.env.example` | Not required or read by any current AI integration. Do not add real AI/SDKs because this placeholder exists. |

Google Client ID/Client Secret belong in Supabase's Google provider configuration. The application does not define corresponding client-secret environment variables. Set values in the correct system; setting backend variables cannot update a previously built frontend.

Local environment loading is explained in [INIT](INIT.md). When cloud is disabled, missing Supabase variables are allowed. When explicitly enabled, missing/invalid backend settings fail startup; invalid/partial frontend settings fail its build. No failed cloud request falls back to public SQLite.

## GitHub Pages deployment

Source: [deploy-pages.yml](../.github/workflows/deploy-pages.yml), [next.config.ts](../frontend/next.config.ts).

1. Owner authorizes a push/publication. A local commit alone changes no hosted site.
2. A push to `main` triggers the frontend workflow only when `frontend/**` or the workflow file changed. A docs-only push does not automatically rebuild Pages.
3. CI uses Node 24, `npm ci`, lint, TypeScript, tests and a static build.
4. The build receives the public API/Supabase repository variables and the action's Pages base path.
5. It uploads `frontend/out` and deploys that artifact, not README/source files.

In repository Pages settings choose **GitHub Actions**. The old `main / root` source can serve the README instead of the application. Exported routes use trailing slashes for direct navigation/refresh. New dynamic project identities use a query parameter on the static `/domenii/mobilier/proiecte/deschide` route.

Changing Actions variables requires a new build. Use the workflow's manual `workflow_dispatch` only when publication has been authorized. If publication fails, inspect the failed job; do not regenerate or force-push the repository.

To test an export locally, use a separate terminal in `frontend/`:

```powershell
$env:GITHUB_PAGES = "true"
$env:NEXT_PUBLIC_BASE_PATH = "/forma"
npm.cmd run build
```

Close that terminal afterward or explicitly restore its variables before normal dev. Do not run `npm start` as if an `output: export` build were the standard Next.js server build. `frontend/out` is generated/ignored and contains only build-time public configuration.

## Render deployment

The service settings are owner-managed rather than a committed `render.yaml`:

| Setting | Expected value |
| --- | --- |
| Repository | Existing `AndreiOrmeisan/forma` |
| Branch | `main` unless owner deliberately changes it |
| Root Directory | `backend` |
| Build command | `pip install .` |
| Start command | `uvicorn forma.main:app --host 0.0.0.0 --port $PORT` |
| Runtime | Python, reference 3.12.14 |
| Persistent local disk | Not required for cloud mode; do not use ephemeral SQLite for public storage |

The `0.0.0.0` command is for the hosted service, not an unauthenticated local SQLite server. Root Directory is important: running `pip install .` from the monorepo root fails because `pyproject.toml` is inside `backend/`.

Render Auto-Deploy and build filters depend on dashboard settings; the repository does not prove whether they are enabled. Check before asserting a push deployed the backend. Runtime variables are configured in Render Environment, not GitHub Actions. Restart/redeploy after configuration changes as required by that service. Check deployed commit and logs; health `{"status":"ok"}` alone does not prove the latest feature commit is present.

## Supabase and Google activation

This activation is deferred, not required for the browser POC. When explicitly requested later, select `NEXT_PUBLIC_PROJECT_STORAGE=api` in the frontend and rebuild; otherwise browser mode intentionally ignores backend project capabilities and does not initialize Supabase Auth. Do not remove backend safeguards or upload browser data automatically.

Follow [free online setup](free-online-setup.md) in order: create/select Free project → apply SQL migration → configure Google OAuth + exact redirect URLs → set Render variables → set GitHub variables → authorize backend/frontend deployment → verify with two real accounts and another device.

Migration source: [001_cloud_projects.sql](../backend/migrations/001_cloud_projects.sql). It creates `public.forma_projects`, owner policies, metadata trigger and restricted grants. It is not run automatically by FastAPI or `pip install .`. Do not claim it ran merely because the file exists. Cloud code uses Supabase HTTP APIs and does not need a local PostgreSQL installation or a database password in the app.

Production callback: `https://andreiormeisan.github.io/forma/domenii/mobilier/profil/`. Local callback: `http://localhost:3000/domenii/mobilier/profil/`. These are application return URLs; Google's authorized callback is the separate Supabase `/auth/v1/callback` URL shown in its provider settings.

Only Free services are authorized. No paid upgrades, paid add-ons, real AI or automatic billing activation. Current provider quotas/pausing and lack of automatic Free backups are detailed in the online setup guide; verify official terms before changing infrastructure.
