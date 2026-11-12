# FORMA architecture

## Product scope

The initial MVP targets wardrobes made from particleboard (PAL). The future workflow starts with a photograph of a hand-drawn sketch and produces material estimates, cutting lists, hardware requirements, and production costs.

## Current implementation

The monorepo contains two independently installed applications. The frontend uses Next.js App Router, React, TypeScript, Tailwind CSS, and ESLint. Its root page is an empty initialization shell with Romanian document language. The backend uses FastAPI, Pydantic, and Uvicorn. It exposes `GET /api/health`, returning `{"status":"ok"}`.

The Python package uses a `src` layout. `main.py` creates the application and registers middleware and routes. `config.py` reads environment configuration. `api/health.py` defines the health route and response schema. Tests exercise the HTTP boundary through FastAPI TestClient.

## Responsibility boundaries

The frontend will handle mobile-first interaction, image selection, review of interpreted data, and display of results in Romanian. The backend will validate inputs and own all calculation rules.

Future image interpretation will convert image evidence into structured furniture inputs. Deterministic backend code will calculate furniture geometry, material quantities, cutting lists, hardware, and pricing. Interpretation results will require validation before calculations. Detailed schemas and calculation rules will be defined when those capabilities are implemented.

Future modules may cover uploads, interpretation, geometry, materials, hardware, and quotations. Create each module when its implementation is needed.

## Local runtime

The frontend runs on port 3000 and the backend on port 8000. Backend CORS defaults permit `http://localhost:3000` and `http://127.0.0.1:3000`. `CORS_ORIGINS` accepts a comma-separated override. Uvicorn can load an optional `backend/.env` via `--env-file .env`. The frontend reads optional public settings from `frontend/.env.local`.

This initialization includes no persistence, authentication, external integrations, or business calculations.
