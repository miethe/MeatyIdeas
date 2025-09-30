from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed
from api.db import SessionLocal
from api.models import Event


HEADERS = {"X-Token": "devtoken"}


def test_project_files_metadata_and_directories():
    ensure_seed()
    client = TestClient(app)

    projects_resp = client.get("/api/projects", headers=HEADERS)
    assert projects_resp.status_code == 200
    projects_payload = projects_resp.json()
    if isinstance(projects_payload, dict):
        projects_list = projects_payload.get("projects") or []
    else:
        projects_list = projects_payload
    assert projects_list, "expected seeded project"
    project_id = projects_list[0]["id"]

    content = "---\nstatus: draft\nowner: Ada Lovelace\n---\n# Spec\nBody"
    create_body = {
        "title": "Metadata File",
        "path": "docs/metadata-file.md",
        "content_md": content,
        "tags": ["Spec"],
    }
    create_resp = client.post(f"/api/files/project/{project_id}", json=create_body, headers=HEADERS)
    assert create_resp.status_code == 201
    created = create_resp.json()
    file_id = created["id"]
    assert any(field["key"] == "status" for field in created["metadata_fields"])
    assert created.get("project") is not None
    assert created["project"]["id"] == project_id
    assert created["project"].get("slug")

    files_resp = client.get(f"/api/projects/{project_id}/files", headers=HEADERS)
    assert files_resp.status_code == 200
    files = files_resp.json()
    target = next((row for row in files if row["id"] == file_id), None)
    assert target is not None
    assert target["metadata_signature"]
    status_field = next((field for field in target["metadata_fields"] if field["key"] == "status"), None)
    assert status_field is not None
    assert status_field["value"] == "draft"

    update_body = {
        "title": "Metadata File",
        "path": "docs/metadata-file.md",
        "content_md": created["content_md"],
        "front_matter": {"status": "in-review"},
        "tags": ["Spec", "Review"],
    }
    update_resp = client.put(f"/api/files/{file_id}", json=update_body, headers=HEADERS)
    assert update_resp.status_code == 200
    updated = update_resp.json()
    status_field_after = next((field for field in updated["metadata_fields"] if field["key"] == "status"), None)
    assert status_field_after is not None
    assert status_field_after["value"] == "in-review"
    assert updated.get("project") is not None
    assert updated["project"]["id"] == project_id

    with SessionLocal() as session:
        events = (
            session.query(Event)
            .filter(Event.project_id == project_id, Event.type == "file.updated")
            .order_by(Event.created_at.desc())
            .all()
        )
        assert any(evt.payload.get("file_id") == file_id for evt in events)
        matching = next(evt for evt in events if evt.payload.get("file_id") == file_id)
        assert matching.payload.get("metadata_signature") == updated["metadata_signature"]

    dirs_resp = client.get(f"/api/projects/{project_id}/directories", headers=HEADERS)
    assert dirs_resp.status_code == 200
    directories = dirs_resp.json()
    paths = [item["path"] for item in directories]
    assert "docs" in paths
