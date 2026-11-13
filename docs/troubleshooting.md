# Troubleshooting FORMA

Read [INIT](INIT.md) for working-directory-aware commands and [services and deployment](services-and-deployment.md) for configuration ownership. Start with the concrete failing command, API status and logs. Do not reinstall/rewrite unrelated layers to hide a configuration error.

## Laptop tools and installation

| Symptom | What to check / fix |
| --- | --- |
| `node`, `npm`, `git` or `py` is not recognized | Install the required tool, restart the terminal, verify PATH and version. Use Node 24.x and the tested Python 3.12 line. |
| PowerShell blocks `npm.ps1` | Use `npm.cmd`. Do not globally weaken execution policy to run an npm script. |
| PowerShell blocks venv activation | Activation is unnecessary: invoke `.\.venv\Scripts\python.exe` directly from `backend/`. |
| Python opens the Microsoft Store / wrong version is selected | Use the actual installed Python or `py -3.12`, verify `--version`, and create a fresh venv with it. |
| `No module named forma` | Work from `backend/`, install `-e ".[dev]"` with that environment's Python and run Uvicorn through the same Python. |
| Missing pytest/dev tools | Install the `.[dev]` extra in the venv, not just `pip install .`. |
| npm/PyPI access denied or network timeout | Check permitted network/proxy/tool permissions. In an agent sandbox request the required escalation; do not bypass restrictions or copy untrusted dependencies. |
| `npm ci` reports lockfile mismatch | Check branch/working changes and package.json vs committed lockfile. Do not delete the lockfile or upgrade everything as an onboarding fix. |
| Port 3000/8000 already in use | Identify the process. Stop only your own server or select an unused port and update the frontend API URL/CORS as needed. |
| Next build cannot retrieve Geist fonts | Check network access to the existing font provider; this is not evidence that Tailwind or application routes are broken. |

## Git and GitHub

