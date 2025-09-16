# Dashboard Groups

Organize your projects into groups on the dashboard.

- Enable with `GROUPS_UI=1` (on by default in example env).
- Create groups with the New Group button.
- Drag-and-drop projects between columns to assign.
- Use the project card menu to move or remove from a group.
- Order within a group persists based on assignment.

API endpoints:
- `GET /api/project-groups` — list groups with projects
- `POST /api/project-groups` — create { name, color? }
- `PATCH /api/project-groups/{id}` — update { name?, color?, sort_order? }
- `DELETE /api/project-groups/{id}` — delete group
- `POST /api/project-groups/{id}/assign` — { project_id, position? }
- `DELETE /api/project-groups/assign/{project_id}` — unassign project
