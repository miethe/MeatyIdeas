---
title: "MeatyProjects — 9/13 Enhancements PRD"
version: 1.0
status: Ready for Implementation
date: 2025-09-13
-----------------------------------------------------------------------------------

## 1) Purpose & Vision

Elevate navigation, file operations, Git workflows, import/export, and project organization to reduce friction for daily use. Provide a unified, responsive UX with immediate UI updates, consistent modals, and pragmatic Git controls that scale from solo use to small teams.

## 2) Scope

In scope
- Sidebar redesign with sections: Projects, Tags, Filters (expand/collapse, top-level content).
- Full-screen results modal shared by Search, Tags, Filters.
- Top navigation User Profile with view/edit and logout.
- Git integration: connect multiple repos, clone/pull/push, branches/commits view.
- Projects and files: unique slug collision handling; inline edit; directories (create/rename/delete, navigate); multi-select drag-and-drop across directories and projects; live UI updates; file card copy/download.
- Import/Export: zip, individual files, JSON (MeatyProjects schema), local or remote Git repo import; export to same formats.
- Dashboard: organize projects into categories/groups; drag-and-drop between groups; create categories/groups; simple shareable links for read-only viewing.

Out of scope
- Multi-user auth, RBAC, SSO, billing.
- Advanced Git code review or merge conflict resolution UIs.
- Real-time multi-user co-editing.
- Public indexing/search of shared content.

## 3) Users & JTBD

- Builder/Owner: Browse, filter, and find items quickly; organize projects; manage files, tags, directories; import/export content; connect and push artifacts to Git.
- Contributor/Automation: Use share links to view content; pull exports; sync Git.

## 4) Success Metrics

- Navigation actions (open modal, expand section) p95 ≤ 100 ms after data load.
- File ops (move/rename) reflect in UI ≤ 300 ms (with SSE updates).
- Import/export job success ≥ 95%; Git push/pull success ≥ 95%.
- Reduction in clicks to locate an item by ≥ 30% (baseline from internal use).
- Profile and logout flows with 0 critical errors.

## 5) Current State (Baseline)

- Projects, Files, Search (SQLite FTS5), Links, Bundles, Artifacts (single repo per project), SSE events for bundles/commits, basic file tree generation from file paths.
- No dedicated directories entity (empty folders not persisted). No multi-repo model. No profile model. No share links. Import/export limited.

## 6) Product Epics & Requirements

EPIC A — Sidebar Navigation
- Sections: Projects, Tags, Filters. Each section collapsible/expandable with state persisted per user (localStorage).
- Projects:
  - List projects user can access. Clicking navigates to project page.
  - Expand a project to show top-level contents (directories and files at root). Show directories with trailing “/”.
  - A “More…” link opens the project with full tree.
- Tags:
  - List distinct tags across user content. Clicking opens full-screen results modal filtered by that tag.
  - Tag list supports typeahead filtering.
- Filters:
  - Provide quick chips and an “Open Advanced Filters” action to open full-screen modal with filter builder.
  - Filterable criteria: file type (by extension), updated range, tags (any/all), path/prefix, project, status. Persist last-used filter set per user.

EPIC B — Full-Screen Results Modal
- Shared component for Search, Tags, Filters:
  - Columns: Title, Path, Project, Tags, Updated.
  - Keyboard navigation, selection, and open-in-place.
  - Virtualized list for large result sets; infinite scroll.
  - Uses existing /api/search for queries; tags and filters construct the query params.
  - Bulk actions: open, copy paths, export selection to zip (enqueues job).

EPIC C — Top Navigation Profile
- User Profile menu (avatar/name at right):
  - View profile: display name, email, avatar URL, preferences (theme, default view).
  - Edit profile: PATCH fields; validation for email/url; theme toggle.
  - Logout: clears API token client-side and redirects to login screen (token gate remains simple).
- No multi-user account system yet; a single “local user” entry stored server-side for profile data.

EPIC D — Git Integration (Multi-Repo)
- Connect multiple repos:
  - A repo can be scoped to a project or global (shareable across projects).
  - Providers: local (filesystem) and GitHub (existing adapter), placeholders for others.
  - Per-repo settings: name, provider, repo_url, visibility, default_branch.
- Operations:
  - Clone/connect repo (create local clone if remote).
  - Pull latest (fast-forward, show errors).
  - Commit+Push specific paths (existing artifacts flow) and general push.
  - Show status: ahead/behind, dirty, current branch.
  - Branches: list, checkout (safe), create new branch from default.
  - Commits: recent history with messages, author, timestamps, diff summary counts.
