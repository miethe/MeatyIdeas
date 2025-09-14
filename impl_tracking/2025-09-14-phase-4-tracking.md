# Phase 4 — Import/Export & Share Links — Implementation Tracking (2025-09-14)

Status: In progress

## Tasks

- Backend: ShareLink model and migrations (create_all)
- Backend: Worker jobs — import_zip, import_files, import_json, import_git, export_zip, export_json
- Backend: API endpoints — POST /api/projects/import, POST /api/projects/{id}/export, GET /api/jobs/{id} (exists), share-links CRUD, public share routes
- Backend: Result download route and safe path handling
- Backend: SSE events for import/export job lifecycle
- Frontend: Results Modal — selection + “Export selected” action with progress and download
- Frontend: Project page — “Import” flow (zip/files/json/git) with progress
- Frontend: Project page — Share Links dialog (create/list/revoke/copy)
- Frontend: Public Share view page (read-only)
- Validation: Manual checks for acceptance criteria (jobs work, progress visible, share link read-only + expiry/revoke)

## Notes

- Follow PRD and implementation plan Phase 4 sections.
- Use Redis/RQ queue already present; publish events on `events:{project_id}`.
- Store exports under project dir `exports/` with predictable filenames; return download URL.
- Token format: 32-char URL-safe random (≥128-bit); enforce uniqueness.
- Rate-limit public share routes (basic Redis counter, IP-based) to mitigate abuse.

## Progress Log

- [x] Added tracking file and outlined tasks
- [x] Add ShareLink model to `app/api/models.py`
- [x] Add Pydantic schemas for import/export and share links
- [x] Implement worker job functions for import/export
- [x] Implement API routes for import/export enqueue + result download
- [x] Implement share-links CRUD and public routes
- [x] Wire SSE events for job lifecycle
- [x] FE: Results modal export selected
- [x] FE: Project Import dialog
- [x] FE: Share Links dialog
- [x] FE: Public share view page
- [ ] Validate acceptance criteria
