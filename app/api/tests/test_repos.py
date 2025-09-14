from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed
from api.settings import settings


def test_create_repo_and_status_project_scope():
    ensure_seed()
    # Enable git integration for tests
    settings.git_integration = 1
    c = TestClient(app)
    # Find a project
    pr = c.get("/api/projects", headers={"X-Token": "devtoken"})
    assert pr.status_code == 200
    projects = pr.json()
    assert projects and isinstance(projects, list)
    pid = projects[0]["id"]
    # Create repo
    cr = c.post(
        "/api/repos",
        json={
            "scope": "project",
            "project_id": pid,
            "provider": "local",
            "name": "test-repo",
            "repo_url": None,
            "visibility": "private",
        },
        headers={"X-Token": "devtoken"},
    )
    assert cr.status_code in (200, 201), cr.text
    repo = cr.json()
    assert repo["id"] and repo["scope"] == "project" and repo["project_id"] == pid
    # Status
    sr = c.get(f"/api/repos/{repo['id']}/status", headers={"X-Token": "devtoken"})
    assert sr.status_code == 200, sr.text
    st = sr.json()
    assert "ahead" in st and "behind" in st and "dirty" in st

