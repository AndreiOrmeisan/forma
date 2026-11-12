from fastapi.testclient import TestClient

from forma.main import create_app


def test_health() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_local_frontend_cors(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    with TestClient(create_app()) as client:
        response = client.get(
            "/api/health", headers={"Origin": "http://localhost:3000"}
        )

    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
