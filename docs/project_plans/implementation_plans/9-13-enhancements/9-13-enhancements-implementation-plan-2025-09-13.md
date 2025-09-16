---
title: "Implementation Plan — MeatyProjects 9/13 Enhancements"
status: Ready
version: 1.0
date: 2025-09-13
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-13-enhancements-prd.md
owner: Implementation Planner Agent
-----------------------------------------------------------------------------------

## 0) Summary

This plan operationalizes the 9/13 Enhancements PRD into sequenced, testable work. It follows MeatyProjects’ layered architecture and introduces new models (User, Directory, Repo, ProjectGroup, ProjectGroupMembership, ShareLink), APIs, worker jobs, and UI components. The plan is organized by phases (aligned to the PRD rollout) and within each by architecture layer.

## 1) Scope & Complexity

Complexity Classification: XL — Cross-system, 30+ tasks, multi-epoch rollout with DB migrations, new worker jobs, SSE events, and significant UI.

## 2) Architecture Layer Mapping (Execution Order)

1. Database Layer (schema, migrations)
2. Repository Layer (data access)
3. Service Layer (business logic)
4. API Layer (routes, validation, errors)
5. UI Layer (components, hooks, state)
6. Testing Layer (unit, integration, E2E)
7. Documentation Layer (API/UX docs)
8. Deployment Layer (flags, telemetry, rollout)

## 3) Milestones & Timeline

- Phase 1 (Week 1): Sidebar + Results Modal + Profile
- Phase 2 (Week 2): Multi-repo Git panel (core ops)
- Phase 3 (Week 3): Directories model + Tree + DnD + Events
- Phase 4 (Week 4): Import/Export jobs + Share Links
- Phase 5 (Week 5): Dashboard Groups

Successive phases may start in parallel after their DB/API dependencies are merged behind feature flags.

## 4) Global Foundational Tasks

Task: Alembic Baseline & Migration Scaffolding
- Description: Introduce Alembic, create baseline migration, add migration scripts for all new tables; provide dev commands.
- Acceptance: `alembic upgrade head` applies cleanly; CI runs migrations; docs updated.
- Estimate: 3 pts
- Dependencies: None
- Assignee: Backend
- Labels: backend, db, infra, P1

Task: Feature Flags Wiring
- Description: Add flags `GIT_INTEGRATION`, `SHARE_LINKS`, `GROUPS_UI`, `DIRS_PERSIST`, `RESULTS_MODAL` to settings.
- Acceptance: Flags readable in API and FE; toggling hides routes/menus as needed.
- Estimate: 2 pts
- Dependencies: None
- Assignee: Backend + FE
- Labels: platform, P1

Task: SSE Event Types & Client Handler Extensions
- Description: Extend event types for files/dirs/projects/repos/import/export; update FE toasts.
- Acceptance: Events emitted on key actions; FE toasts verified; no console errors.
- Estimate: 3 pts
- Dependencies: API routes in later phases
- Assignee: Backend + FE
- Labels: backend, frontend, events, P1

Task: Error Taxonomy & Middleware
- Description: Ensure consistent error codes (BAD_PATH, CONFLICT, GIT_* etc.), JSON envelope; add simple rate limiting for public/share routes.
- Acceptance: Error shapes consistent; rate limits applied to share endpoints.
- Estimate: 3 pts
- Dependencies: None
- Assignee: Backend
- Labels: api, security, P1

Task: Telemetry & Structured Logs
- Description: Structured logs for repo/import/export operations; optional OTel wiring (env-gated).
- Acceptance: Logs include repo_id, action, duration, error_code; OTel works when enabled.
- Estimate: 3 pts
- Dependencies: None
- Assignee: Backend
- Labels: observability, P2

## 5) Phase 1 — Sidebar, Results Modal, Profile

Database Layer
- Task: User table
  - Description: Add `user` table for a single local profile: id (default "local"), name, email, avatar_url, preferences json, timestamps.
  - Acceptance: Migration creates table; seed or default row created on startup if missing.
  - Estimate: 2 pts; Assignee: Backend; Labels: db, P1

