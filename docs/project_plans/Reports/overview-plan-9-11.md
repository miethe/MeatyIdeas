# App Enhancements

## Current State

API: FastAPI app with projects, files, search (SQLite FTS5), artifacts (Git), bundles (ZIP) routes; simple token header auth.
app/api/main.py:1
app/api/routers/projects.py:1
app/api/routers/files.py:1
app/api/routers/search.py:1
app/api/routers/artifacts.py:1
app/api/routers/bundles.py:1

Data: SQLite with SQLAlchemy models for Project, File, ArtifactRepo, Bundle + virtual search_index.
app/api/models.py:1
app/api/db.py:1
app/api/search.py:1

Worker: RQ + Redis skeleton; jobs directory stubbed.
app/worker/worker.py:1
app/worker/jobs/bundle_jobs.py:1

Frontend: Next.js (App Router), React Query, shadcn/radix UI, dark mode, global search palette, project and files views, modal markdown viewer with Mermaid and basic ToC.
app/frontend/app/page.tsx:1
app/frontend/app/projects/[project]/page.tsx:1
app/frontend/components/search-command.tsx:1
app/frontend/components/item-modal-viewer.tsx:1
app/frontend/components/markdown-viewer.tsx:1
app/frontend/components/artifacts-panel.tsx:1
app/frontend/components/export-bundle-dialog.tsx:1

CLI: Typer-based tool for project create, file add, search, artifacts connect, bundle create.
app/cli/main.py:1
app/cli/config.py:1

Infra: Docker compose with API, frontend, worker, Redis, Caddy reverse proxy; OTel collector optional.
docker-compose.yml:1
docker/Caddyfile:1
README.md:1

## Product Requirements

Vision: Make MeatyProjects the fastest way to capture, evolve, and ship ideas as high‑fidelity, versioned artifacts — from notes to exportable, PR‑ready bundles — with powerful discovery and a delightful editor.

### Primary Users:

Builders documenting and shaping product/engineering ideas.
Bot/automation users interacting via API/CLI to ingest, search, export, and sync artifacts.

### Goals:

Rich editing with linking and attachments.
Advanced discovery (filters, snippets, semantic).
Smooth Git-based artifacts integration (status, commits, PRs).
Repeatable, auditable bundles with UI wizard and CLI parity.
Foundation for multi-user and scalability without regressing DX.

### Key Metrics:

Time to create → export bundle p50 < 2 minutes.
Search time to first relevant result p95 < 200ms for 10k files.
Editing satisfaction (survey) > 4/5; error rate < 1%.
95% success of artifact commits and exports; detailed errors for the rest.
Non-Goals (for this phase):
Real-time multi-user live-collab.
Complex RBAC and multi-tenant billing.
External plugin marketplace.
Rich Editor & Knowledge Graph

User Value: Elevates markdown authoring with a focused workspace, internal linking, backlinks, file tree, and attachments — turning projects into connected knowledge.
Scope:
Full-page editor with split view, slash-commands (headers, callouts, tables), Mermaid/KaTeX, and local draft autosave.
[[Wiki-style]] internal links with auto-complete; backlinks sidebar; graceful link resolution on file rename/move.
Project file tree (folders) and quick rename/move; templates for common docs (PRD, ADR, RFC).
Attach images/assets stored under project artifacts/ (enforced path rules), with upload UI.
API:
POST/PUT /api/files to support partial updates (PATCH) and rename/move; detect link targets and persist references.
GET /api/projects/{id}/files/tree for hierarchical tree; GET /api/files/{id}/links (outgoing), /api/files/{id}/backlinks.
POST /api/projects/{id}/attachments/upload → saves under artifacts/assets/ with sanitized path; returns URL.
Data Model:
New links table: id, project_id, source_file_id, target_file_id, target_path, link_text, created_at.
Extend File with hash, word_count; optional front_matter editing stayed as-is.
Acceptance Criteria:
Creating [[Some Doc]] creates a link; backlinks UI lists referencing files with titles.
Renaming a file updates internal links (or flags conflicts) and reindexes links.
Uploading an image places it under /artifacts/assets/ and renders in preview.
Editor supports Mermaid and math blocks; preview matches render.
Search 2.0 (Filters, Snippets, Semantic)

