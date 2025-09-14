# Implementation Plan — Milestone M1: Editor & Links Polish

Owner: Lead Architect/PM  
Status: Ready for development  
Timebox: 1 sprint (5–7 working days)

## 1) Scope & Acceptance

In scope for M1 per PRD and State/Gaps analysis:
- File tree: API + UI to browse project files hierarchically.
- Move/Rename: Endpoint + UI to move/rename files; update on-disk path; keep search index consistent; optionally rewrite wiki-links in impacted files with preview (dry-run).
- Links integrity: List outgoing links for a file with resolution status; backlinks visible in Editor; unresolved links affordances.
- Attachments UX: Solid upload affordances in Editor; inline images render.

Acceptance (must pass):
- Editor: Rename/move updates links; attachments render; backlinks visible.  
- API: `GET /projects/{id}/files/tree` returns hierarchy; `POST /files/{id}/move` supports `dry_run` + `update_links`; `GET /files/{id}/links` lists outgoing links with `resolved` flag.  
- UI: File tree navigates/renames/moves; Editor shows outgoing links and backlinks; upload inserts `![alt](/artifacts/assets/...)`.

Out of scope (deferred to later milestones): Advanced search facets/saved searches (M2), bundle/PR polish (M3), Alembic/OTel/rate limits (M4), CLI (M5).

## 2) Current State Summary

Back end
- Files CRUD via `app/api/routers/files.py`; markdown render via `app/api/routers/render.py` using MarkdownIt (Mermaid/KaTeX on client); links extracted on save in `app/api/links.py`; backlinks endpoint exists (`GET /files/{id}/backlinks`).
- Attachments endpoint `POST /projects/{project_id}/attachments/upload` saves to `<project>/artifacts/assets` with sanitization.

Front end
- Editor route `app/frontend/app/projects/[project]/edit/[file]/page.tsx` with RichEditor component `components/editor/rich-editor.tsx` (two toolbars, save/cancel, upload, wiki-link, preview, backlinks section).
- MarkdownViewer enhances Mermaid on client; Modal viewer exposes “Open in Editor”.

Gaps (M1)
- No file tree endpoint/UI; move/rename lacks dedicated endpoint/UX and safe on-disk move (we currently overwrite new path but may orphan the old path).  
- No outgoing links endpoint; Editor backlinks are read-only, and links panel is missing.  
- Rename link rewrite exists (best-effort) but lacks dry-run/preview and isn’t exposed via a dedicated move/rename API.

## 3) Design Overview

Guiding principles
- Keep routers thin; concentrate link and move logic in focused helpers now (services-lite), paving the road for a fuller services layer later without a broad refactor.
- Favor idempotent, explicit APIs with dry-run paths for destructive changes.
- Preserve on-disk and DB consistency: move/rename must update disk, DB, search index, and links table.

Data model
- No new tables in M1. Continue using `links` for outgoing references. Future: add DB indices via Alembic in M4.

## 4) API Changes (spec-first)

New: File tree
- `GET /api/projects/{project_id}/files/tree`
  - Returns a nested hierarchy derived from DB `files.path` split by `/`.
  - Response node shape:
    ```json
    {
      "name": "notes",
      "path": "notes",
      "type": "dir",
      "children": [ { ... } ]
    }
    ```
    For file leaf:
    ```json
    {
      "name": "spec.md",
      "path": "notes/spec.md",
      "type": "file",
      "file_id": "uuid",
      "title": "Spec"
    }
    ```
  - Sorted: dirs first (alpha), then files (alpha).

New: Outgoing links for a file
- `GET /api/files/{file_id}/links`
  - Returns list of `{ target_title, target_file_id, resolved: boolean }` for `src_file_id=file_id`.

New: Move/Rename with dry-run and link rewrite
- `POST /api/files/{file_id}/move`
  - Request body:
    ```json
    {
      "new_path": "docs/specs/spec.md",
      "new_title": "Spec",         // optional; when changing title
      "update_links": true,          // default true; apply rewrite to other files
      "dry_run": true                // if true, return impact without applying
    }
    ```
  - Behavior:
    - If `new_path` differs: move on disk (create dirs) and remove old path; update `files.path`; reindex search; update `links.src_path` via `upsert_links` for the moved file.
    - If `new_title` differs and `update_links=true`: find files containing `[[old_title]]` and rewrite to `[[new_title]]`; update `links` table accordingly.
    - When `dry_run=true`: compute and return impacted file ids/titles and counts; do not mutate.
  - Response (dry-run):
    ```json
    {
      "will_move": true,
      "old_path": "notes/old.md",
      "new_path": "docs/specs/spec.md",
      "title_change": { "from": "Old", "to": "Spec" },
      "files_to_rewrite": [ { "id": "uuid", "title": "A" }, { "id": "uuid", "title": "B" } ],
      "rewrite_count": 2
    }
    ```
  - Response (applied): same shape with `applied: true` and `file: FileRead`.
  - Errors: `NOT_FOUND`, `BAD_PATH` (unsafe traversal), `CONFLICT` (target path exists unless `overwrite` later), `VALIDATION`.