Service/API Layer
- Task: Profile endpoints
  - Description: `GET /api/me`, `PATCH /api/me`, `POST /api/logout` (stateless).
  - Acceptance: Validation; preferences persisted; logout clears client token flow.
  - Estimate: 2 pts; Deps: User table; Assignee: Backend; Labels: api, P1

- Task: Search enhancements for modal
  - Description: Ensure `/api/search` supports `type`, `updated_from|to`, `path_prefix`, multi-tag, sorting by updated.
  - Acceptance: Contract tests for query params; performance ≤ 200 ms p95 @10k.
  - Estimate: 3 pts; Assignee: Backend; Labels: search, P1

UI Layer
- Task: Sidebar sections
  - Description: Implement collapsible sections (Projects, Tags, Filters) with persisted state; Projects expand shows depth=1 contents.
  - Acceptance: Expand/collapse persists; clicking project navigates; directories show with "/"; performance targets met.
  - Estimate: 5 pts; Deps: tree endpoint (depth param); Assignee: FE; Labels: ui, P1

- Task: Full-screen Results Modal
  - Description: Shared modal for Search/Tags/Filters; columns; keyboard nav; virtualized list; infinite scroll.
  - Acceptance: Opens from search, tag click, advanced filters; list virtualization; bulk copy/export actions visible (export behind flag until Phase 4).
  - Estimate: 8 pts; Deps: search API; Assignee: FE; Labels: ui, P1

- Task: Profile dropdown + dialog
  - Description: Add User Profile menu in top nav; view/edit profile dialog; logout action.
  - Acceptance: Edits persist; logout clears token and redirects.
  - Estimate: 3 pts; Deps: profile API; Assignee: FE; Labels: ui, P1

Testing Layer
- Task: Phase 1 tests
  - Description: API tests for profile and search filters; FE component tests for Sidebar & Modal keyboard nav.
  - Acceptance: Tests pass in CI; coverage added for new code paths.
  - Estimate: 5 pts; Deps: above tasks; Assignee: QA/Fullstack; Labels: tests, P1

Documentation Layer
- Task: User & Search docs
  - Description: Update user guide for search modal and profile; API reference for /me endpoints, search filters.
  - Acceptance: Docs reviewed and merged.
  - Estimate: 2 pts; Assignee: Docs; Labels: docs, P2

Deployment Layer
- Task: Enable RESULTS_MODAL flag by default after verification; keep others off until their phases.
  - Acceptance: Flag flip plan documented; revert path defined.
  - Estimate: 1 pt; Assignee: Platform; Labels: rollout, P1

### Phase 1 — Dev-Ready Breakdown (Repo Specific)

This section maps Phase 1 tasks to concrete changes in this repository with file targets, implementation notes, and validation steps.

- User model and seed
  - Files: `app/api/models.py` (add `User`), `app/api/main.py` (ensure seed), `app/api/db.py` (no change; `create_all` runs)
  - Model: `User(id: str='local', name: str, email: str, avatar_url: str|None, preferences: JSON, created_at, updated_at)`
  - Seed: on startup, ensure a row with `id='local'` exists; default `{name: 'Local User', email: ''}`
  - Validate: `sqlite3 /data/app.sqlite3 "select * from user;"` returns one row after first boot

- Feature flags wiring
  - Files: `app/api/settings.py` (add: `GIT_INTEGRATION=0, SHARE_LINKS=0, GROUPS_UI=0, DIRS_PERSIST=0, RESULTS_MODAL=1`), new router `app/api/routers/config.py` exposing `GET /api/config` with flags
  - FE: add `lib/config.ts` to fetch config once; hide/show UI by flags; default `RESULTS_MODAL` on
  - Validate: call `/api/config` and see flags; toggle via env overrides in `app/api/.env` or root `.env`

- Profile API
  - Files: new `app/api/routers/profile.py` implementing `GET /api/me`, `PATCH /api/me`, `POST /api/logout`
  - Include: add router in `app/api/main.py` with same `auth` dependency as other private routes
  - Validation: add `app/api/tests/test_profile.py` covering read/update; logout returns 204