- UI:
  - Project page “Git Panel”: repo cards with provider badges, status, pull/push buttons, branches dropdown, quick history list.
  - Global “Repos” view under Sidebar > Projects (or a dedicated entry) for global repos.

EPIC E — Projects, Files, Directories, and Drag-and-Drop
- Slug generation:
  - slug = slugify(name); on conflict, append “-<shortid>” (first 6 chars of UUID). Return chosen slug in create response.
- Edit project inline:
  - Name, description, status, tags; immediate persistence; optimistic updates; toasts on success/failure.
- Directories:
  - Support create/rename/delete directories. Directories persist even when empty.
  - File tree shows directories and files, expandable/collapsible.
  - Directory rename/move updates children paths; dry-run shows impact count.
- Multi-select and drag-and-drop:
  - Select multiple files/directories and drag to a different directory in the same project or to another project.
  - Dry-run preview for cross-project moves (count of files, tags preserved).
  - Server enforces safe paths and performs batched moves; updates links for Markdown wiki-links on title change where applicable.
- Live updates:
  - SSE event types for file/dir create/update/delete/move; project updates; UI refreshes intelligently.
- File cards (project view):
  - Copy icon: copies raw file text to clipboard via `/api/render/raw?file_id=...` or existing fetch.
  - Download icon: downloads file in original format via `/api/files/{id}/download`.

EPIC F — Import & Export
- Import:
  - Zip (full project or selected files): unzip job, create/update directories/files.
  - Individual files (multi-upload): place into chosen directory; optional tag assignment.
  - Git repo import: clone repo and import supported file types (*.md, *.txt, *.json, configurable); maintain directory structure; create files and directories; can also link repo as connected repo.
  - MeatyProjects JSON: ingest `project.json` + `files/` or JSON-only schema; apply metadata (tags, status).
- Export:
  - Zip: full project or selection (files/dirs); includes `project.json` and `files/` structure.
  - JSON: produce a single JSON with project metadata and file entries or a folder with JSON + files.
  - Git export: for connected repo, commit and optionally push selection to a branch (reuse bundle pipeline when appropriate).
- Jobs:
  - Long-running import/export performed in worker; progress reported via events and job status endpoint.

EPIC G — Dashboard Organization & Sharing
- Categories/Groups:
  - Create/rename/delete groups.
  - Assign projects to groups (drag from dashboard or via “...” move menu).
  - Optional color and sort order per group; “Ungrouped” default bucket.
- Sharing:
  - Generate shareable read-only links at project level: creates a tokenized URL for a read-only project viewer.
  - Options: no expiration, expires at (date), revoke.
  - Shared view renders Markdown with safe subset; no edit, no exports (unless explicitly allowed as a per-link option).

## 7) Non-Functional Requirements

- Performance: tree build and top-level listings p95 ≤ 150 ms on 5k files; search modal load ≤ 300 ms for first page; Git status ≤ 2 s for non-huge repos.
- Reliability: idempotent import/export and move APIs; safe path handling; rollback or best-effort on partial failures with clear error codes.
- Security: server validates paths; share links use unguessable tokens (≥128 bits); read-only scope; rate limit public share endpoints.
- Accessibility: keyboard navigation in sidebar and modal; ARIA roles for dropdowns and dialogs; color-contrast verified in dark theme.
- Telemetry/Logging: structured logs for Git operations, import/export; events for UI toasts.

## 8) Data Model Changes

New tables
- User (single local profile)
  - id (string, default “local”), name, email, avatar_url, preferences (json), created_at, updated_at.
- Directory
  - id, project_id (fk), path (unique within project), name, created_at, updated_at.
- Repo (replaces/extends ArtifactRepo)
  - id, name, scope (“project” | “global”), project_id (nullable when global), provider, repo_url, default_branch, visibility, last_synced_at.
- ProjectGroup
  - id, name, color (nullable), sort_order.
- ProjectGroupMembership
  - project_id, group_id, sort_order.
- ShareLink
  - id, project_id, token (unique), permissions (“read”), expires_at (nullable), revoked_at (nullable), created_at.

Indexes
- Directory (project_id, path)
- Repo (project_id, provider), ShareLink (token), ProjectGroupMembership (group_id, sort_order)

Tag indexing (optional)
- If needed, a TagIndex(name, usage_count, last_used_at) maintained on write; otherwise derive distinct tags on demand.

