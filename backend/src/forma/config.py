"""Environment-based application configuration."""

import os
from dataclasses import dataclass
from pathlib import Path


def get_cors_origins() -> list[str]:
    value = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )
    return [origin.strip() for origin in value.split(",") if origin.strip()]


@dataclass(frozen=True)
class ProjectSettings:
    enabled: bool
    database_path: Path | None

    @classmethod
    def from_environment(cls) -> "ProjectSettings":
        # Both switches are required. Render must never enable unauthenticated CRUD.
        enabled = (os.getenv("FORMA_ENV") == "local" and
                   os.getenv("ENABLE_LOCAL_PROJECTS") == "true" and
                   not os.getenv("RENDER"))
        if not enabled:
            return cls(False, None)
        url = os.getenv("DATABASE_URL", "sqlite:///./.local/forma.db")
        if not url.startswith("sqlite:///") or not url.removeprefix("sqlite:///") or "?" in url:
            raise ValueError("Local projects require a file-based sqlite:/// DATABASE_URL.")
        path = Path(url.removeprefix("sqlite:///"))
        if str(path) == ":memory:":
            raise ValueError("Local projects require a persistent SQLite file.")
        return cls(True, path.resolve())
