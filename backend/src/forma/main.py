"""ASGI application entry point."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import sqlite3
from json import JSONDecodeError
from pydantic import ValidationError

from forma.api.health import router as health_router
from forma.api.furniture import router as furniture_router
from forma.config import get_cors_origins, ProjectSettings, CloudSettings


def create_app() -> FastAPI:
    settings = ProjectSettings.from_environment()
    cloud = CloudSettings.from_environment()
    projects_enabled = settings.enabled or cloud.enabled

    @asynccontextmanager
    async def lifespan(app):
        if settings.enabled and not cloud.enabled:
            from forma.domains.furniture.project_store import ProjectStore
            store = ProjectStore(settings.database_path)
            store.initialize()
            app.state.project_store = store
        yield

    app = FastAPI(title="FORMA API", version="0.1.0", lifespan=lifespan)
    app.state.cloud_settings = cloud

    @app.middleware("http")
    async def private_projects_no_cache(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/v1/furniture/projects"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Pragma"] = "no-cache"
        return response
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["GET", "POST", "PATCH", "DELETE"] if projects_enabled else ["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(furniture_router, prefix="/api")

    @app.get("/api/v1/furniture/project-capabilities")
    def project_capabilities():
        return {"enabled": projects_enabled, "requires_auth": cloud.enabled, "storage": "cloud" if cloud.enabled else "local" if settings.enabled else "disabled",
                "reason": None if projects_enabled else "Salvarea online nu este încă configurată. Configurația și prețurile pot fi completate, dar nu vor fi salvate până la activarea serviciului."}

    if projects_enabled:
        from forma.api.projects import router as projects_router
        from forma.domains.furniture.project_store import MissingProject, ProjectConflict
        from forma.domains.furniture.projects import InvalidStoredProject
        from forma.shared.cloud_auth import CloudUnauthorized, CloudUnavailable
        app.include_router(projects_router, prefix="/api")

        @app.exception_handler(CloudUnauthorized)
        async def cloud_unauthorized(request, error):
            return JSONResponse(status_code=401, content={"detail": "Autentifică-te pentru a accesa proiectele tale."}, headers={"WWW-Authenticate": "Bearer"})

        @app.exception_handler(CloudUnavailable)
        async def cloud_unavailable(request, error):
            return JSONResponse(status_code=503, content={"detail": "Serviciul de proiecte nu este disponibil momentan. Datele introduse nu au fost șterse."})

        @app.exception_handler(MissingProject)
        async def missing_project(request, error):
            return JSONResponse(status_code=404, content={"detail": "Proiectul nu există sau a fost șters."})

        @app.exception_handler(ProjectConflict)
        async def project_conflict(request, error):
            return JSONResponse(status_code=409, content={"detail": "Proiectul a fost modificat în altă sesiune sau versiunea nu este compatibilă. Redeschide proiectul înainte de a salva."})

        @app.exception_handler(sqlite3.Error)
        async def database_error(request, error):
            return JSONResponse(status_code=503, content={"detail": "Stocarea locală nu este disponibilă. Încearcă din nou; datele introduse rămân în pagină."})

        @app.exception_handler(JSONDecodeError)
        @app.exception_handler(ValidationError)
        @app.exception_handler(InvalidStoredProject)
        async def incompatible_data(request, error):
            return JSONResponse(status_code=409, content={"detail": "Datele salvate nu pot fi citite în această versiune. Proiectul original nu a fost modificat."})
    return app


app = create_app()