- **`gh` not recognized:** GitHub CLI is optional for local run. Install it from [the official CLI site](https://cli.github.com/) if needed and restart the terminal; then `gh auth status` / interactive `gh auth login`. Use `gh auth login`, with no trailing backslash. Never print tokens.
- **Clone/access denied:** the repository was public at the audit, so public clone should not need credentials. Check the URL/network; if visibility was later restricted, use your own authorized account. Write/admin operations still require permission. Do not create another `forma` repository to work around access.
- **Missing commit identity:** inspect `git config user.name` / `git config user.email`. Ask the developer for their identity and configure it locally for this checkout if required. Do not impersonate another contributor or overwrite a valid global configuration.
- **Dubious ownership / sandbox owner mismatch:** verify that the path is the intended trusted workspace. A per-command `git -c safe.directory="C:/path/to/forma" status` can be used after verification. Never use blanket `safe.directory=*` or trust arbitrary paths.
- **Dirty working tree or branch ahead of origin:** inspect before changing anything. Do not reset, clean, force-push, drop commits or silently overwrite someone else's changes. A commit is not a deployment; pushing needs explicit permission.

## UI / upload / calculations

- **Upload page looks unstyled:** inspect `globals.css` import, root layout, installed Tailwind, Next/Turbopack and CSS Module exports. The custom Tailwind rule must target `globals.css` only. A previous wildcard `*.css` rule broke module class names. Preserve the existing design system.
- **Camera opens file picker on desktop:** supported fallback. Rear-camera capture is a browser/device capability, not a backend camera API. Verify on an actual phone before claiming it works there.
- **HEIC or renamed unsupported image rejected:** expected. Supported formats are JPEG/PNG/WebP with MIME/content/decoding validation, <=10 MB. Renaming an extension does not convert an image.
- **Refresh loses the original sketch:** expected for the unsaved temporary image flow. Saved projects preserve inputs, not photographs; open saved projects from history to reload configuration/prices.
- **Homepage says no recent projects but history contains projects:** the homepage's recent-project widget is still a static empty state. The actual management page is `/domenii/mobilier/proiecte`.
- **Mock dimensions do not match the photograph:** expected. It is fixed demonstration interpretation and must remain labeled as such. Edit/confirm the actual values; do not add real AI to hide this POC limitation.
- **Continue/confirm disabled:** inspect upload validity, centralized dimension/count rules and confirmation state. Do not silently clamp invalid draft input.
- **Deviz incomplete:** required positive-quantity items need prices. Empty and explicit zero are different. Complete inputs and apply prices again; do not treat missing values as zero or use a partial total as a final selling price.
- **Edited values show an outdated-estimate notice:** explicit recalculation is required. Configurations must be confirmed before recalculating/saving.

## Saving and authentication

First check `NEXT_PUBLIC_PROJECT_STORAGE`. Default `browser` uses localStorage without server project CRUD or login; inspect browser storage permissions/quota and [browser saving](browser-projects.md). A disabled backend capability is normal in this mode. In explicit `api` mode, check `GET /api/v1/furniture/project-capabilities` on the actual backend before assuming a database failure.

| Situation | Meaning / action |
| --- | --- |
| Projects missing on another device / browser mode | Expected: localStorage is origin/device/profile-specific, with no sync. Existing Supabase code is retained but requires explicit later API mode/setup; no automatic migration occurs. |
| Browser storage blocked/full | Permit site data/use a normal window or free space intentionally. Failed writes must not report success or overwrite saved data. Never use `localStorage.clear()` as a repair. |
| Browser history warns about unreadable data | Valid projects remain accessible; corrupt/versioned records are preserved. Do not reset the store or overwrite records to silence the warning. |
| Name can be typed but Save is disabled | Check name/price validity, confirmed configuration, service capability and login. Editable input does not mean storage has been activated. |
| Capabilities disabled / endpoint 404 on an old deployment | Cloud may be unconfigured, or the deployed backend predates persistence. Check dashboard deployed SHA and environment, then follow authorized deployment steps. |
| Default production CRUD returns 404 | Safe default when neither authorized storage mode is enabled; do not expose SQLite publicly to remove this response. |
| Cloud CRUD returns 401 | No valid user session / token expired. Sign in; backend verifies identity at Supabase Auth. Do not use owner headers or a service-role key. |
| Another account's UUID returns 404 | Expected privacy boundary. Do not reveal project existence or bypass RLS. |
| Local CRUD returns 403 | Check direct loopback access, localhost Host/Origin and explicit local flags. It is intentionally unavailable through public tunnels. |
| Update/delete returns 409 | Another session changed the revision or a historical schema/profile is incompatible. Preserve unsaved work separately and reopen; do not blindly retry with forced latest data. |
| SQLite / provider 503 | Retry after checking service availability, file access/locks or provider configuration. No successful save was confirmed; current inputs should remain. |
| Supabase mode fails startup | With `ENABLE_CLOUD_PROJECTS=true`, valid HTTPS URL and publishable/anon key are mandatory. No secret/service-role key. Check variable names without printing values. |
| Login popup is blocked | Allow the popup and try again. The original tab must not be redirected away and lose its temporary sketch. |
| Google login only accepts listed users | Check Google OAuth Testing vs Production publishing/audience settings. Do not purchase a plan or add paid APIs to solve this. |
| OAuth redirect/callback fails | Distinguish Google's Supabase `/auth/v1/callback` from FORMA's `/domenii/mobilier/profil/` return URL. Confirm exact scheme/host/path, including `/forma` on Pages. |
| Login succeeds but another device sees nothing | Use the same Google account and same Supabase project; confirm Save succeeded, migration/RLS ran, both deployments use matching variables and the project was not saved only in local SQLite. |
| Project reopens with a version warning | Keep it read-only and preserve original data. Do not silently rewrite profile/schema/calculation identifiers. |

## Hosted deployment

- **Render: `Neither setup.py nor pyproject.toml found`:** set Root Directory to `backend`; build is `pip install .`.
- **Render startup cannot bind / health check fails:** hosted start command uses `--host 0.0.0.0 --port $PORT`. The local SQLite start command uses `127.0.0.1`; do not confuse the modes.
- **Pages shows README instead of the app:** choose GitHub Actions as Pages source and deploy `frontend/out`, not repository root files.
- **Frontend points at localhost after deployment:** set `NEXT_PUBLIC_API_BASE_URL` in GitHub Actions repository variables and rebuild; editing Render variables cannot rewrite the static bundle.
- **CORS failure:** use exact browser origin (including port locally), without path. For Pages it is `https://andreiormeisan.github.io`, not the `/forma` URL. CORS is not authentication.
- **Public env changes have no effect:** Next.js embeds them during build; authorize and run a new frontend build/deployment. Restart local dev after `.env.local` changes.
- **Docs-only push did not publish the frontend:** the Pages workflow filters changes to frontend/workflow paths. Do not claim deployment occurred; inspect Actions and use manual dispatch only when authorized.
- **Backend cold start / free provider pause:** existing Render cold starts or Supabase Free inactivity limits can affect availability. Recheck the service and retry; do not promise paid-plan uptime or activate paid upgrades automatically.

## Verification honesty

Existing warnings about Node module type and Starlette's TestClient/HTTPX are not by themselves failing tests. Read exit codes and the actual failures. Mocked cloud tests cannot establish real RLS, Google dashboard setup or multi-device access. Browser tooling being unavailable is a verification limit, not proof of correct rendering or an outage. Report the limit and the checks actually run.