Updates to existing
- `PUT /api/files/{id}`: if `path` changed, remove old on-disk file after writing new path; maintain existing `rewrite_links` support. Return FileRead.

Non-goals in M1
- No pagination/ETags for these endpoints (M4). No Alembic migrations (M4).

## 5) Backend Implementation Plan

Routers
- Add endpoints in `app/api/routers/files.py`:
  - `get_file_links(file_id)` → outgoing links list (query `Link` by `src_file_id`).
  - `move_file(file_id)` → implement request/response per spec, calls helpers.
- Add `projects.get_files_tree(project_id)` in `app/api/routers/projects.py` building a nested structure from `Project.files`.

Helpers (services-lite)
- New module `app/api/services/files_ops.py`:
  - `compute_move_impact(db, file: File, new_title: str | None) -> list[File]` collects files requiring rewrite for `[[old_title]]`.
  - `apply_move(db, file: File, new_path: str | None, new_title: str | None, update_links: bool) -> (File, int)` moves on disk, updates DB, reindexes, rewrites links when requested; returns changed file count.
- Extend `app/api/links.py` with:
  - `list_outgoing_links(db, file_id: str)` → rows with resolution flag.
  - Keep `upsert_links`, `rewrite_wikilinks` for reuse.

On-disk safety
- Use existing `safe_join` and `settings.data_dir` with project slug to compute absolute paths.
- Ensure parents exist with `os.makedirs(dir, exist_ok=True)`.
- When moving: `shutil.move(old_abs, new_abs)` if file exists; after DB update, if old file existed but `shutil` path differed, remove leftover; tolerate missing old file.

Index and links
- After any content or path change: reindex via `app/api/search.py:index_file` (already used). Re-run `upsert_links` for the moved file to update `src_path` in `links`.

Validation & errors
- Validate `new_path` for traversal (`..`), absolute paths, illegal characters. Return typed error payloads consistently with current pattern (`{"code":"..."}`).

Telemetry
- Log `files.move.{dry_run|applied}` with counts; keep structured JSON logs via existing logger.

## 6) Frontend Implementation Plan

File tree UI
- New component `app/frontend/components/files/file-tree.tsx`:
  - Fetch `GET /projects/{id}/files/tree` on mount.
  - Render nested tree: directories collapsible; files clickable to open Modal or Editor. Keyboard navigation friendly.
  - Context actions: Rename/Move → opens modal; New file here → opens create dialog with prefilled path prefix.
- Integrate on Project page `app/frontend/app/projects/[project]/page.tsx`: show the tree in a left column or a sheet. Lightweight for M1: collapsible card above the files grid.

Move/Rename modal
- New `components/files/file-move-dialog.tsx`:
  - Inputs: new path, new title, checkboxes `update links` and `dry run`.
  - On dry-run → call API and list impact (`rewrite_count`, files list). On apply → call without dry-run and toast results; invalidate `files` query.

Editor polish
- RichEditor enhancements in `components/editor/rich-editor.tsx`:
  - Outgoing links panel: fetch `GET /files/{id}/links`; show counts and resolution chips; click unresolved → offer “Create file” prefilled with title.
  - Backlinks section: make items clickable to open in modal or navigate to Editor route.
  - Upload CTA remains (already implemented) inserting `![asset](/artifacts/assets/...)` after successful upload.
  - Optional: “/” slash trigger to open Insert menu; non-blocking for M1, keep behind a small flag.

Navigation fixes
- Ensure backlinks click opens `projects/[project]/edit/[file_id]` using known `projectId` from page.

Toasts & error states
- Use `sonner` for success/failure; display `rewrite_count` and `files affected` in success copy after move.

## 7) Security & Robustness
- Path sanitization on move: deny absolute paths, `..`, reserved names; normalize to POSIX separators in API response.
- Attachments already sanitized; keep enforcing existing behavior (non-overwrite with counter suffix).
- Idempotency: repeating the same move should be a no-op and succeed.
- Large projects: File tree build uses in-memory hierarchy from DB rows; acceptable for M1; revisit pagination/streaming later.

