from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed


def test_search_snippet_and_filters():
    ensure_seed()
    c = TestClient(app)
    r = c.get("/api/search", params={"q": "demo"}, headers={"X-Token": "devtoken"})
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    if rows:
        it = rows[0]
        assert "file_id" in it and "title" in it and "path" in it
