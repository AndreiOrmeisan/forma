"""ASGI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from forma.api.health import router as health_router
from forma.config import get_cors_origins


def create_app() -> FastAPI:
    app = FastAPI(title="FORMA API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_cors_origins(),
        allow_methods=["GET"],
        allow_headers=["Content-Type"],
    )
    app.include_router(health_router, prefix="/api")
    return app


app = create_app()