User Value: Finds the right doc fast with better ranking, facets, and optional semantic results.
Scope:
FTS results with title/path/snippet highlighting; filters for project, tags, status; sorting by updated_at.
Saved searches; keyboard-first command palette with typed filters (e.g., tag:t1).
Optional semantic search (MVP: local embeddings via worker; Postgres/pgvector optional later).
API:
GET /api/search → returns array with file_id, title, path, snippet, score, and applied filters.
POST /api/search/index/rebuild (admin) and background incremental indexer on file changes.
GET /api/search/saved and POST /api/search/saved for saved queries.
Data Model:
Extend search_index to also store title and path; add saved_searches table.
Optional embeddings table: file_id, vector (provider configurable).
Acceptance Criteria:
Query “deployment tag:infra” shows filtered, highlighted snippets; p95 < 200ms on 10k docs.
Semantic mode returns related files with confidence; flagged as semantic.
Bundles v2 (Wizard, Roles, Branch/PR)

User Value: Curate and ship bundles consistently; push as branch and open PR in one flow.
Scope:
UI wizard: select by file, folder, tag; assign roles (e.g., “Spec”, “Test Plan”); include checksums; preview manifest.
Option to push bundle as a branch in artifacts repo; optionally open PR (GitHub/GitLab) with generated description.
Bundle history UI, download, and verification of bundle.yaml.
API:
POST /api/projects/{id}/export/bundle returns job id; worker performs zip creation and (optional) branch push.
GET /api/bundles/{id} status; GET /api/projects/{id}/bundles list.
POST /api/bundles/{id}/verify validates checksums/manifest.
Data Model:
Use existing Bundle model; populate selection, output_path; add status, error, metadata fields via migration.
Acceptance Criteria:
Export creates ZIP with bundle.yaml and selected files; shows in history with status=completed.
With push_branch=true, branch appears in remote; PR created with link surfaced in UI.
Artifacts Integration v2

User Value: Confidence and control over synced artifacts with clear status and history.
Scope:
Connection status card (repo URL/provider/branch/last sync); commit and push selected paths; view recent commits.
Provider OAuth flow (later), start with PAT/token support via settings.
API:
GET /api/projects/{id}/artifacts/status (detect remote, branch, ahead/behind).
POST /api/projects/{id}/artifacts/commit with paths/message/push flag; returns commit id and push outcome.
GET /api/projects/{id}/artifacts/history latest commits.
Acceptance Criteria:
Connect shows connected status; committing files updates repo and push state; errors classified (GIT_CLONE_FAILED, NETWORK_ERROR, etc.).
Projects Home Enhancements

User Value: Faster navigation and insight across many projects.
Scope:
Board view by status; quick filters by tag; pin favorites; color labels; recent activity summary.
Bulk actions (delete, export).
Acceptance Criteria:
Drag-and-drop status updates persist; filters combine; favorites persist in local storage.
Activity & Notifications

User Value: Awareness of job progress, errors, and changes.
Scope:
Project activity feed (create/update/delete, bundle exports, artifact commits).
SSE for job status updates (toast in UI); CLI polls or tails job.
API:
GET /api/events/stream?project_id=... SSE; GET /api/jobs/{id}.
Data Model:
events table: id, project_id, type, payload JSON, created_at.
Acceptance Criteria:
Export and commit actions emit events; UI toasts update live without refresh.
API/CLI Enhancements

CLI:
ideas login (save token/base), ideas mv (rename path and update links), ideas rm, ideas open, ideas bundle create --push --open-pr, ideas search --semantic, ideas links list.
API:
ETags for GET endpoints; pagination for project/files lists; PATCH for partial updates; consistent error schema.
Acceptance Criteria:
CLI commands succeed with correct exit codes; --json output toggles machine-readable mode.
Architecture & Platform

Database: Introduce Alembic migrations; optional Postgres (keep SQLite for local). If Postgres present, enable pgvector for semantic search.
Services: Introduce services/ layer for domain logic (rendering, search, links) and repositories/ for persistence to keep routers thin.
Jobs: Expand Worker jobs: render, reindex, link discovery, bundle export, git commit/push, embeddings; use RQ status with custom progress.
Events/SSE: Use Redis pubsub for transient events and persist to events table; API exposes SSE stream per project.
Security: Rate limiting (per token), payload size limits, stricter path validation, CORS tightened, provider tokens stored securely.
Observability: Wire OTel metrics/traces to collector; structured logs preserved; error tracking (Sentry) optional via envs.
Acceptance Criteria:
Migrations apply cleanly; app runs with both SQLite and Postgres; routers thin (<100 LoC), services tested.
Implementation Plan

