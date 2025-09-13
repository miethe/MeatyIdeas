from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed


def test_saved_search_crud_and_query():
    ensure_seed()
    c = TestClient(app)
    # create saved
    body = {"name": "Demo", "query": "demo", "filters": {"status": "idea", "sort": "score"}}
    r = c.post("/api/search/saved", json=body, headers={"X-Token": "devtoken"})
    assert r.status_code == 201
    sid = r.json()["id"]
    # list
    r = c.get("/api/search/saved", headers={"X-Token": "devtoken"})
    assert r.status_code == 200
    rows = r.json()
    assert any(x["id"] == sid for x in rows)
    # delete
    r = c.delete(f"/api/search/saved/{sid}", headers={"X-Token": "devtoken"})
    assert r.status_code in (200, 204)


def test_search_filters_and_sort():
    ensure_seed()
    c = TestClient(app)
    # basic query
    r = c.get("/api/search", params={"q": "demo", "limit": 5, "sort": "score"}, headers={"X-Token": "devtoken"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    # with status filter and updated_at sort
    r2 = c.get("/api/search", params={"q": "demo", "status": "idea", "sort": "updated_at"}, headers={"X-Token": "devtoken"})
    assert r2.status_code == 200