- Search API filters for modal
  - Files: `app/api/routers/search.py`
  - Add query params: `type` (extension, e.g. `md,mdx`), `updated_from`, `updated_to`, `path_prefix`
  - SQL: extend WHERE with `AND f.path LIKE :path_prefix || '%'`, date bounds on `f.updated_at`, and extension filter via `f.path LIKE '%.md' OR ...`
  - Tests: extend `app/api/tests/test_search.py` to assert filters; cap `limit` via `settings.search_max_limit`

- Sidebar sections (Projects, Tags, Filters)
  - Files: `app/frontend/components/app-shell.tsx` (replace placeholder sidebar with sections), new components: `components/sidebar/projects-section.tsx`, `components/sidebar/tags-section.tsx`, `components/sidebar/filters-section.tsx`
  - Data:
    - Projects: use existing `/api/projects`
    - Top-level contents: until Phase 3 tree, derive from `/api/files` by filtering `path` without `/` (root) and unique `dirname` for display; expose minimal helper API if needed
    - Tags: add API `GET /api/tags?q=` (optional, computed from `files.tags` JSON); or re-use `/api/search?facets=1`
  - Persist expand/collapse in `localStorage` keyed per section
  - Keyboard navigation: ensure focus order and arrow key support

- Full-screen Results Modal
  - Files: new FE component `components/search/results-modal.tsx`, open from CommandPalette, tag clicks, and Filters CTA
  - Data: reuse `/api/search`; add infinite scroll using `limit/offset`; virtualize rows with `@tanstack/react-virtual`
  - Columns: Title, Path, Project, Tags, Updated; bulk actions: open, copy paths; export button present but disabled unless flag `RESULTS_MODAL && SHARE_LINKS/EXPORT_PHASE4` criteria
  - Accessibility: focus trap, Esc to close, ARIA roles

- Profile dropdown and dialog
  - Files: add `components/profile/profile-menu.tsx` and `components/profile/profile-dialog.tsx`; wire into `AppShell` header
  - Data: use `/api/me` to view/update; `POST /api/logout` clears client token from FE store and navigates to `/`

- Tests (Phase 1)
  - API: `test_profile.py` (GET/PATCH/logout), extend `test_search.py` for new filters
  - FE: component tests for Sidebar keyboard nav and Results Modal open/close + keyboard selection

- Docs
  - Files: `docs/user/searching.md` (modal usage), `docs/architecture/search.md` (new filters), add `docs/user/profile.md`
  - Update OpenAPI is auto-generated at `/api/docs` for new profile routes

- Rollout
  - Default flags: `RESULTS_MODAL=1`, others `0`
  - Toggle checks: verify FE hides Git/Groups/Dirs features behind flags; ensure API 404/403 as needed for unflagged routes

Checklist commands
- Run API: `docker compose up -d api redis`
- Health: `curl -H 'X-Token: devtoken' localhost:8000/api/healthz`
- Config: `curl -H 'X-Token: devtoken' localhost:8000/api/config`
- Profile: `curl -H 'X-Token: devtoken' localhost:8000/api/me`

## 6) Phase 2 — Multi-Repo Git Panel

Reference: See detailed phase plan in `docs/project_plans/implementation_plans/ph2-multi-repo-git-impl.md` for file-by-file tasks, API specs, and acceptance.

Database Layer
- Task: Repo table (supersede ArtifactRepo)
  - Description: New `repos` table: id, name, scope (project|global), project_id?, provider, repo_url?, default_branch, visibility, last_synced_at.
  - Acceptance: Migration creates table; data migration script copies existing ArtifactRepo rows into Repo where applicable; keep ArtifactRepo for compatibility temporarily.
  - Estimate: 5 pts; Assignee: Backend; Labels: db, migration, P1

