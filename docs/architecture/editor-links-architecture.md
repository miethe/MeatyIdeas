# Editor & Links Architecture

Overview
- Files are stored in the `files` table and on disk under `<data_dir>/projects/<slug>/files/<path>`.
- Wiki-links use the `[[Title]]` syntax. On save, we extract outgoing links and store them in the `links` table with `target_title` and an optional `target_file_id` when resolved.
- Backlinks are computed by querying `links` for rows that point to a given file or its title when unresolved.

Rendering & Indexing
- Server uses MarkdownIt for rendering (GFM-like features enabled for tables and strikethrough). Mermaid/KaTeX are enhanced client-side.
- On create/update/move/rename, we reindex the full `title + content_md` into the FTS table.

Move/Rename Flow
1. Client calls `POST /files/{id}/move` with `new_path` and optional `new_title`, with `dry_run=true` to preview.
2. Server computes impact: whether a path move happens and which files reference `[[OldTitle]]`.
3. On apply, server moves the on-disk file (or writes content if missing), updates the record, re-renders, reindexes, and refreshes outgoing links for the source.
4. If `new_title` and `update_links=true`, the server rewrites `[[OldTitle]]` to `[[NewTitle]]` in impacted files, re-renders, reindexes, and refreshes their outgoing links.

File Tree API
- `GET /projects/{id}/files/tree` constructs a nested hierarchy from DB paths, sorted dirs-first.

Security & Constraints
- Path operations are constrained to the project `files/` directory via `safe_join`. Path traversal and absolute paths are rejected.
- Attachments are sanitized and stored under `artifacts/assets/`.

