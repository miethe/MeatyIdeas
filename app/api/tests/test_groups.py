from fastapi.testclient import TestClient

from app.api.main import app


def _auth_headers():
    return {"X-Token": "devtoken"}


def test_groups_crud_and_assign(tmp_path):
    c = TestClient(app)

    # Create two projects
    r = c.post('/api/projects', headers=_auth_headers(), json={"name": "Alpha", "description": ""})
    assert r.status_code == 201
    p1 = r.json()
    r = c.post('/api/projects', headers=_auth_headers(), json={"name": "Beta", "description": ""})
    assert r.status_code == 201
    p2 = r.json()

    # Create a group
    r = c.post('/api/project-groups', headers=_auth_headers(), json={"name": "Backlog", "color": "#888888"})
    assert r.status_code == 201
    g = r.json()

    # Assign p1 to group
    r = c.post(f"/api/project-groups/{g['id']}/assign", headers=_auth_headers(), json={"project_id": p1['id']})
    assert r.status_code == 204

    # Assign p2 to group
    r = c.post(f"/api/project-groups/{g['id']}/assign", headers=_auth_headers(), json={"project_id": p2['id']})
    assert r.status_code == 204

    # List groups and check projects
    r = c.get('/api/project-groups', headers=_auth_headers())
    assert r.status_code == 200
    groups = r.json()
    assert len(groups) >= 1
    match = [row for row in groups if row['id'] == g['id']][0]
    ids = [p['id'] for p in match['projects']]
    assert p1['id'] in ids and p2['id'] in ids

    # Unassign one
    r = c.delete(f"/api/project-groups/assign/{p1['id']}", headers=_auth_headers())
    assert r.status_code == 204

    r = c.get('/api/project-groups', headers=_auth_headers())
    groups = r.json()
    match = [row for row in groups if row['id'] == g['id']][0]
    ids = [p['id'] for p in match['projects']]
    assert p1['id'] not in ids and p2['id'] in ids