Repository/Service Layer
- Task: Repo service & adapters
  - Description: Abstraction over Git providers; implement local + GitHub adapters; shared operations (clone, status, pull, push, branches, history).
  - Acceptance: Unit tests for adapters; typed errors (GIT_AUTH, GIT_PULL_FAIL, GIT_PUSH_FAIL).
  - Estimate: 8 pts; Deps: Repo table; Assignee: Backend; Labels: integration, git, P1

API Layer
- Task: Repo routes
  - Description: CRUD and operations: create/list/delete, status, branches (list/create), checkout, pull, push, history.
  - Acceptance: OpenAPI docs; integration tests; rate limits on heavy operations as needed.
  - Estimate: 5 pts; Deps: Repo service; Assignee: Backend; Labels: api, git, P1

UI Layer
- Task: Git Panel UI
  - Description: Repo cards in project page; connect dialog; status indicators; pull/push buttons; branches dropdown; history list.
  - Acceptance: Works with local and GitHub providers; errors surfaced as toasts; no blocking UI on failure.
  - Estimate: 8 pts; Deps: Repo routes; Assignee: FE; Labels: ui, git, P1

Testing Layer
- Task: Repo integration tests
  - Description: API tests for status/pull/push/branches; FE e2e smoke for connect→status→pull/push.
  - Acceptance: CI green; manual runbook validated.
  - Estimate: 5 pts; Assignee: QA/Fullstack; Labels: tests, git, P1

Documentation Layer
- Task: Git usage guide
  - Description: Update artifacts docs to “Repos”; provider-specific notes; tokens.
  - Acceptance: Reviewed; troubleshooting section for common errors.
  - Estimate: 2 pts; Assignee: Docs; Labels: docs, P2

Deployment Layer
- Task: Flag GIT_INTEGRATION on (staged)
  - Description: Enable in staging first; monitor logs; then enable in prod.
  - Acceptance: Rollback plan documented.
  - Estimate: 1 pt; Assignee: Platform; Labels: rollout, P1

## 7) Phase 3 — Directories, File Tree, DnD, Live Updates

Database Layer
- Task: Directory table
  - Description: Persist directories even when empty: id, project_id, path (unique per project), name, timestamps.
  - Acceptance: Migration creates table; backfill from existing file paths (distinct dirs) for active projects.
  - Estimate: 5 pts; Assignee: Backend; Labels: db, P1

Service/API Layer
- Task: Directory CRUD/move
  - Description: `POST /projects/{id}/dirs`, `PATCH /projects/{id}/dirs` (rename/move subtree, optional dry_run), `DELETE /projects/{id}/dirs`.
  - Acceptance: Safe path validation; dry-run returns impacted counts and paths; SSE events emitted on changes.
  - Estimate: 8 pts; Deps: Directory table; Assignee: Backend; Labels: api, P1

- Task: Tree endpoint enhancements
  - Description: `GET /projects/{id}/files/tree?include_empty_dirs=1&depth=…` to include persisted empty dirs and depth limiting.
  - Acceptance: Depth=1 returns top-level; include_empty_dirs adds empty dirs; performance ≤150 ms @5k files.
  - Estimate: 3 pts; Assignee: Backend; Labels: api, performance, P1

- Task: Batch move API
  - Description: `POST /api/files/batch/move` to move multiple files/dirs within/across projects; optional update_links; dry_run support.
  - Acceptance: Cross-project moves validated; link rewrite only for md wiki-links; atomic best-effort with partial failure report.
  - Estimate: 5 pts; Assignee: Backend; Labels: api, P1

UI Layer
- Task: File tree UI with DnD & multi-select
  - Description: Expand/collapse, create/rename/delete dirs; multi-select (shift/cmd); drag across tree & to other project in sidebar.
  - Acceptance: Keyboard accessible; operations reflect within 300 ms; SSE refresh correct.
  - Estimate: 8 pts; Deps: tree + dir + batch APIs; Assignee: FE; Labels: ui, P1

Testing Layer
- Task: Directory & DnD tests
  - Description: API unit/integration tests; FE component tests; Cypress flow for multi-select drag.
  - Acceptance: Green in CI; flake <1%.
  - Estimate: 5 pts; Assignee: QA/Fullstack; Labels: tests, P1

