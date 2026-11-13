# FORMA

**New developer or coding agent: read [docs/README.md](docs/README.md) first, then [docs/INIT.md](docs/INIT.md) and [the agent handoff](docs/agent-handoff.md) before editing or installing services.**

FORMA is a multi-domain estimation platform. Furniture is the first implemented domain; the current POC supports PAL wardrobes only. Photographed sketches use explicitly labeled, deterministic mock interpretation. Python calculates cutting lists, materials, edge banding, provisional hardware and manual-price deviz; the Romanian frontend provides configuration and a live SVG preview.

## Documentation

All maintained setup, context and feature references live in [docs/](docs/README.md). Root and frontend `AGENTS.md` stay in their standard agent-discovery locations and point there.

| Start with | What it covers |
| --- | --- |
| [INIT](docs/INIT.md) | Every laptop prerequisite, install commands, environments, local startup and validation |
| [Agent handoff](docs/agent-handoff.md) | Current implementation, pending activation, restrictions and known limitations |
| [Services and deployment](docs/services-and-deployment.md) | Hosting links, dashboards, variable ownership and publishing |
| [Architecture](docs/architecture.md) | Routes, API/state boundaries and extension strategy |
| [Wardrobe engine](docs/wardrobe-engine.md) | Exact POC geometry, material, banding and hardware rules |
| [Pricing](docs/future-supplier-pricing.md) | Manual RON prices, allowances, Decimal rounding and future supplier boundary |
| [Persistence](docs/project-persistence.md) | Project lifecycle, SQLite, cloud storage, revisions and backups |
| [Free online setup](docs/free-online-setup.md) | Owner's Supabase Free / Google OAuth activation steps |
| [Troubleshooting](docs/troubleshooting.md) | Windows, Git, styling, uploads, auth and deployment failures |

## Recorded service addresses

- Source: [AndreiOrmeisan/forma](https://github.com/AndreiOrmeisan/forma).
- Frontend: [GitHub Pages application](https://andreiormeisan.github.io/forma/).
- Backend: [Render API](https://forma-q8f6.onrender.com), [health endpoint](https://forma-q8f6.onrender.com/api/health).
- Online database/accounts: Supabase PostgreSQL/Auth; the owner's actual project URL/ref is not recorded yet. See [service directory](docs/services-and-deployment.md).

These links do not establish which commit is live. Cloud support exists in code; Supabase/Google account configuration and real-account verification are owner-managed and were pending at the documentation audit. No paid service or automatic billing activation is authorized.

## Quick local start

First install Git, Node **24.x** and Python **3.12.x**, then follow [INIT](docs/INIT.md) to create `backend/.venv`, install `.[dev]` and run `npm.cmd ci` in `frontend/`. Do not recreate the monorepo or clone inside an existing checkout.

From the repository root, in separate terminals:

```powershell
# Backend terminal
cd backend
.\.venv\Scripts\python.exe -m uvicorn forma.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
# Frontend terminal
cd frontend
npm.cmd run dev
```

Open http://localhost:3000. Use `npm` and `.venv/bin/python` on macOS/Linux. Basic calculations work without cloud credentials. Project saving is disabled by default; [INIT](docs/INIT.md) explains explicit local SQLite mode and [online setup](docs/free-online-setup.md) explains private account mode.

Images remain temporary. Saved projects persist configuration/pricing inputs and recalculate results when reopened; they do not preserve the original photograph. The real project history/editor is implemented under `/domenii/mobilier/proiecte`; the furniture homepage's recent-project widget remains a static empty state.

## Engineering rules

Read [AGENTS.md](AGENTS.md) and relevant docs before changing code. Technical docs/code are English; UI and owner-facing communication are Romanian. Preserve the Minimal Premium design, deterministic Python calculations, validation, privacy/ownership and exact Decimal outputs.

No real AI, paid services, supplier scraping or unsupported domains. Never commit secrets or image blobs, and never store image blobs in localStorage. Unauthenticated SQLite CRUD must stay local; public cloud CRUD requires verified accounts and RLS. Do not push or deploy without explicit permission.

Validation commands are in [INIT](docs/INIT.md). Frontend scripts: `lint`, `typecheck`, `test`, `build`. Backend: `python -m pytest` in the installed venv. Keep documentation in sync with feature and configuration changes.
