# Files & Directories

Phase 3 introduces persisted directories, a richer file tree, and drag-and-drop.

- Create folder: POST `/api/projects/{id}/dirs` with `{ "path": "folder/sub" }`.
- Rename/move folder: PATCH `/api/projects/{id}/dirs` with `{ "old_path": "folder", "new_path": "new/folder" }`. Add `dry_run: true` to preview.
- Delete folder: DELETE `/api/projects/{id}/dirs` with `{ "path": "folder" }`. Returns 409 if not empty (unless `force: true`).
- Tree: GET `/api/projects/{id}/files/tree?include_empty_dirs=1&depth=2` returns directories (even empty) and files. Depth limits nesting.
- Batch move: POST `/api/files/batch/move` with files and/or dirs. Supports `dry_run` and `update_links` for wiki-links.

UI
- File tree now supports expand/collapse, multi-select (Cmd/Ctrl/Shift), drag files into folders, and basic folder actions (create/rename/delete).
- Tree auto-refreshes within ~300 ms via server-sent events on folder/file updates.

Notes
- Paths cannot include `..`, `\\`, or `:` and must be relative to project root.
- Directory persistence is gated by `DIRS_PERSIST` feature flag.
