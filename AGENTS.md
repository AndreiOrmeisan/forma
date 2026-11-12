# FORMA engineering conventions

## Scope

FORMA is a mobile-first application for estimating particleboard (PAL) wardrobes from photographs of hand-drawn sketches. This repository currently contains the initialization scaffold.

## Architecture

- `frontend/` contains Next.js App Router, React, TypeScript, and Tailwind CSS with source under `src/`.
- `backend/` contains a Python FastAPI package under `src/forma/` and pytest tests.
- `docs/architecture.md` records architectural boundaries and future directions.
- HTTP endpoints use the `/api` prefix. The current endpoint is `GET /api/health`.
- AI will produce structured interpretations. Deterministic Python domain logic will calculate geometry, materials, hardware, and costs.

## Conventions

- Write code, identifiers, filenames, and technical documentation in English. User-facing UI copy is Romanian.
- Keep frontend presentation and backend calculations separate.
- Prefer simple functions, explicit types, Pydantic boundary validation, and minimal dependencies.
- Add modules when implementation requires them. Keep HTTP handlers thin as domain functionality is introduced.
- Use npm and commit `frontend/package-lock.json`. Manage Python dependencies in `backend/pyproject.toml`.
- Never commit secrets, virtual environments, generated builds, or dependency directories.
- Do not introduce product UI, AI integrations, furniture calculations, databases, authentication, Docker, or external services without a task requesting them.
- Preserve existing behavior and run relevant checks before completing changes.

## Validation

From `frontend/`, run `npm run lint`, `npm run typecheck`, and `npm run build`.
From `backend/`, after installing `.[dev]` in a virtual environment, run `python -m pytest`.
Start the backend and verify `GET http://localhost:8000/api/health` returns `{"status":"ok"}`.
See the root README for Windows commands.