Migration
- Alembic baseline including new tables and migration from ArtifactRepo → Repo (data copy where possible).

## 9) API Design

Auth
- Continue header `X-Token` for private routes. Public share routes gated by token param in URL.

Profile
- GET /api/me → { id, name, email, avatar_url, preferences }
- PATCH /api/me → partial update
- POST /api/logout → 204 (stateless; FE clears token)

Projects
- POST /api/projects { name, description?, tags?, status? } → 201 { id, slug, ... } (slug conflict adds “-shortid”)
- PATCH /api/projects/{id} → update fields
- GET /api/projects → list
- GET /api/projects/{id} → details

Files
- POST /api/files/project/{project_id} → create file
- PUT /api/files/{id} → update file
- POST /api/files/{id}/move { new_path?, new_title?, update_links?, dry_run? } → dry-run or apply (existing)
- DELETE /api/files/{id}
- POST /api/files/batch/move { items: [{type: “file|dir”, id}], to: { project_id, path }, update_links?, dry_run? }
- GET /api/files/{id}/download → attachment
- GET /api/render/raw?file_id=... → text/plain

Directories
- POST /api/projects/{id}/dirs { path } → create
- PATCH /api/projects/{id}/dirs { from_path, to_path, dry_run? } → rename/move subtree
- DELETE /api/projects/{id}/dirs { path }
- GET /api/projects/{id}/files/tree?include_empty_dirs=1&depth=1 → tree; depth=1 for top-level

Tags
- GET /api/tags?project_id?&q? → distinct tags (with optional prefix)
- GET /api/tags/{name}/files?project_id? → files with tag (or use /api/search?tag=name)
- POST inline tag creation not required (tags free-form on files/projects)

Search/Filters
- GET /api/search (existing; support `type`, `updated_from`, `updated_to`, `path_prefix`, `status`, multi tag)

Git (Repo)
- POST /api/repos { scope, project_id?, provider, name, repo_url?, visibility, default_branch? }
- GET /api/repos?project_id? → list
- GET /api/repos/{id}/status → { branch, ahead, behind, dirty }
- GET /api/repos/{id}/branches → [{ name, is_current }]
- POST /api/repos/{id}/branches { name } → create and checkout
- POST /api/repos/{id}/checkout { name } → checkout
- POST /api/repos/{id}/pull → pull
- POST /api/repos/{id}/push → push
- GET /api/repos/{id}/history?limit=50 → [{ sha, message, author, ts, stats }]
- DELETE /api/repos/{id}

Import/Export
- POST /api/projects/import { mode: “zip|files|json|git”, payload } → 202 { job_id }
  - zip: multipart upload; files: multipart; json: multipart or JSON body; git: { repo_url, include_globs?, exclude_globs? }
- POST /api/projects/{id}/export { mode: “zip|json”, selection?, include_paths? } → 202 { job_id }
- GET /api/jobs/{id} → status + result (download URL)
- SSE events: import.started|completed|failed, export.started|completed|failed

Sharing
- POST /api/projects/{id}/share-links { expires_at?, allow_export? } → { id, token, url }
- GET /api/projects/{id}/share-links → list
- DELETE /api/share-links/{id} → revoke
- GET /api/share/{token}/project → minimal public project view data
- GET /api/share/{token}/files?path? → list; GET /api/share/{token}/file?path → raw

Events (SSE)
- /api/events/stream?project_id=…&token=…
- Event types added: file.created|updated|moved|deleted, dir.created|moved|deleted, project.updated, repo.status, import/export.*

Error taxonomy
- Use structured error codes: BAD_PATH, NOT_FOUND, CONFLICT, GIT_AUTH, GIT_PULL_FAIL, GIT_PUSH_FAIL, IMPORT_FAIL, EXPORT_FAIL.

## 10) Frontend UX & Components

Sidebar
- Component: Sidebar with sections (Projects, Tags, Filters). Persist expanded state; typeahead for tags; top-level project contents on expand (depth=1).

Results Modal
- Shared component: opens for Search, Tag click, Advanced Filters; sortable columns, keyboard nav, virtualized; bulk actions.

Top Nav Profile
- Dropdown menu with View Profile, Edit Profile, Logout; profile dialog form with validation; logout clears token and navigates to login.

Project Page
- File Tree: shows directories + files; supports create/rename/delete directory; drag-and-drop within/between projects; multi-select (shift/cmd-click).
- Git Panel: repo cards; connect repo dialog (provider select, URL, default branch); status and actions.
- File Cards: “Copy” (raw to clipboard), “Download” (binary).

