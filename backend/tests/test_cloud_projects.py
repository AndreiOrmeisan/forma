"""Cloud boundary tests using a fake Auth/PostgREST server, never real accounts."""

from copy import deepcopy
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from forma.main import create_app
from forma.config import CloudSettings

BASE = "/api/v1/furniture/projects"
A, B = str(uuid4()), str(uuid4())
CONFIG = dict(width_mm=800,height_mm=2000,depth_mm=600,doors_count=2,shelves_count=3)


class FakeSupabase:
    def __init__(self):
        self.rows = {}
        self.calls = []

    def request(self, method, url, *, headers, **kwargs):
        self.calls.append((method,url,deepcopy(headers),deepcopy(kwargs)))
        owner = {"Bearer token-a":A,"Bearer token-b":B}.get(headers["Authorization"])
        if not owner:
            return httpx.Response(401,json={"error":"expired or forged"})
        if url.endswith("/auth/v1/user"):
            return httpx.Response(200,json={"id":owner})
        assert headers["apikey"] == "sb_publishable_test"
        assert url.endswith("/rest/v1/forma_projects")
        params = kwargs.get("params", {})
        if method == "POST":
            body = kwargs["json"]
            assert body["owner_id"] == owner
            now = datetime.now(UTC).isoformat()
            row = {**body,"id":str(uuid4()),"created_at":now,"updated_at":now,"revision":1}
            self.rows[row["id"]] = row
            return httpx.Response(201,json=[deepcopy(row)])
        assert params["owner_id"] == "eq." + owner
        rows = [row for row in self.rows.values() if row["owner_id"] == owner]
        if "id" in params:
            rows = [row for row in rows if "eq." + row["id"] == params["id"]]
        if "revision" in params:
            rows = [row for row in rows if "eq." + str(row["revision"]) == params["revision"]]
        if method == "PATCH":
            assert set(kwargs["json"]) == {"payload"}
            for row in rows:
                row["payload"] = kwargs["json"]["payload"]
                row["revision"] += 1
                row["updated_at"] = (datetime.fromisoformat(row["updated_at"]) + timedelta(microseconds=1)).isoformat()
        elif method == "DELETE":
            for row in rows:
                del self.rows[row["id"]]
        total = len(rows)
        if "limit" in params:
            rows = sorted(rows,key=lambda row:row["updated_at"],reverse=True)
            start, limit = int(params["offset"]), int(params["limit"])
            rows = rows[start:start+limit]
        return httpx.Response(200,json=deepcopy(rows),headers={"content-range":f"0-0/{total}"})


@pytest.fixture
def cloud(monkeypatch):
    monkeypatch.setenv("FORMA_ENV", "production")
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("ENABLE_CLOUD_PROJECTS", "true")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    server = FakeSupabase()
    monkeypatch.setattr("forma.shared.cloud_auth.httpx.request", server.request)
    with TestClient(create_app()) as client:
        yield client, server


def auth(token="token-a"):
    return {"Authorization":"Bearer " + token}


def create(client, token="token-a"):
    response = client.post(BASE,headers=auth(token),json={"name":"Proiect privat","confirmed_configuration":CONFIG})
    assert response.status_code == 201, response.text
    return response.json()


def test_production_cloud_requires_verified_identity_for_every_operation(cloud):
    client, server = cloud
    capability = client.get("/api/v1/furniture/project-capabilities").json()
    assert capability["requires_auth"] and capability["storage"] == "cloud"
    for method, path in [("GET",BASE),("POST",BASE),("GET",f"{BASE}/{uuid4()}"),("PATCH",f"{BASE}/{uuid4()}"),("DELETE",f"{BASE}/{uuid4()}?expected_revision=1"),("POST",f"{BASE}/{uuid4()}/duplicate")]:
        assert client.request(method,path,headers={"X-User-Id":A,"X-Local-Development":"true"}).status_code == 401
        assert client.request(method,path,headers=auth("forged-token")).status_code == 401
    assert not server.rows
    assert client.get(BASE).headers["cache-control"] == "no-store"


