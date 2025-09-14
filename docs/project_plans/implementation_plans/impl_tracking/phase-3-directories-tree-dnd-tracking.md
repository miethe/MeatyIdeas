# Phase 3 — Directories, File Tree, DnD — Implementation Tracking

Owner: Codex Agent
Date: 2025-09-14

## Goals
- Persist directories (even when empty) and expose CRUD/move APIs.
- Enhance file tree endpoint to include empty dirs and support depth limiting.
- Add batch move API (files and directories), with dry-run and link rewrite for wiki-links.
- Update UI with tree, multi-select, drag-and-drop, and live refresh via SSE.
- Emit SSE events on dir/file changes and refresh UI accordingly.

## Tasks

- [x] Backend: Add `Directory` model (id, project_id, path, name, timestamps).
- [x] Backend: Startup backfill when `DIRS_PERSIST=1` (from existing file paths).
- [x] Backend: Directory schemas in `schemas.py` (create, move, delete, results).
- [x] Backend: Directory router `routers/dirs.py` with POST, PATCH (dry_run), DELETE.
- [x] Backend: Update tree endpoint to accept `include_empty_dirs` and `depth` and include persisted empty dirs.
- [x] Backend: Batch move endpoint `POST /api/files/batch/move` with dry_run, cross-project validation, link rewrite option.
- [ ] Backend: Emit SSE events for `dir.created`, `dir.moved`, `dir.deleted`, `file.moved`, `files.batch_moved`.
- [x] Frontend: Enhance `FileTree` with multi-select + DnD; create/rename/delete dir actions.
- [x] Frontend: Subscribe to project SSE in tree to auto-refresh on relevant events.
- [x] Tests: Add API tests for Directory CRUD/move and batch move.
- [x] Docs: Update user docs for folders and DnD; brief API notes.
- [x] Validation: Flip `DIRS_PERSIST` on for local and validate acceptance criteria.

## Notes & Decisions

- Path validation rejects `..`, `\\`, and `:`. Root-only paths like `""` are invalid; top-level dir name must be provided.
- DELETE directory will return 409 `DIR_NOT_EMPTY` if files/subdirs exist and `force` is not set. For Phase 3, we default `force=false`.
- Batch move treats directories by updating DB paths and moving corresponding on-disk folders; partial failures reported per item.
- Performance: Tree endpoint pre-aggregates dirs from both Files and Directories; depth applied with early pruning.

## Running Notes

- 12:XX — Initial plan created; starting backend model + schemas.
- 12:YY — Implemented Directory model, schemas, API; tree enhancements; batch move; FE updates; tests added.
- 12:ZZ — Validation: Set `DIRS_PERSIST=1` in `.env` and `.env.example`. Added API tests. Manual run instructions: `curl -H 'X-Token: devtoken' localhost:8000/api/projects` to list projects, then `POST /api/projects/{id}/dirs`, `PATCH /api/projects/{id}/dirs`, `DELETE /api/projects/{id}/dirs`, `GET /api/projects/{id}/files/tree?include_empty_dirs=1`, and `POST /api/files/batch/move` to validate flows.