Documentation Layer
- Task: Files/Directories guide
  - Description: Update user docs for folder management and drag-and-drop.
  - Acceptance: Screenshots/GIFs included.
  - Estimate: 2 pts; Assignee: Docs; Labels: docs, P2

Deployment Layer
- Task: Flag DIRS_PERSIST on after verification
  - Acceptance: Rollback plan and metrics defined.
  - Estimate: 1 pt; Assignee: Platform; Labels: rollout, P1

## 8) Phase 4 — Import/Export & Share Links

Database Layer
- Task: ShareLink table
  - Description: id, project_id, token, permissions (read), expires_at?, revoked_at?, created_at.
  - Acceptance: Migration applied; token uniqueness and length enforced.
  - Estimate: 3 pts; Assignee: Backend; Labels: db, security, P1

Service/API Layer — Jobs
- Task: Import jobs
  - Description: Worker jobs: import_zip, import_files, import_git; progress events; safe path validation; include/exclude globs.
  - Acceptance: Jobs handle typical zip and git repos; error codes on failure; idempotency for retries.
  - Estimate: 8 pts; Assignee: Backend/Worker; Labels: jobs, P1

- Task: Export jobs
  - Description: export_zip, export_json; selection support; result download URL.
  - Acceptance: ZIP includes project.json and files/ structure; JSON format documented.
  - Estimate: 5 pts; Assignee: Backend/Worker; Labels: jobs, P1

API Layer — Jobs & Sharing
- Task: Import/Export endpoints
  - Description: `POST /api/projects/import`, `POST /api/projects/{id}/export`, `GET /api/jobs/{id}`; SSE events.
  - Acceptance: Large payloads accepted; jobs queued; job status returns result URL.
  - Estimate: 5 pts; Assignee: Backend; Labels: api, P1

- Task: Share endpoints
  - Description: `POST /api/projects/{id}/share-links`, `GET /api/projects/{id}/share-links`, `DELETE /api/share-links/{id}`, public read routes `GET /api/share/{token}/…` with rate limit.
  - Acceptance: Read-only scope; expiry and revoke enforced; tokens unguessable.
  - Estimate: 5 pts; Assignee: Backend; Labels: api, security, P1

UI Layer
- Task: Results modal bulk export action
  - Description: Enable Export selected → enqueues export; show progress via events.
  - Acceptance: Export works for 100+ files; user gets download link.
  - Estimate: 3 pts; Deps: export API; Assignee: FE; Labels: ui, P1

- Task: Import flows
  - Description: Project page “Import” (zip/files/json/git); upload UI; options for target directory and tags.
  - Acceptance: Imports reflect in tree; errors surfaced; progress shown.
  - Estimate: 5 pts; Deps: import API; Assignee: FE; Labels: ui, P1

- Task: Share link management UI
  - Description: In project “…” menu: Create share link (expiry optional), list links, revoke; copy link to clipboard.
  - Acceptance: Public viewer opens read-only; expiry/revoke honored.
  - Estimate: 5 pts; Deps: share API; Assignee: FE; Labels: ui, security, P1

Testing Layer
- Task: Jobs & Share tests
  - Description: Worker job tests; API integration; FE e2e for import/export/share.
  - Acceptance: CI green; test artifacts cleaned up.
  - Estimate: 5 pts; Assignee: QA/Fullstack; Labels: tests, P1

Documentation Layer
- Task: Import/Export & Sharing docs
  - Description: User guide; API examples; limits and security notes.
  - Acceptance: Docs merged with examples.
  - Estimate: 3 pts; Assignee: Docs; Labels: docs, P2

Deployment Layer
- Task: Enable SHARE_LINKS after review
  - Acceptance: Monitoring and rate limits confirmed.
  - Estimate: 1 pt; Assignee: Platform; Labels: rollout, P1

## 9) Phase 5 — Dashboard Groups

Database Layer
- Task: ProjectGroup & Membership tables
  - Description: Create `project_groups` and `project_group_memberships` with color and sort order.
  - Acceptance: Migrations applied; basic seed if desired.
  - Estimate: 3 pts; Assignee: Backend; Labels: db, P2

