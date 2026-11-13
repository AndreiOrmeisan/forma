# INIT — run FORMA on a new laptop

Last audited against the local source and installed tools: 2026-11-13. Read [agent handoff](agent-handoff.md) first. This guide starts from a clean laptop and existing repository; it does not scaffold a new application.

## 1. Install the required tools

The Sprint 11 personal supplier catalog needs no additional tools, accounts or environment variables. After local startup, open `/domenii/mobilier/furnizori`; data starts empty and is saved in this browser. Use its manual JSON backup before clearing site data. See [supplier catalog](supplier-catalog.md).

| Tool | Required baseline | Download / notes |
| --- | --- | --- |
| Git | A current supported Git client | [Git downloads](https://git-scm.com/downloads/). Required for clone/version control. |
| Node.js | **24.x**, matching CI | [Node downloads](https://nodejs.org/en/download). Select the 24.x line explicitly; the default download may be a newer major. npm comes with Node. |
| Python | **3.12.x recommended**, matching the tested runtime | [Python downloads](https://www.python.org/downloads/). The package allows >=3.12, but newer Python minors are not the tested baseline. Include pip and venv. |
| Browser | A modern browser | Needed for the application; supported phone browsers can request the rear camera. Desktop capture falls back to a file chooser. |
| Editor | Your choice | VS Code is optional; the app does not depend on an editor or an AI-agent subscription. |
| GitHub CLI (`gh`) | Optional | [GitHub CLI](https://cli.github.com/). Useful for private repository access, Actions and publishing; not required to run the applications. |

On Windows, restart terminals after installation so PATH updates apply. For Python, ensure the Python launcher (`py`) or the Python executable is available. If an organization's managed machine restricts installers, use its approved installation method.

You do **not** need Docker, Poetry, a global Next.js/Tailwind installation, a separate SQLite server, PostgreSQL installed locally, Supabase CLI, a paid API key or a cloud account for basic local development. `npm ci` and pip install the application's libraries. Initial package downloads and Next.js font retrieval may require internet access; offline-first installation is not provided.

Check tools in a new terminal:

```powershell
git --version
node --version
npm.cmd --version
py -3.12 --version
```

If `py` is unavailable but the correct Python is on PATH, use `python --version` and substitute `python` for `py -3.12` below. Check the version first; do not accidentally create the environment with Python 3.11 or a Windows Store alias.

### Observed versions, not mandatory global pins

| Component | Observed in the audited workspace |
| --- | --- |
| Node / npm / Git | 24.14.1 / 11.11.0 / 2.56.1.windows.1 |
| Python | 3.12.14 |
| Next.js / React / React DOM | 16.4.6 / 19.3.0 / 19.3.0 |
| TypeScript / ESLint | 5.9.3 / 9.39.5 |
| Tailwind / Tailwind Turbopack loader | 4.3.3 / 4.3.3 |
| Lucide / Supabase JS | 1.72.0 / 2.119.0 |
| FastAPI / Pydantic / Uvicorn | 0.162.5 / 2.14.3 / 0.54.0 |
| Pillow / python-multipart / HTTPX / pytest | 12.3.0 / 0.0.33 / 0.28.1 / 9.2.0 |

Use the committed frontend lockfile. Python uses compatible dependency ranges, so a fresh install may resolve newer patches. These numbers record a known working environment; they are not an instruction to upgrade the project to whatever is newest on a download page.

## 2. Obtain the existing repository

Repository: [AndreiOrmeisan/forma](https://github.com/AndreiOrmeisan/forma), **public** at the 2026-11-13 GitHub metadata check; default branch `main`. Public clone does not require authentication. Write access and dashboard administration still require the owner's permissions. If visibility changes later, use your own authorized GitHub account; never copy another person's tokens.

From the directory that will contain the checkout:

```powershell
git clone https://github.com/AndreiOrmeisan/forma.git
cd forma
git status --short --branch
```

If you are already in the FORMA workspace, skip cloning and stay in that root. Do not create an additional nested `forma` folder, rerun create-next-app, initialize another Git repository or recreate the remote. Read root `AGENTS.md` and `docs/README.md` before editing. Do not discard existing local changes when taking over another agent's workspace.

Optional GitHub CLI setup on a fresh Windows machine:

```powershell
winget install --id GitHub.cli --exact
```

Then open a new terminal and run `gh auth status`; use interactive `gh auth login` only if needed. Git's credential manager is another valid way to clone. See [troubleshooting](troubleshooting.md) if `gh` or Git identity is missing.

## 3. Install both applications once

From the repository root, install the backend:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
cd ..
```

The editable install is required for the `src/forma` package. Run pip through the environment's Python, not an unrelated global pip. There is no need to activate the environment, which avoids PowerShell activation-policy errors. Recreate a virtual environment on a new machine rather than copying `.venv` from another laptop.

Install the frontend:

```powershell
cd frontend
npm.cmd ci
cd ..
```

Use `npm.cmd` in Windows PowerShell to avoid `npm.ps1` execution-policy issues. On macOS/Linux, use `npm`. Do not replace the npm lockfile with Yarn/pnpm files or run broad dependency upgrades just to start the app.

## 4. Choose a runtime mode

| Mode | Setup | Project saving |
| --- | --- | --- |
| Browser POC (default) | No database/account setup; start both applications | localStorage in this browser/device, including GitHub Pages; no sync/permanent photograph |
| Local SQLite (retained) | Frontend `NEXT_PUBLIC_PROJECT_STORAGE=api` + explicit local backend variables below | Saves on that laptop, survives backend restart; no device sync |
| Private online account (deferred) | Frontend mode `api` + Supabase/Google setup + backend flags | Account in PostgreSQL; same account on other devices |

The owner deferred Supabase configuration for the POC. Use [browser saving](browser-projects.md) now; no account is needed. Calculations still need FastAPI. Keep cloud code for later and do not enable it before auth/RLS setup. SQLite is not a workaround for exposing unauthenticated storage publicly.

## 5. Start local development in two terminals

Both terminals begin in the repository root.

**Terminal A — backend:**

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn forma.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal B — frontend:**

```powershell
cd frontend
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). Backend health is [http://localhost:8000/api/health](http://localhost:8000/api/health); interactive API docs are [http://localhost:8000/docs](http://localhost:8000/docs). Stop your own foreground servers with Ctrl+C. Do not stop another developer's process merely because a port is occupied.

Optional frontend settings go in `frontend/.env.local`, which is ignored by Git:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_PROJECT_STORAGE=browser
```

Do not overwrite an existing environment file. Normal local dev does not need `GITHUB_PAGES` or `NEXT_PUBLIC_BASE_PATH`. Supabase public URL/key must be set together when using online auth. Never copy private server credentials into a frontend file.

### Enable local SQLite saving

First set `NEXT_PUBLIC_PROJECT_STORAGE=api` in `frontend/.env.local` and restart the frontend; otherwise it continues using localStorage. Stop Terminal A's server, set these variables in that backend terminal, and restart it:

```powershell
$env:FORMA_ENV = "local"
$env:ENABLE_LOCAL_PROJECTS = "true"
$env:ENABLE_CLOUD_PROJECTS = "false"
$env:DATABASE_URL = "sqlite:///./.local/forma.db"
.\.venv\Scripts\python.exe -m uvicorn forma.main:app --reload --host 127.0.0.1 --port 8000
```

The file is `backend/.local/forma.db` when started from `backend/`. Do not commit it. `RENDER` must not be set on a local laptop; the application deliberately rejects unauthenticated SQLite on a Render runtime. Keep this server bound to loopback. The original image is not saved.

### Environment loading rules

- The root `.env.example` is a template, not an automatically loaded configuration file.
- Next.js reads `frontend/.env.local`; restart dev after changing values. Public values are embedded at build time for deployment.
- The backend reads process environment. An optional `backend/.env` is loaded only when starting Uvicorn with `--env-file .env` from `backend/`.
- Shell variables already set in a terminal can override expectations from a file. Check which mode is active without printing secrets.
- Render variables and GitHub Actions variables are separate stores. Setting one does not update the other or your laptop.

## 6. Verify the installation

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
Invoke-RestMethod http://localhost:8000/api/health
Invoke-RestMethod http://localhost:8000/api/v1/furniture/project-capabilities
```

From `frontend/`:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Run frontend type generation and build sequentially: both write generated `.next` files. The current POC verification has 156 backend tests and 59 frontend tests passing; counts may change. Storage tests simulate a browser and cover CRUD/reload, blocked/full/corrupt data and API-mode isolation. External Supabase tests are mocked, not proof of live RLS/OAuth activation. The HTTP capability endpoint above reports backend storage, not the separate default browser adapter.

Manual smoke check: dashboard → furniture → upload JPEG/PNG/WebP (<=10 MB) → mock review → dimensions / 2D → confirm → materials / ABS / hardware → prices / deviz → browser save → list → refresh/open → edit → confirm/recalculate → save same UUID → duplicate → confirmed deletion of only the copy. API mode adds separate SQLite/cloud checks when selected.

Do not report screenshots, mobile rendering, real Google sign-in or multi-device sync as verified unless you actually exercised them. See [agent handoff](agent-handoff.md) for current verification limits.

## 7. macOS / Linux equivalents

Use the same Node 24.x and tested Python 3.12 line. From the repository root:

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m uvicorn forma.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

The commands above use default browser storage. For optional SQLite, select frontend `api` and set the equivalent local backend flags described above. Use `.venv/bin/python -m pytest -q` for backend tests and `npm` for frontend scripts. These macOS/Linux equivalents were not executed on the audited Windows laptop. Some Linux distributions require an OS package providing Python's `venv` module.

## 8. Before your first code change

Read [architecture](architecture.md), [services and deployment](services-and-deployment.md) and the relevant feature docs. Keep frontend/backend responsibilities separate, preserve the design system and use deterministic mocked interpretation only. No paid services or real AI. Obtain explicit permission before pushing to GitHub; a push can trigger deployment. Full Git/deployment guidance and common failures are in the linked guides.
