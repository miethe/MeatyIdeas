# MeatyProjects — State & Gaps Analysis (2025-09-11)

Summary: Review of current codebase vs. PRD (enhancement-9-11) and implementation plans. Identifies gaps, partials, and debt with a remediation plan per area.

## Executive Summary

- Core MVP in place: projects/files, editor with preview, backlinks/links extraction, FTS search, bundles export with verify and branch/PR integration, artifacts connect/status/history/commit, SSE events and UI toasts.
- Gaps remain around: editor polish (attachments UX, file tree, move/rename), search 2.0 (facets/saved searches), wizard ergonomics (tags selection), activity surfacing, migrations/tests/telemetry, and a few robustness edges in git ops and SSE UX.
- Recommend 3 short sprints to reach PRD acceptance: M1 Polish Editor & Links; M2 Search 2.0; M3 Hardening/Activity/QA.

## Current Capability Snapshot

- API backend (FastAPI): CRUD for projects/files; FTS5 search with snippets; links extract/backlinks; bundles v2 (job-based export, roles, verify, branch push + PR); artifacts v2 (connect, status, commit/push, history); SSE events endpoint; attachments upload route.
- Worker (RQ): bundle export with roles/checksums + branch push + optional PR; git jobs helpers; SSE event emission.
- Frontend (Next.js): projects page with export wizard and bundles history; artifacts panel (status/history/connect/commit); editor view with split preview and backlinks; modal viewer; command palette; dark theme.
- Infra: Docker Compose with API/FE/worker/Redis/Caddy; token auth; simple settings.

## Gaps by Epic

- Rich Editor & Knowledge Graph
  - Missing: file tree/hierarchy endpoint/UI; move/rename endpoint; slash menu polish; attachments UX (upload integrates, but UI affordances are minimal); link integrity checker and bulk fix on rename; templates list backend.
  - Partial: backlinks implemented; wiki-link extraction works on create/update; render path uses simple MD parser; client renders Mermaid/KaTeX.

- Search 2.0
  - Missing: saved searches model/API/UI; semantic embeddings (flagged); advanced filters UI (tag/status chips, sort); rebuild endpoint; incremental background indexing job (we reindex on save, but no admin rebuild).
  - Partial: FTS with snippets implemented; basic tag/status filters in API query (LIKE fallback for tags); command palette wires to open.

- Bundles v2
  - Partial gaps: wizard lacks tag-based selection and smart role presets; history list lacks delete/cleanup; no UI to open PR link from wizard success; verify is manual in history.
  - Implemented: roles in manifest; checksums; branch push and optional PR with GitHub token; SSE for queued/started/completed/branch_pushed/pr_opened; bundle download and verify endpoints.

- Artifacts v2
  - Missing: surfaced provider name and repo URL in panel header; ahead/behind status degrades on network but no explicit error badges; no retry guidance; no OAuth (deferred in PRD).
  - Implemented: Connect modal (local/github); origin remote attach/update; status/history; commit & push dialog; commit returns sha.

- Activity & Notifications
  - Partial: SSE backend and UI toasts implemented and wired for bundle/commit events; Event persistence exists.
  - Missing: activity feed page/card within project; CLI jobs watch.

- API & CLI Enhancements
  - Missing: `PATCH` endpoints (files/projects) and ETags; pagination envelope; consistent error taxonomy adoption across all routes; CLI parity (login/mv/rm/open/jobs watch, bundle flags); tests.

- Architecture & Platform
  - Partial: events and bundles lightweight migrations at startup; services layer still mixed into routers; Alembic not integrated.
  - Missing: optional Postgres path + pgvector guard; request rate limiting; structured telemetry (OTel) wiring; settings flags.

## Issues and Technical Debt

- Dialog accessibility warnings (resolved): ensure `DialogTitle` and `DialogDescription` present.
- Git status robustness: fetching may throw on first-time remotes; now gracefully degrades, but we should surface typed warnings.
- SSE token: query param token check is permissive if missing; document requirement and consider per-project scoping/permissions later.
- Download auth: handled via header fetch; avoid relying on query tokens for protected routes.
- Migrations: ad-hoc migrations for bundles; Alembic migration baseline recommended.
- Tests: missing unit/integration tests for services, routers, and worker flows.