## 8) Risks & Mitigations
- Orphaned files on disk when path changes via `PUT /files/{id}`: fix in this milestone (remove old path after writing new path); prefer dedicated move endpoint in UI.
- Rewrite false positives: Only rewrite exact `[[Title]]` tokens; provide dry-run preview listing impacted files; allow opt-out.
- Race conditions on concurrent edits: use last-write-wins for M1; document best practices; consider ETags later (M4).

## 9) Testing Plan (Robust)

Backend (pytest + httpx)
- Links extraction: `extract_wikilinks` returns unique ordered titles; Markdown edge cases (nested brackets ignored).
- Upsert + backlinks: creating A→[[B]] then fetching backlinks of B returns A; unresolved title matches by `target_title`.
- Move dry-run: create A→[[Old]]; dry-run rename Old→New returns A in `files_to_rewrite` and `rewrite_count=1`.
- Move apply: perform move+rename with `update_links=true` and verify A content updated; `links` table updated; on-disk file moved; old path removed.
- File tree: returns expected hierarchy for paths with multiple segments; sorted order verified.
- Attachments: upload returns sanitized path under `/artifacts/assets/*` and does not overwrite existing filenames.

Frontend (React Testing Library + Vitest)
- FileTree renders directories and files; clicking a file triggers onOpen; rename action opens modal and calls dry-run; apply shows toast and refreshes.
- RichEditor: outgoing links panel shows resolved/unresolved counts; clicking unresolved triggers create dialog prefilled with title.
- Backlinks list items are clickable and navigate/open modal.

E2E (Cypress or Playwright, minimal happy path)
- Create project; add files A and B; in A add `[[B]]`; open B in Editor and rename title to C with `Rewrite links` on; verify A updated; upload an image and see it rendered; navigate via backlinks.

CI integration
- Add backend tests to existing test job; run FE component tests headless; include one E2E smoke behind tag `m1`.

## 10) Documentation Plan

User docs (docs/user)
- `docs/user/editor.md`: Editor layout, toolbars, shortcuts (⌘S/N/P), slash insert, attachments, outgoing links panel, backlinks.
- `docs/user/files.md`: File tree navigation, rename/move flow, dry-run preview, link rewrite behavior.

Developer docs (docs/architecture)
- `docs/architecture/editor-links-architecture.md`: Links model, extraction/rewrite rules, move flow swimlane, API specs for tree/move/links, on-disk layout.
- API reference updates in `README.md` or `docs/api.md` for the three endpoints with examples.

Changelog
- Update `docs/roadmap.mdx` checkpoint notes after merge to mark M1 items as complete when shipped.

## 11) Work Items (Checklist)

Backend
- [ ] Add `GET /projects/{id}/files/tree` in `routers/projects.py`.
- [ ] Add `GET /files/{id}/links` and `POST /files/{id}/move` in `routers/files.py`.
- [ ] Add `services/files_ops.py` with `compute_move_impact` and `apply_move`.
- [ ] Extend `links.py` with `list_outgoing_links` helper.
- [ ] Update `PUT /files/{id}` to remove old on-disk path when `path` changed.
- [ ] Unit + API tests.

Frontend
- [ ] Build `components/files/file-tree.tsx` and integrate into `projects/[project]/page.tsx`.
- [ ] Build `components/files/file-move-dialog.tsx` and wire into FileTree + Editor.
- [ ] Enhance `components/editor/rich-editor.tsx` with outgoing links panel and clickable backlinks.
- [ ] Component tests; minimal E2E.

Docs
- [ ] `docs/user/editor.md` and `docs/user/files.md`.
- [ ] `docs/architecture/editor-links-architecture.md`.
- [ ] README/API reference updates.

## 12) Estimation & Sequencing

Day 1–2: Backend endpoints + tests (tree, links, move dry-run/apply).  
Day 3: Update PUT path handling + polish; FE FileTree scaffolding.  
Day 4: Move dialog + dry-run/apply; Editor links panel; clicking backlinks.  
Day 5: Tests (FE + E2E), docs, QA passes; buffer/fixes.

## 13) Developer Notes
- Keep changes minimal and localized; do not refactor unrelated routers.
- Follow existing error payload style: `{ "code": "...", "message": "..." }`.
- Use `settings.token` header checks for new endpoints like others; ensure CORS matches existing config.
- Keep Mermaid/KaTeX rendering client-side; no server-side change for M1.

---

This plan is idempotent and ready for development. It adheres to the PRD acceptance for M1 and lays light groundwork for future refactors without introducing stubs.

