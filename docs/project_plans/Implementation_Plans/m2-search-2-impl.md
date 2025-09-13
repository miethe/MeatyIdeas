---
title: "M2 — Search 2.0 Implementation Plan"
owner: Lead Architect/PM
status: Ready for Development
date: 2025-09-11
---

Overview

Search 2.0 upgrades our existing FTS search with filters, snippets, saved searches, and admin indexing controls, following the PRD and gap analysis. This plan defines the precise backend, frontend, CLI, and testing work to fully deliver the scope with robust documentation and acceptance criteria.

Goals & Acceptance

- Filters: project, tag, status; typed filters in command palette (e.g., tag:infra status:draft project:my-proj).
- Results: highlighted snippets and deterministic sort; controllable sort modes.
- Saved Searches: create/list/delete; callable from UI and CLI.
- Indexing: incremental on file changes (existing) + admin rebuild endpoint + background job; no regressions to latency.
- Performance: p95 ≤ 200 ms @ 10k files on the FTS path.
- Documentation and tests complete (user + developer), with traceability to requirements.

Current State (Reference)

- Backend
  - FTS index: `search_index(file_id UNINDEXED, content_text)` created at startup.
    - app/api/db.py:1
  - Indexer util + usage in file create/update/delete.
    - app/api/search.py:1
    - app/api/routers/files.py:1
  - Search route returns `{file_id,title,path,project_id,snippet,score}` with basic filters and bm25 ordering.
    - app/api/routers/search.py:1
- Frontend
  - Command palette queries `/api/search?q=...&limit=10` and navigates to file on select.
    - app/frontend/components/search-command.tsx:1
- Tests
  - Basic search smoke test present.
    - app/api/tests/test_search.py:1

Scope (In/Out)

- In scope
  - Backend: enrich search query (snippets, filters, sort), facet metadata, saved searches CRUD, rebuild endpoint + background indexing job, typed filters parsing server-side.
  - Frontend: command palette typed filters with inline chips + snippets; saved searches UI (save current, list, delete).
  - CLI: search with filters; saved searches list/create/delete.
  - Tests: unit + API contract + FE component tests for palette; performance smoke.
  - Docs: user docs (Searching), developer docs (Search architecture), updates to API reference and traceability.
- Out of scope
  - Full semantic/vector search (implement scaffolding/flag only).
  - Multi-user identity model (saved searches keyed to a simple owner token string for now).

Design & Architecture

- Data Model
  - Keep SQLite primary store; retain `files.tags` JSON array and `projects.status` enum.
  - `search_index` evolution (FTS5): move to multi-column for better ranking and snippets.
    - Columns: `file_id UNINDEXED`, `title`, `body`, `path` (optional for phrase matches and future filters).
    - Weights: favor title > body (bm25 weights, e.g., `bm25(search_index, 5.0, 1.0, 0.5)`).
    - Migration approach (SQLite/FTS): rebuild table via admin job; no in-place ALTER. Old table dropped after successful rebuild.
  - `saved_searches` (new SQLAlchemy model):
    - Fields: `id (uuid)`, `name (str)`, `owner (str nullable)`, `query (str)`, `filters (JSON: {project_id, tag[], status, sort})`, `created_at (datetime)`.
    - Owner default: `"default"` (until user accounts exist). Store token hash optionally in future.
  - Optional `embeddings` (scaffold only, behind `SEMANTIC_SEARCH=1` flag): `file_id`, `chunk_ix`, `vector` (implementation later; not required this milestone).

- API Endpoints
  - `GET /api/search` (enhanced)
    - Params: `q` (string), `project_id` (string, optional), `tag` (string, optional; typed filter supports multiple via repeated param `tag=`), `status` (enum), `limit` (int, default 20), `offset` (int, default 0), `sort` (score|updated_at, default `score`).
    - Response: list of `{file_id, title, path, project_id, snippet, score, highlights?: string[], facets?: { tags: [{name,count}], status: [{name,count}] }}`.
    - Implementation:
      - Use FTS `MATCH` with `snippet(search_index, col_ix, prefix, suffix, ellipsis, tokens)`; wrap matches in markers safe for UI (e.g., `"[" "]"`).
      - Filters combine with AND. Tag filter: prefer JSON1 `EXISTS (SELECT 1 FROM json_each(f.tags) je WHERE je.value = :tag)`; accept LIKE fallback if JSON1 unavailable.
      - Sort: `ORDER BY (CASE WHEN :sort='updated_at' THEN NULL ELSE score END) ASC, f.updated_at DESC` or build separate SQL branches.
      - Facets: compute for result set limited to `q` + `project_id` + `status` filters; return counts of tags and statuses using `json_each(f.tags)` and `COUNT` grouped by value/status.
  - `POST /api/search/index/rebuild` (admin)
    - Enqueues a background job to: snapshot `files` → drop/create new FTS table → stream reindex (batching) → swap (or simply drop old and recreate since we’re single-node/local).
    - Returns `{ job_id }`. Progress via existing jobs API.
  - `GET /api/search/saved`
    - Returns saved searches for current owner: `[{id,name,query,filters,created_at}]`.
  - `POST /api/search/saved`
    - Body: `{ name, query, filters }`. Creates a saved search for owner.
  - `DELETE /api/search/saved/{id}`
    - Deletes a saved search owned by requester.

- Services & Jobs
  - Search service module encapsulating SQL snippets and facet builders (keeps router thin).
  - Background job `search_reindex_all`: reads all files in pages to avoid large transactions; reuses existing `index_file` logic but for new multi-col schema; emits progress events (optional) via SSE publisher.

