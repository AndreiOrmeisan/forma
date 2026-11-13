"""Local persistence lifecycle, transactions, versioning and fail-closed deployment."""

import json
import sqlite3
from datetime import datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from forma.main import create_app
from forma.domains.furniture.project_store import ProjectStore
from forma.domains.furniture.projects import ProjectInput

BASE = "/api/v1/furniture/projects"
CONFIG = dict(width_mm=800, height_mm=2000, depth_mm=600, doors_count=2, shelves_count=3)


def data(**changes):
    return dict(name="Dulap dormitor", confirmed_configuration=CONFIG) | changes


@pytest.fixture
def local(monkeypatch, tmp_path):
    monkeypatch.delenv("ENABLE_CLOUD_PROJECTS", raising=False)
    monkeypatch.setenv("FORMA_ENV", "local")
    monkeypatch.setenv("ENABLE_LOCAL_PROJECTS", "true")
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(tmp_path / "projects.db"))
    with TestClient(create_app(), base_url="http://localhost", client=("127.0.0.1", 50000)) as client:
        yield client


def create(client, **changes):
    response = client.post(BASE, json=data(**changes))
    assert response.status_code == 201, response.text
    return response.json()


def test_create_read_list_update_duplicate_delete(local):
    assert local.get(BASE).json()["items"] == []
    saved = create(local, name="  Dormitor  ")
    project_id = saved["id"]
    UUID(project_id)
    assert saved["name"] == "Dormitor" and saved["status"] == "draft"
    assert saved["compatible"] and not saved["deviz_complete"]
    assert saved["schema_version"] == 1 and saved["calculation_version"] == "wardrobe-v1"
    assert datetime.fromisoformat(saved["created_at"]).utcoffset().total_seconds() == 0
    assert local.get(f"{BASE}/{project_id}").json() == saved
    updated = local.patch(f"{BASE}/{project_id}", json={"expected_revision": 1, "name": "Actualizat", "status": "completed", "confirmed_configuration": CONFIG | {"width_mm": 901}}).json()
    assert updated["id"] == project_id and updated["revision"] == 2
    assert updated["created_at"] == saved["created_at"]
    assert updated["updated_at"] > saved["updated_at"]
    copy = local.post(f"{BASE}/{project_id}/duplicate").json()
    assert copy["id"] != project_id and copy["status"] == "draft"
    assert copy["name"] == "Copie — Actualizat"
    assert copy["created_at"] > saved["created_at"]
    assert copy["confirmed_configuration"]["width_mm"] == 901
    assert local.get(f"{BASE}/{project_id}").json() == updated
    assert local.delete(f"{BASE}/{project_id}", params={"expected_revision": 2}).status_code == 204
    assert local.get(f"{BASE}/{project_id}").status_code == 404
    assert local.get(f"{BASE}/{copy['id']}").status_code == 200
    assert local.delete(f"{BASE}/{project_id}", params={"expected_revision": 2}).status_code == 404


