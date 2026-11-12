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
from forma.config import get_cors_origins, ProjectSettings


def create_app() -> FastAPI:
    settings = ProjectSettings.from_environment()

    @asynccontextmanager
    async def lifespan(app):
        if settings.enabled:
            from forma.domains.furniture.project_store import ProjectStore
            store = ProjectStore(settings.database_path)
            store.initialize()
            app.state.project_store = store
        yield

    app = FastAPI(title="FORMA API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["GET", "POST", "PATCH", "DELETE"] if settings.enabled else ["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(furniture_router, prefix="/api")

    @app.get("/api/v1/furniture/project-capabilities")
    def project_capabilities():
        return {"enabled": settings.enabled, "reason": None if settings.enabled else "Salvarea proiectelor este disponibilă doar în dezvoltare locală. Instalarea publică nu are autentificare și stocare permanentă configurată."}

    if settings.enabled:
        from forma.api.projects import router as projects_router
        from forma.domains.furniture.project_store import MissingProject, ProjectConflict
        from forma.domains.furniture.projects import InvalidStoredProject
        app.include_router(projects_router, prefix="/api")

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