- Typed Filters Grammar (frontend + backend)
  - Supported tokens in free-text input: `project:<slug|name>`, `tag:<name>` (multiple), `status:<idea|discovery|draft|live>`, `sort:<score|updated>`.
  - Parser: simple regex tokenization; pass parsed tokens as query params to API; remaining text remains `q`.

- Feature Flags & Settings
  - `SEMANTIC_SEARCH=0|1` (off by default). If on, return stub field `{ mode: 'fts' | 'semantic' }` and keep API stable.
  - `SEARCH_MAX_LIMIT` setting to cap page size (default 50).

Frontend Implementation

- Command Palette (`app/frontend/components/search-command.tsx`)
  - Add typed filter parsing and chips display beneath input; show active filters and allow quick removal.
  - Render results with title, truncated path, and snippet with highlights. Replace `[` `]` markers with styled spans.
  - Add section “Saved searches” above results; selecting one re-runs with stored query/filters.
  - Allow “Save current search” action (name prompt → POST /api/search/saved).
  - Keyboard shortcuts unchanged (⌘K/CTRL+K/`/`).
  - Handle loading and empty states; preserve last query on reopen (session storage).

- Project Page (optional quality-of-life)
  - Show a small search field with typed filters + chips; reuses same parser; anchors the command palette approach for discoverability.

CLI Implementation (`app/cli/__main__.py:1`)

- `search` command supports flags: `--project <slug>`, `--tag <tag>` multiple, `--status <enum>`, `--sort <score|updated>`, `--limit`, `--offset`.
- `search-saved` subcommands:
  - `list`: print id, name.
  - `create --name <n> --query <q> [--tag ...] [--project <slug>] [--status <s>]`.
  - `delete <id>`.

DB & Migrations Plan (SQLite-focused)

- Add `saved_searches` table via `Base.metadata.create_all`.
- Rebuild `search_index` to new schema on demand via job; continue to index via old single-column until rebuild is executed to avoid downtime.
- Update `index_file` to insert into multi-column FTS when present (feature-detect table schema on startup and branch logic accordingly).

Testing Plan

- Unit
  - Search service: SQL builder for filters, ordering, and facets with multiple tags and statuses.
  - Typed filter parser: token and remainder extraction; edge cases (quoted values, multiple tags).
  - Saved searches validation: CRUD happy path and permission scoping by owner.
- API Contract (pytest + httpx)
  - `GET /api/search` returns snippet + correct ordering; filters combine; facets counts correct.
  - `POST /api/search/index/rebuild` enqueues and completes; reindex yields equivalent or better results.
  - Saved searches GET/POST/DELETE work; list reflects created items.
- Frontend
  - Component tests for command palette: typed filter chips render/remove; snippet highlight markup safe; saved searches list appears.
- Performance
  - Seed 10k small docs; measure p95 of `/api/search` under FTS path ≤ 200 ms (document process in dev docs; automated smoke optional).

Documentation Deliverables

- User Docs
  - `docs/user/searching.md`: typed filters grammar, saving searches, keyboard shortcuts, examples.
- Developer Docs
  - `docs/architecture/search.md`: FTS schema, ranking, facets SQL, rebuild job, indexer lifecycle, flags, limits.
  - API reference updates for new routes and enhanced search response.
  - Update `docs/traceability.md` to map EPIC B → implementation + tests.

Security & Reliability

- Auth: maintain token header guard; for rebuild job, require the same token (admin assumed in local model).
- Input validation: normalize `limit` with upper bound (`SEARCH_MAX_LIMIT`); sanitize `q` length; reject unknown `sort`.
- Robustness: facet queries must tolerate files without tags; LIKE fallback when JSON1 functions unavailable.

Rollout & Backward Compatibility

- Phase 1: Land saved searches + enhanced API (without switching to multi-col FTS); FE/CLI consume API.
- Phase 2: Ship rebuild job and migrate to multi-col FTS. Validate parity; toggle FE/CLI sort by `score` default.
- Phase 3: Optional enable `SEMANTIC_SEARCH` flag scaffold; no UI change.

Risks & Mitigations

- FTS rebuild downtime: isolate via job; reindex quickly with batched inserts; gate drop/create with try/catch and snapshot data first.
- JSON1 availability: detect at startup; switch to LIKE fallback for tag filters; document tradeoffs.
- Ranking surprises: expose `sort` param; keep default stable across versions.

Task Breakdown (Trackable)

1. Backend — Saved searches model + CRUD
2. Backend — Enhance `/search` with sort and facets
3. Backend — Rebuild endpoint + job for reindex
4. Backend — Indexer compatibility for multi-col FTS
5. Frontend — Command palette typed filters + chips + snippets
6. Frontend — Saved searches UI (list/save/delete)
7. CLI — Filters + saved searches subcommands
8. Tests — Unit/API/FE + performance smoke
9. Docs — User + Developer + Traceability updates

Acceptance Checklist

- Query `deployment tag:infra` returns filtered, highlighted results ordered by score; chips reflect filters.
- Saved search “Infra Deploys” appears in palette and runs the stored query.
- Rebuild endpoint completes; search continues to function; results parity verified post-migration.
- p95 latency ≤ 200 ms @ 10k docs on FTS path (documented procedure and results).

Appendix — Example Requests

- `GET /api/search?q=onboarding%20status:draft&limit=10&offset=0&sort=updated`
- `POST /api/search/saved {"name":"Infra Deploys","query":"deploy tag:infra","filters":{"status":"live"}}`
- `POST /api/search/index/rebuild`

