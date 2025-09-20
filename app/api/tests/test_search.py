from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed


def test_search_snippet_and_filters():
    ensure_seed()
    c = TestClient(app)
    r = c.get(
        "/api/search",
        params={"q": "demo", "scope": "files"},
        headers={"X-Token": "devtoken"},
    )
    assert r.status_code == 200
    payload = r.json()
    assert "results" in payload
    assert "next_cursor" in payload
    if payload["results"]:
        item = payload["results"][0]
        assert set(item.keys()) >= {"type", "id", "name", "path", "project", "tags"}
        assert item["type"] in {"file", "project"}

    r2 = c.get(
        "/api/search",
        params={"q": "demo", "scope": "files", "facets": 1},
        headers={"X-Token": "devtoken"},
    )
    assert r2.status_code == 200
    payload2 = r2.json()
    assert "facets" in payload2
    assert isinstance(payload2["facets"].get("tags", []), list)


def test_search_invalid_query_leading_slash():
    ensure_seed()
    c = TestClient(app)
    r = c.get(
        "/api/search",
        params={"q": "/tag:demo"},
        headers={"X-Token": "devtoken"},
    )
    assert r.status_code == 400
    detail = r.json().get("detail")
    assert detail["code"] == "BAD_QUERY"
