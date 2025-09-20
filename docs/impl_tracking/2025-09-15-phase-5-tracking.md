# Phase 5 — Dashboard Groups — Implementation Tracking (2025-09-15)

Status: In progress

## Tasks

- DB: Add `ProjectGroup` and `ProjectGroupMembership` models (create_all)
- API: CRUD for `/api/project-groups` and assignment endpoint
- API: Unassign endpoint for removing a project from any group
- FE: Homepage groups UI (flagged by `GROUPS_UI`)
- FE: Drag-and-drop between groups; kebab menu move/remove
- FE: Create/Rename/Delete groups; color chip UI
- Validation: Ensure acceptance criteria (CRUD, drag, persisted ordering)
- Docs: Brief usage notes for groups

## Notes

- Ordering persists via `sort_order` on groups and memberships.
- Assign endpoint appends by default; optional `position` allows precise placement.
- Ungrouped projects derive from projects not in memberships; rendered in a dedicated column in UI.

## Progress Log

- [x] Created tracking file and outlined tasks
- [x] DB models added
- [x] API routes implemented and wired
- [x] Frontend groups UI implemented
- [ ] Validation completed against acceptance criteria
- [x] Docs updated (brief)
