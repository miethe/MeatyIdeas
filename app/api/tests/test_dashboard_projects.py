from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed
from api.db import init_db, Base, engine


HEADERS = {"X-Token": "devtoken"}


def _make_client() -> TestClient:
    Base.metadata.create_all(engine)
    init_db()
    return TestClient(app)


def test_dashboard_projects_structure_and_pagination() -> None:
    client = _make_client()
    ensure_seed()
    resp = client.get("/api/projects", headers=HEADERS)
    assert resp.status_code == 200
    payload = resp.json()
    assert set(payload.keys()) >= {"projects", "total", "limit", "view"}
    assert isinstance(payload["projects"], list)
    if payload["projects"]:
        project = payload["projects"][0]
        assert "language_mix" in project
        assert "file_count" in project
        assert "is_starred" in project
        assert "is_archived" in project


def test_star_and_archive_views() -> None:
    client = _make_client()
    ensure_seed()
    base = client.get("/api/projects", headers=HEADERS).json()
    projects = base.get("projects", [])
    if not projects:
        return
    project_id = projects[0]["id"]

    # star
    star_resp = client.post(f"/api/projects/{project_id}/star", headers=HEADERS)
    assert star_resp.status_code == 204
    starred = client.get("/api/projects", params={"view": "starred"}, headers=HEADERS).json()
    assert any(p["id"] == project_id for p in starred.get("projects", []))

    # unstar
    client.delete(f"/api/projects/{project_id}/star", headers=HEADERS)
    starred_after = client.get("/api/projects", params={"view": "starred"}, headers=HEADERS).json()
    assert all(p["id"] != project_id for p in starred_after.get("projects", []))

    # archive
    client.post(f"/api/projects/{project_id}/archive", headers=HEADERS)
    archived = client.get("/api/projects", params={"view": "archived"}, headers=HEADERS).json()
    assert any(p["id"] == project_id for p in archived.get("projects", []))

    # archived project should be hidden from default view
    default_after = client.get("/api/projects", headers=HEADERS).json()
    assert all(p["id"] != project_id for p in default_after.get("projects", []))

    # unarchive restores to default
    client.delete(f"/api/projects/{project_id}/archive", headers=HEADERS)
    restored = client.get("/api/projects", headers=HEADERS).json()
    assert any(p["id"] == project_id for p in restored.get("projects", []))


def test_tag_filtering() -> None:
    client = _make_client()
    ensure_seed()
    all_resp = client.get("/api/projects", headers=HEADERS).json()
    projects = all_resp.get("projects", [])
    if not projects:
        return
    target = projects[0]
    tags = target.get("tags", [])
    if not tags:
        return
    tag = tags[0]
    filtered = client.get(
        "/api/projects",
        params={"tags[]": tag},
        headers=HEADERS,
    ).json()
    assert all(tag in p.get("tags", []) for p in filtered.get("projects", []))
