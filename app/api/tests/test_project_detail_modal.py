from __future__ import annotations

from contextlib import contextmanager

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed
from api.settings import settings


def _auth_headers() -> dict[str, str]:
    return {"X-Token": "devtoken"}


@contextmanager
def project_modal_enabled():
    original = settings.project_modal
    settings.project_modal = 1
    try:
        yield
    finally:
        settings.project_modal = original


def _get_project_id(client: TestClient) -> tuple[str, str]:
    resp = client.get("/api/projects", headers=_auth_headers())
    assert resp.status_code == 200
    payload = resp.json()
    if isinstance(payload, list):
        project = payload[0]
    else:
        project = payload["projects"][0]
    return project["id"], project.get("slug", project["id"])


def test_project_modal_summary_tree_preview_and_activity_endpoints():
    ensure_seed()
    client = TestClient(app)

    with project_modal_enabled():
        project_id, _ = _get_project_id(client)

        summary_resp = client.get(f"/api/projects/{project_id}/modal", headers=_auth_headers())
        assert summary_resp.status_code == 200
        summary = summary_resp.json()
        assert summary["id"] == project_id
        assert "quick_stats" in summary
        assert isinstance(summary["quick_stats"], list)

        tree_resp = client.get(f"/api/projects/{project_id}/tree", headers=_auth_headers())
        assert tree_resp.status_code == 200
        tree = tree_resp.json()
        assert "items" in tree
        assert tree["total"] >= len(tree["items"])
        assert any(node.get("type") == "file" for node in tree["items"])

        first_file = next((node for node in tree["items"] if node.get("type") == "file"), None)
        assert first_file is not None

        preview_resp = client.get(f"/api/files/{first_file['file_id']}/preview", headers=_auth_headers())
        assert preview_resp.status_code == 200
        preview = preview_resp.json()
        assert preview["id"] == first_file["file_id"]
        assert preview["path"] == first_file["path"]

        activity_resp = client.get(f"/api/projects/{project_id}/activity", headers=_auth_headers())
        assert activity_resp.status_code == 200
        activity = activity_resp.json()
        assert "items" in activity
        assert isinstance(activity["items"], list)
        assert "sources" in activity
