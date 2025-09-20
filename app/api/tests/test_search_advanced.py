from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed


def test_saved_search_crud_and_query():
    ensure_seed()
    c = TestClient(app)
    body = {"name": "Demo", "query": "demo", "filters": {"scope": "files", "tags": ["demo"]}}
    r = c.post("/api/search/saved", json=body, headers={"X-Token": "devtoken"})
    assert r.status_code == 201
    sid = r.json()["id"]

    r = c.get("/api/search/saved", headers={"X-Token": "devtoken"})
    assert r.status_code == 200
    rows = r.json()
    assert any(x["id"] == sid for x in rows)

    r = c.delete(f"/api/search/saved/{sid}", headers={"X-Token": "devtoken"})
    assert r.status_code in (200, 204)


def test_search_filters_scope_and_pagination():
    ensure_seed()
    c = TestClient(app)
    r = c.get(
        "/api/search",
        params={"q": "demo", "scope": "projects", "limit": 5},
        headers={"X-Token": "devtoken"},
    )
    assert r.status_code == 200
    payload = r.json()
    assert "results" in payload
    if payload["results"]:
        assert payload["results"][0]["type"] == "project"

    r2 = c.get(
        "/api/search",
        params={"q": "demo", "scope": "files", "tags[]": "demo", "cursor": 0},
        headers={"X-Token": "devtoken"},
    )
    assert r2.status_code == 200
    assert "results" in r2.json()