def test_pagination_order_and_constraints(local):
    projects = [create(local, name=f"Dulap {i}") for i in range(3)]
    page = local.get(BASE, params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 3 and page["items"][0]["id"] == projects[1]["id"]
    assert local.get(BASE, params={"limit": 51}).status_code == 422
    assert local.get(BASE, params={"offset": -1}).status_code == 422


@pytest.mark.parametrize("changes", [
    {"name": " "}, {"name": "x" * 121}, {"status": "automatic"}, {"domain": "electrical"},
    {"schema_version": 2}, {"schema_version": True}, {"schema_version": 1.0},
    {"construction_profile_id": "unknown"}, {"calculation_version": "v2"},
    {"confirmed_configuration": CONFIG | {"width_mm": 0}}, {"labor_cost": "-1"},
    {"markup_percentage": "NaN"}, {"waste_allowances": {"pal": "101"}},
    {"image_path": "/tmp/image.png"}, {"id": str(uuid4())}, {"description": "x" * 2001},
])
def test_invalid_input(local, changes):
    assert local.post(BASE, json=data(**changes)).status_code == 422
    assert local.get(BASE).json()["total"] == 0


def test_update_conflict_preserves_original_and_whitelist(local):
    saved = create(local)
    url = f"{BASE}/{saved['id']}"
    for patch in [{"expected_revision": 1, "name": " "}, {"expected_revision": 1, "created_at": "fake"}, {"expected_revision": 1, "manual_price_catalog": None}]:
        assert local.patch(url, json=patch).status_code == 422
        assert local.get(url).json() == saved
    assert local.patch(url, json={"expected_revision": 5, "name": "Lost"}).status_code == 409
    assert local.delete(url, params={"expected_revision": 5}).status_code == 409
    assert local.get(url).json() == saved
    assert local.patch(f"{BASE}/{uuid4()}", json={"expected_revision": 1, "name": "Missing"}).status_code == 404
    assert local.get(f"{BASE}/not-a-uuid").status_code == 422


def test_restart_and_pricing_reproduction(local):
    from forma.domains.furniture.pricing import ITEMS
    prices = [dict(item_code=code, item_name=name, unit=unit, unit_price_ron="12.34", updated_at="2026-11-12T10:00:00Z") for code, (name, unit) in ITEMS.items()]
    saved = create(local, manual_price_catalog=prices, waste_allowances={"pal": "10", "hdf": "20", "abs": "30"}, labor_cost="200", markup_percentage="15")
    assert saved["deviz_complete"]
    with TestClient(create_app(), base_url="http://localhost", client=("127.0.0.1", 50001)) as restarted:
        loaded = restarted.get(f"{BASE}/{saved['id']}").json()
        assert loaded == saved
        request = dict(configuration=loaded["confirmed_configuration"], confirmed=True, price_catalog=loaded["manual_price_catalog"], waste_allowances=loaded["waste_allowances"], labor_cost_ron=loaded["labor_cost"], markup_percent=loaded["markup_percentage"])
        first = restarted.post("/api/v1/furniture/estimate", json=request).json()
        assert first["is_complete"] and first["labor_cost_ron"] == "200.00"
        assert first == local.post("/api/v1/furniture/estimate", json=request).json()


def test_rollback_database_errors_and_historical_versions(local, monkeypatch):
    saved = create(local)
    store = local.app.state.project_store
    # A real SQLite failure after a write must roll back the write.
    with pytest.raises(sqlite3.OperationalError):
        with store.transaction() as connection:
            connection.execute("DELETE FROM projects")
            connection.execute("INSERT INTO missing_table VALUES (1)")
    assert local.get(BASE).json()["total"] == 1
    with store.transaction() as connection:
        payload = json.loads(connection.execute("SELECT payload FROM projects").fetchone()[0])
        payload["calculation_version"] = "historical-v0"
        connection.execute("UPDATE projects SET payload=?", (json.dumps(payload),))
    loaded = local.get(f"{BASE}/{saved['id']}").json()
    assert not loaded["compatible"] and loaded["deviz_complete"] is None and loaded["warnings"]
    assert loaded["calculation_version"] == "historical-v0"
    assert local.patch(f"{BASE}/{saved['id']}", json={"expected_revision": 1, "name": "New"}).status_code == 409
    def fail(*args):
        raise sqlite3.OperationalError("C:/secret/internal.db")
    monkeypatch.setattr(store, "list", fail)
    response = local.get(BASE)
    assert response.status_code == 503 and "secret" not in response.text


@pytest.mark.parametrize("environment,enabled,render", [(None, None, None), ("production", "true", None), ("local", "false", None), ("local", "true", "true")])
def test_production_routes_absent_even_with_spoofed_headers(monkeypatch, environment, enabled, render, tmp_path):
    monkeypatch.delenv("ENABLE_CLOUD_PROJECTS", raising=False)
    for name, value in [("FORMA_ENV", environment), ("ENABLE_LOCAL_PROJECTS", enabled), ("RENDER", render)]:
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)
    path = tmp_path / "never-created.db"
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(path))
    with TestClient(create_app()) as client:
        assert not client.get("/api/v1/furniture/project-capabilities").json()["enabled"]
        for method, url in [("GET", BASE), ("POST", BASE), ("GET", f"{BASE}/{uuid4()}"), ("PATCH", f"{BASE}/{uuid4()}"), ("DELETE", f"{BASE}/{uuid4()}"), ("POST", f"{BASE}/{uuid4()}/duplicate")]:
            assert client.request(method, url, headers={"X-Local-Development": "true", "X-Forwarded-For": "127.0.0.1"}).status_code == 404
        assert not any(route.startswith(BASE) for route in client.get("/openapi.json").json()["paths"])
        assert client.get("/api/health").status_code == 200
    assert not path.exists()


def test_local_guard_rejects_remote_peer_origin_and_host(local):
    assert local.get(BASE, headers={"Origin": "https://evil.example"}).status_code == 403
    assert local.get(BASE, headers={"Host": "evil.example"}).status_code == 403
    with TestClient(local.app, base_url="http://localhost", client=("198.51.100.2", 50001)) as remote:
        assert remote.get(BASE, headers={"X-Forwarded-For": "127.0.0.1"}).status_code == 403


def test_unknown_database_schema_is_not_overwritten(tmp_path):
    path = tmp_path / "future.db"
    with sqlite3.connect(path) as connection:
        connection.execute("PRAGMA user_version=99")
    with pytest.raises(RuntimeError, match="Unsupported"):
        ProjectStore(path).initialize()


@pytest.mark.parametrize("payload", ["[]", "null", "{invalid json}"])
def test_corrupt_stored_structures_are_not_rewritten_or_leaked(local, payload):
    saved = create(local)
    store = local.app.state.project_store
    with store.transaction() as connection:
        connection.execute("UPDATE projects SET payload=? WHERE id=?", (payload, saved["id"]))
    assert local.get(f"{BASE}/{saved['id']}").status_code == 409
    with store.transaction() as connection:
        assert connection.execute("SELECT payload FROM projects").fetchone()[0] == payload


def test_equal_timestamps_have_uuid_tiebreaker(local):
    saved = [create(local) for _ in range(3)]
    with local.app.state.project_store.transaction() as connection:
        connection.execute("UPDATE projects SET updated_at=?", (saved[0]["updated_at"],))
    assert [item["id"] for item in local.get(BASE).json()["items"]] == sorted(item["id"] for item in saved)
