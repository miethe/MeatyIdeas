Implementation Plan — MVP (Aligned to PRD)

Objectives

- Ship a Docker Compose runnable MVP that meets PRD §23 DoD and §17 acceptance.
- Optimize for TTFD < 60s via seed and simple token auth.

Scope (MVP)

- Backend: FastAPI, SQLite + FTS5, RQ/Redis worker, Git ops, Bundle export, token auth, OpenAPI at `/api/docs`.
- Frontend: Next.js (App Router) with basic screens (list Projects, open File placeholder; editor/preview to follow).
- CLI: Typer wrapper for common flows (`new`, `add`, `search`, `artifacts connect`, `bundle create`).
- Packaging: Compose file, proxy, seed, OTel stub, docs.

Architecture (current state)

- API service: Uvicorn serves under `/api` with routers: `projects`, `files`, `search`, `artifacts`, `bundles`.
- DB: SQLite at `${DATA_DIR}/app.sqlite3`; `search_index` FTS5 virtual table.
- Worker: RQ connected to `redis://redis:6379/0`; jobs for basic git and bundle operations.
- Storage layout: `/data/projects/<slug>/{project.json, files/**, artifacts/, bundles/}`.
- Auth: X-Token header equals `${TOKEN}` (default `devtoken`).

Phased Delivery Plan

Phase 1 — Backend core (done)

- Projects/Files CRUD, on-disk writes, FTS index updates.
- Search endpoint using FTS5 MATCH.
- Artifacts connect/init and commit/push (no-op if no remote).
- Bundle export `.zip` with `bundle.yaml` manifest.
- Seed demo project with two files.

Phase 2 — Frontend baseline (in progress)

- Project list view backed by API.
- Simple file viewer stub (detail route) while editor pipeline is prepared.
- Wire env to proxy (`NEXT_PUBLIC_API_BASE`).

Phase 3 — Editor & Preview (next)

- CodeMirror Markdown editor with split preview.
- Client-side render pipeline: GFM, Mermaid, KaTeX, code highlight (shiki/prism).
- Keyboard shortcuts: ⌘S, ⌘K, P, N.

Phase 4 — Artifacts Panel & Export Modal

- UI to connect repo, show status, stage paths, commit message template.
- Bundle picker (by file/tag) and export zip.

Phase 5 — Tests, Linting, CI

- API happy-path tests and schema validation for bundle.yaml.
- Ruff/Black/mypy; ESLint/Prettier.
- Optional: GitHub Actions workflow.

Acceptance Criteria Mapping

- PRJ-001: POST /projects 201; duplicate name → 409 — implemented.
- DOC-001: PUT /files roundtrip and render cache — API implemented; client preview pending.
- SRCH-001: GET /search returns ranked ids — implemented (basic rank).
- GIT-001: Artifacts connect and status — connect implemented; UI pending.
- GIT-002: Commit & push — implemented; push no-op if no remote.
- BND-001: Bundle zip + manifest — implemented.
- API-001: Token auth and typed errors — implemented.
- CLI-001: Commands succeed — implemented basic commands.

Backlog (MVP polish)

- Improve FTS ranking (boost headings vs body, recency tie-breaker).
- Add semantic commit templates: `docs: add <title>` / `docs: update <title>`.
- Error model responses harmonized across routers.
- OpenAPI metadata enrich and tag descriptions.
- Worker-offloaded long ops (clone/push) from API path (enqueue via RQ).

Risks & Mitigations

- Git submodule complexity: currently local repo; add submodule attach flow and docs if needed.
- Markdown render perf: cache `rendered_html` (already modeled) and invalidate on save.
- Path safety: `safe_join` guards traversal; keep using for all disk writes.
- Single-user token: acceptable for MVP; document clearly; no sensitive data.

Runbook

- Start: `docker compose up --build` from `MeatyProjects/`.
- Token: use `X-Token: ${TOKEN}` for all requests.
- Seed: automatic with `SEED_DEMO=1`; manual via `docker compose exec api python -m api.seed`.

Key Paths (corrected)

- CLI entry: `MeatyProjects/app/cli/__main__.py` (use `python -m cli`).
- API entry: `MeatyProjects/app/api/api/main.py`.
- Frontend app: `MeatyProjects/app/frontend/app`.
- Bundle export: `MeatyProjects/app/api/api/bundle.py`.

Next Actions (for engineering)

- Implement frontend editor + preview pipeline per PRD §9 (Phase 3).
- Add minimal artifacts panel and export modal (Phase 4).
- Add pytest happy-paths and schema validation (Phase 5).

Decision Log

- Artifacts default to local repo init; submodule support deferred (PRD §21 default acceptable).
- Bundle excludes artifacts content; includes pointer only (PRD §21).