API Layer
- Task: Groups CRUD & assignment
  - Description: `POST/GET/PATCH/DELETE /api/project-groups`, `POST /api/project-groups/{id}/assign`.
  - Acceptance: Projects appear in groups; order respected.
  - Estimate: 3 pts; Assignee: Backend; Labels: api, P2

UI Layer
- Task: Dashboard groups UI
  - Description: Groups with color chips; drag projects between groups; create/rename/delete.
  - Acceptance: Persisted ordering; keyboard accessible.
  - Estimate: 5 pts; Assignee: FE; Labels: ui, P2

Testing/Docs/Deployment
- Task: Phase 5 tests & docs; enable GROUPS_UI flag.
  - Acceptance: CI green; docs updated; flag on.
  - Estimate: 3 pts; Assignee: QA/Docs/Platform; Labels: tests, docs, rollout, P2

## 10) Cross-Cutting Tasks (All Phases)

- API Pagination & ETags
  - Description: Add pagination envelopes where needed; ETag headers for GET list/detail.
  - Acceptance: Clients handle pagination; conditional GET works.
  - Estimate: 5 pts; Labels: api, perf, P2

- Accessibility Audit
  - Description: Verify dialogs/menus; keyboard navigation; contrast.
  - Acceptance: WCAG 2.1 AA checks pass on new UIs.
  - Estimate: 3 pts; Labels: a11y, P2

- Performance Budgets
  - Description: Add perf smoke tests for search modal, tree load, repo status.
  - Acceptance: Budgets enforced in CI where feasible.
  - Estimate: 3 pts; Labels: performance, tests, P2

## 11) Acceptance Criteria — Phase Exit Gates

Phase 1
- Sidebar sections persist state; depth=1 contents load ≤150 ms.
- Results modal functions with keyboard + virtualization; bulk actions visible (export gated).
- Profile view/edit works; logout clears token and blocks private routes.

Phase 2
- Multiple repos per project or global; status/pull/push/branches/history operational; typed errors surfaced.

Phase 3
- Persisted directories incl. empty; batch move with dry-run; tree depth param; DnD multi-select works across projects; SSE updates UI.

Phase 4
- Import/Export jobs succeed ≥95%; progress visible; share links read-only with expiry/revoke.

Phase 5
- Groups CRUD and drag between groups; ordering persists.

## 12) Risks & Mitigations

- Git auth/conflicts: Use typed errors; non-destructive defaults; docs & toasts.
- Large moves/imports: Dry-run previews; chunked processing; resume/retry semantics.
- Share link leakage: Long tokens, expiry, revoke, rate limits; server-side rendering for public views.
- Migration safety: Backups; idempotent migrations; staging validation before prod.

## 13) Estimation Summary (Rough)

- Phase 1: ~26 pts
- Phase 2: ~29 pts
- Phase 3: ~34 pts
- Phase 4: ~30 pts
- Phase 5: ~16 pts
- Cross-cutting & foundation: ~19 pts
- Total: ~154 pts (XL, ~4–6 weeks with 2–3 devs in parallel behind flags)

## 14) Dependencies & Sequencing Notes

- Run Alembic baseline first.
- Repo table and service must land before Git Panel.
- Directory table precedes tree and DnD.
- Jobs & share APIs precede FE import/export/share UIs.
- Flags allow FE stubbing early with mocked APIs.

## 15) Documentation Updates

- Update user guides: searching, profile, repos, directories, import/export, sharing, groups.
- Update API reference and examples for new routes.
- Add runbooks: Git provider auth, import/export troubleshooting.

## 16) Deployment & Backout

- Staged rollout per flag; monitor logs and perf.
- Backout: flip flags off; rollback migrations only if strictly needed (prefer additive migrations).

## 17) Quality Gates

- All tasks have acceptance criteria and tests.
- Dependencies validated; no orphaned features behind disabled flags.
- Success metrics in PRD met or exceptions documented.