Dashboard
- Groups: list groups with color chips; drag projects into groups; “…” on project card to move; create group CTA.

Share View
- Public, read-only project viewer (server-rendered where possible); safe Markdown; no auth for share token; optional expiry notice.

Accessibility
- All dialogs include accessible title/description; tab order and focus traps; ARIA for menus.

## 11) Worker Jobs

- import_zip(project_id?, upload_ref)
- import_files(project_id, uploads[], target_path)
- import_git(project_id?, repo_url, include_globs, exclude_globs, also_connect_repo?)
- export_zip(project_id, selection)
- export_json(project_id, selection)
- repo_pull(repo_id), repo_push(repo_id), repo_clone(repo_id) — for long operations
- Publish progress via Redis-backed events; persisted Jobs API for status.

## 12) Telemetry & Settings

- Feature flags: GIT_INTEGRATION, SHARE_LINKS, GROUPS_UI, DIRS_PERSIST, RESULTS_MODAL.
- Structured logs: repo ops (repo_id, action, ms, error_code); import/export (counts, duration).
- Settings: max upload size, import include/exclude globs defaults, share link TTL default.

## 13) Security & Privacy

- Path validation for all file/dir ops; forbid “..”, absolute paths.
- Share links: 22+ char URL-safe tokens (≥128-bit), optional expiry; revoke by id; rate-limit public routes.
- Git tokens stored only in env or per-provider settings (no plaintext secrets in DB).

## 14) Performance Targets

- Sidebar list render ≤ 50 ms after data available; expand top-level contents ≤ 150 ms.
- Results modal first page ≤ 300 ms; infinite scroll page fetch ≤ 200 ms.
- Directory rename/move with 1k files: dry-run ≤ 500 ms; apply start within 200 ms, UI reflects via SSE.

## 15) Rollout Plan

- Phase 1: Sidebar + Results Modal + Profile.
- Phase 2: Multi-repo Git panel and basic ops (connect, status, pull/push, branches, history).
- Phase 3: Directories model + tree + DnD + live events.
- Phase 4: Import/Export jobs and share links.
- Phase 5: Dashboard groups.

Backwards compatibility
- Maintain existing artifacts flows; migrate to Repo model with a compatibility layer.

## 16) Acceptance Criteria

Sidebar & Modal
- Sections persist expanded state; Projects expand shows root directories/files; Tag click opens modal with correct results; Filters open modal with advanced filters; keyboard navigation works.

Profile
- View/Edit profile persists; logout clears token and prevents private API access until token set again.

Git
- Connect multiple repos per project and at global scope; status shows ahead/behind/dirty; pull/push/branch create/checkout succeed; history loads with recent commits.

Projects & Files
- Slug conflicts resolved via “-<shortid>” suffix; editing project fields updates immediately; directories can be created/renamed/deleted and persist when empty; multi-select drag-and-drop within and across projects works; SSE events refresh views; copy/download icons function correctly.

Import/Export
- Import from zip/files/json/git succeeds with correct structure and metadata; export to zip/json works with selection; progress events visible; job statuses queryable.

Dashboard & Sharing
- Create/rename/delete groups; drag projects into groups; share link generates and opens read-only view; expiry and revoke enforced.

## 17) Risks & Mitigations

- Git edge cases (auth, conflicts): typed error codes, clear toasts, non-destructive operations by default; documentation tips.
- Large directory operations: dry-run endpoint, chunked moves, UI progress, cancel/retry.
- Share link leakage: long tokens, optional expiry, easy revoke, limited scope (read-only).
- Directory model migration: additive; tree endpoint supports both persisted dirs and inferred ones.

## 18) Open Questions

- Should tags be formally indexed (TagIndex) now or computed on demand? Default: compute on demand; add TagIndex if performance requires.
- Global repos visibility: show under Sidebar > Projects or a dedicated “Repos” section? Default: under Projects as “Global Repos”.
- Allow per-share link “allow_export”? Default: off; behind flag.

## 19) Future Enhancements

- Multi-user accounts, RBAC, SSO (GitHub/Google), per-project permissions.
- Advanced Git: staged diffs UI, commit templates, PR creation and review inside app.
- Real-time co-editing with presence.
- Semantic search (embeddings) and recommendations.
- Automation rules: on-import tagging, link validation passes, scheduled exports.
- Public project pages with analytics, custom themes, and per-link analytics.