## Remediation Plan (Recommended)

- M1 — Editor & Links Polish (1 sprint)
  - Add file tree endpoint (`GET /projects/{id}/files/tree`) and UI tree; Implement move endpoint (`POST /files/{id}/move`) with link updates/dry-run; expose attachments UI affordances; add link integrity check API (`GET /files/{id}/links`), bulk fix.
  - Services layer for files/links; unit tests for link extraction and move.

- M2 — Search 2.0 (1 sprint)
  - Saved searches table + APIs (`GET/POST /search/saved`); UI for chips + filters; add rebuild endpoint (`POST /search/index/rebuild`); background indexer job for incremental changes.
  - Optional semantic flag scaffolding; stub embeddings job (behind flag).

- M3 — Bundles/Artifacts UX & Activity (0.5–1 sprint)
  - Wizard enhancements: tag-based selection and preset roles; success toast includes branch/PR actions; bundle cleanup/delete endpoint and UI.
  - Artifacts: show provider/repo URL, add warning badge on degraded status; guidance tooltip for GitHub token.
  - Project Activity card: list persisted events with time and type.

- M4 — Platform Hardening (0.5–1 sprint)
  - Introduce Alembic migrations for `links`, `events`, bundle columns; rate limiting (per token) and payload size caps; OTel traces/metrics wiring (env-gated).
  - Error taxonomy sweep; ETags for GET; pagination for list endpoints; service layer refactor.

- M5 — CLI & Tests (0.5 sprint)
  - CLI: login, mv, rm, open, bundle create `--push --open-pr`, search saved, links list, jobs watch.
  - Tests: API contract tests (httpx/pytest), worker job smoke; frontend component tests for dialogs/wizard; Cypress flow: create → commit → export → verify.

## Concrete Backlog Items

- Editor/Files
  - API: `POST /files/{id}/move` (update disk + links; `update_links` flag)
  - API: `GET /projects/{id}/files/tree`
  - API: `GET /files/{id}/links` + `GET /files/{id}/backlinks` (exists) surface in UI
  - UI: Tree navigation with rename/move; attachments picker integrated with upload endpoint

- Search
  - DB: `saved_searches` table; Router endpoints; UI surfaces
  - Admin: `POST /search/index/rebuild`; worker job for background reindex

- Bundles
  - Router: `DELETE /bundles/{id}`; project bundles cleanup
  - Wizard: tag selection and role presets; branch/PR actions in success toasts

- Artifacts
  - Panel: display `provider` and `repo_url`; status badge (ok/degraded)
  - Backend: type error mapping for auth/remote issues; enrich status payload with `error_code` when degraded

- Activity
  - Router/UI: per-project activity list from `events` with lazy pagination

- Platform
  - Alembic baseline; settings flags (`SEMANTIC_SEARCH`, `PR_INTEGRATION`, etc.) enforced
  - Rate limiting middleware; ETags support on GET; pagination wrappers

- QA & Docs
  - Add E2E smoke path docs; update API reference; add quickstart for GitHub PR integration

## Risks & Mitigations

- Git auth/remote variability: Keep adapters simple with clear error codes; degrade status where needed; add UI hints for tokens/SSH.
- Migrations timing: Gate with backups; ensure idempotency; run in staging first.
- Performance regressions: Keep FTS path fast; semantic behind flag; SSR caches later.

## Acceptance Targets

- Editor: Rename/move updates links; attachments render; backlinks visible.
- Search: Chips + saved searches; p95 latency ≤ 200 ms at 10k docs (FTS).
- Bundles: Wizard supports tags/roles; verify passes; branch/PR actions shown.
- Artifacts: Status card shows correct ahead/behind; commit/push succeeds ≥ 95%.
- Activity: Events visible; toasts show for jobs; no noisy console warnings.
- Platform: Migrations apply cleanly; OTel optional; rate limits active.

---

Owner: Lead Architect/PM

Status: Proposed for immediate execution following current sprint.

