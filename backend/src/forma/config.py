"""Environment-based application configuration."""

import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse
import base64
import json


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


@dataclass(frozen=True)
class CloudSettings:
    enabled: bool = False
    url: str = ""
    public_key: str = ""

    @classmethod
    def from_environment(cls) -> "CloudSettings":
        if os.getenv("ENABLE_CLOUD_PROJECTS") != "true":
            return cls()
        url = os.getenv("SUPABASE_URL", "").rstrip("/")
        key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
            raise ValueError("Cloud projects require a configured HTTPS Supabase URL.")
        public = key.startswith("sb_publishable_")
        if not public:
            try:
                claims = json.loads(base64.urlsafe_b64decode(key.split(".")[1] + "==="))
                public = isinstance(claims, dict) and claims.get("role") == "anon"
            except (IndexError, ValueError, TypeError):
                pass
        if not public:
            raise ValueError("Use only a Supabase publishable/anon key, never a secret or service_role key.")
        return cls(True, url, key)
