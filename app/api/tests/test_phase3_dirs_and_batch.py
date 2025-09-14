from __future__ import annotations

from fastapi.testclient import TestClient

from api.main import app
from api.seed import ensure_seed


def _auth():
    return {"X-Token": "devtoken"}


def test_directories_crud_and_tree_inclusion():
    ensure_seed()
    c = TestClient(app)
    # Find project id
    pr = c.get("/api/projects", headers=_auth())
    assert pr.status_code == 200
    pid = pr.json()[0]["id"]

    # Create directory
    r = c.post(f"/api/projects/{pid}/dirs", json={"path": "docs"}, headers=_auth())
    assert r.status_code in (200, 201)
    # Tree should include empty dir when requested
    t = c.get(f"/api/projects/{pid}/files/tree", params={"include_empty_dirs": 1}, headers=_auth())
    assert t.status_code == 200
    tree = t.json()
    paths = set()
    def collect(nodes):
        for n in nodes:
            paths.add(n["path"]) if n["type"] == "dir" else None
            if n.get("children"): collect(n["children"])
    collect(tree)
    assert "docs" in paths

    # Move directory dry-run
    r = c.patch(f"/api/projects/{pid}/dirs", json={"old_path": "docs", "new_path": "notes", "dry_run": True}, headers=_auth())
    assert r.status_code == 200
    dr = r.json()
    assert dr["applied"] is False
    assert dr["dirs_count"] >= 1

    # Apply move
    r = c.patch(f"/api/projects/{pid}/dirs", json={"old_path": "docs", "new_path": "notes"}, headers=_auth())
    assert r.status_code == 200
    ar = r.json()
    assert ar["applied"] is True

    # Delete (should succeed since empty)
    r = c.delete(f"/api/projects/{pid}/dirs", json={"path": "notes"}, headers=_auth())
    assert r.status_code == 200
    assert r.json()["deleted"] is True


def test_batch_move_file_dryrun_and_apply():
    ensure_seed()
    c = TestClient(app)
    # Get project and a file
    pr = c.get("/api/projects", headers=_auth())
    assert pr.status_code == 200
    pid = pr.json()[0]["id"]
    fs = c.get(f"/api/projects/{pid}/files", headers=_auth())
    assert fs.status_code == 200
    first = fs.json()[0]
    fid = first["id"]

    # Dry run
    r = c.post("/api/files/batch/move", json={"files": [{"file_id": fid, "new_path": "moved/one.md"}], "dry_run": True}, headers=_auth())
    assert r.status_code == 200
    dr = r.json()
    assert dr["applied"] is False
    assert dr["files_count"] == 1

    # Apply
    r = c.post("/api/files/batch/move", json={"files": [{"file_id": fid, "new_path": "moved/one.md"}]}, headers=_auth())
    assert r.status_code == 200
    ar = r.json()
    assert ar["applied"] is True
    # Verify file path updated
    f = c.get(f"/api/files/{fid}", headers=_auth())
    assert f.status_code == 200
    assert f.json()["path"].startswith("moved/")

