"""Environment-based application configuration."""

import os


def get_cors_origins() -> list[str]:
    value = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    )
    return [origin.strip() for origin in value.split(",") if origin.strip()]