Milestone 0 — Foundations (1 sprint)

Backend: Add Alembic; split routers → services; add events table; SSE endpoint; job status endpoint; error schema standardization.
Data: Migrations to add Bundle.status/error/metadata, File.hash/word_count, links, events.
Observability: Enable OTel in API/worker; structured logs; trace key operations.
Acceptance: Healthcheck green; migrations idempotent; SSE demo event visible in UI.
Milestone 1 — Editor & Links (1–2 sprints)

Frontend: Build full-page editor route; file tree; slash commands; backlinks panel; attachments upload; graceful rename/move UI.
Backend: Link extraction on save; links/backlinks endpoints; safe artifact upload endpoint.
CLI: mv, rm, links list.
Acceptance: Links stored; backlinks show; rename updates links; attachments render.
Milestone 2 — Search 2.0 (1 sprint)

Backend: Expand FTS to include title/path; snippet generation; filters; saved searches; rebuild endpoint.
Worker: Background reindex job.
Frontend: Palette with filters; results with snippets and facets; saved search management.
Acceptance: Highlighted snippets; filters work; saved searches persist.
Milestone 3 — Bundles v2 (1 sprint)

Backend: Bundle job with roles, manifest enrichment, branch push, PR integration (provider token-based).
Frontend: Wizard with selection, roles, preview; history view; download and verify.
CLI: bundle create --push --open-pr --role Spec:file.md.
Acceptance: Branch/PR created when configured; history lists bundles.
Milestone 4 — Artifacts v2 (1 sprint)

Backend: Status and history APIs; commit/push with better errors; provider adapters (GitHub/GitLab).
Frontend: Status card; commit/push UI; history list.
Acceptance: Status shows ahead/behind; commit+push works with clear feedback.
Milestone 5 — Activity & Notifications (0.5 sprint)

Backend: Emit events for key actions; SSE streaming per project.
Frontend: Toasts and activity feed.
CLI: jobs watch <id>.
Acceptance: Live updates on export/commit.
Milestone 6 — Optional Postgres & Semantic (parallelizable)

Backend: Postgres support, pgvector integration behind feature flag; embedding job using local model or API.
Frontend/CLI: --semantic search path.
Acceptance: Semantic search flagged, returns related results; fallback to FTS when disabled.
Cross-Cutting

Docs: Update README and docs with new endpoints, CLI usage, bundle schema v2, and UI guides.
Testing: Unit tests for services (render/links/search/git/bundle), API contract tests, and E2E: create → link → search → bundle → push.
Performance: Budgets for search (<200ms p95), render (<150ms p95), export (<10s typical).
Key Design/Code Changes

API Modules: Add services/ and repositories/ packages; keep routers thin.
app/api/main.py:1 (wire new routers and SSE)
Routers: New routers for links, bundles status, artifacts status/history, events SSE.
Worker: Add jobs and progress helpers; subscribe/publish events on start/finish.
app/worker/worker.py:1
Frontend: New pages and components:
Editor route app/frontend/app/projects/[project]/editor/[file].tsx
File tree component; backlinks sidebar; search UI enhancements; bundle wizard; artifacts status card.
CLI: Extend commands; config persistence for tokens; --json output mode.
Risks & Mitigations

Git provider auth complexity: Start with PATs; abstract provider adapters; add OAuth later.
Semantic search performance: Behind feature flag; degrade gracefully to FTS.
Migrations for existing data: Provide backfill scripts; keep SQLite fallback.
SSE scalability: Keep per-project streams; back by Redis pubsub; cap message sizes.
Acceptance Summary (End-to-End)

Create a project → add multiple files with links and attachments → search returns filtered results with snippets → export bundle with roles and push a branch + PR → artifacts panel reflects status and history → activity feed and toasts show job progress → CLI can replicate flows headlessly.
Would you like me to turn this into epics/stories tracked in a backlog file and scaffold the new API routes/services and frontend pages to jumpstart Milestone 0/1?