def test_two_users_cannot_read_edit_duplicate_or_delete_each_others_projects(cloud):
    client, server = cloud
    first = create(client)
    second = create(client,"token-b")
    assert [row["id"] for row in client.get(BASE,headers=auth()).json()["items"]] == [first["id"]]
    assert [row["id"] for row in client.get(BASE,headers=auth("token-b")).json()["items"]] == [second["id"]]
    path = f"{BASE}/{first['id']}"
    for method,suffix,body in [("GET","",None),("PATCH","",{"expected_revision":1,"name":"stolen"}),("POST","/duplicate",None),("DELETE","?expected_revision=1",None)]:
        assert client.request(method,path+suffix,headers=auth("token-b"),json=body).status_code == 404
    assert server.rows[first["id"]]["payload"]["name"] == "Proiect privat"
    assert client.post(BASE,headers=auth(),json={"name":"Bad","confirmed_configuration":CONFIG,"owner_id":B}).status_code == 422


def test_cloud_lifecycle_revision_and_pricing_reuse(cloud):
    client, server = cloud
    saved = create(client)
    path = f"{BASE}/{saved['id']}"
    updated = client.patch(path,headers=auth(),json={"expected_revision":1,"confirmed_configuration":CONFIG | {"width_mm":901},"labor_cost":"200","markup_percentage":"10"}).json()
    assert updated["revision"] == 2 and updated["id"] == saved["id"]
    assert updated["created_at"] == saved["created_at"] and updated["updated_at"] > saved["updated_at"]
    assert client.patch(path,headers=auth(),json={"expected_revision":1,"name":"stale"}).status_code == 409
    copy = client.post(path+"/duplicate",headers=auth()).json()
    assert copy["id"] != saved["id"] and copy["status"] == "draft"
    assert copy["labor_cost"] == "200" and copy["confirmed_configuration"]["width_mm"] == 901
    assert client.delete(path,headers=auth(),params={"expected_revision":1}).status_code == 409
    assert client.delete(path,headers=auth(),params={"expected_revision":2}).status_code == 204
    assert client.get(path,headers=auth()).status_code == 404


def test_provider_failures_are_safe_and_never_return_other_users_data(cloud, monkeypatch):
    client, server = cloud
    saved = create(client)
    original = server.request
    def malicious(method,url,**kwargs):
        response = original(method,url,**kwargs)
        if "/rest/" in url:
            return httpx.Response(200,json=[{**next(iter(server.rows.values())),"owner_id":B}])
        return response
    monkeypatch.setattr("forma.shared.cloud_auth.httpx.request",malicious)
    response = client.get(f"{BASE}/{saved['id']}",headers=auth())
    assert response.status_code == 503 and "Proiect privat" not in response.text
    def unavailable(*args,**kwargs):
        raise httpx.ConnectError("internal url and credentials")
    monkeypatch.setattr("forma.shared.cloud_auth.httpx.request",unavailable)
    response = client.get(BASE,headers=auth())
    assert response.status_code == 503 and "credentials" not in response.text


@pytest.mark.parametrize("key", ["sb_secret_do_not_use","not-a-public-key",""])
def test_cloud_configuration_rejects_secret_or_invalid_keys(monkeypatch,key):
    monkeypatch.setenv("ENABLE_CLOUD_PROJECTS","true")
    monkeypatch.setenv("SUPABASE_URL","https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY",key)
    with pytest.raises(ValueError,match="publishable"):
        CloudSettings.from_environment()


def test_cors_allows_authorization_on_configured_cloud_mode(cloud):
    client,_ = cloud
    response = client.options(BASE,headers={"Origin":"http://localhost:3000","Access-Control-Request-Method":"PATCH","Access-Control-Request-Headers":"Authorization,Content-Type"})
    assert response.status_code == 200
