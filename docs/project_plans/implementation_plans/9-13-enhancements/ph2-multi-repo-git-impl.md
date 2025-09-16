---
title: "Phase 2 — Multi‑Repo Git Implementation Plan"
owner: Lead Architect/PM
status: Ready for Development
date: 2025-09-13
---

Overview

Implements PRD Phase 2: multi-repo Git integration with connect, status, pull/push, branches (list/create/checkout), and history for both project-scoped and global repos. This plan maps requirements to concrete changes across DB, API, workers, frontend, tests, and docs, with explicit file paths and acceptance criteria.

Goals & Acceptance

- Multiple repos per project and global scope. CRUD + operations succeed and surface typed errors.
- Status shows branch, ahead/behind, dirty; history lists recent commits.
- Frontend Git Panel enables connect, status, pull/push, branch manage across providers (local, GitHub via token) behind `GIT_INTEGRATION` flag.
- Backward-compatible with existing `artifacts` flow until migration completes.

Current State (Reference)

- Single artifacts repo per project via `ArtifactRepo` and `artifacts` directory.
  - Models: app/api/models.py:79
  - API: app/api/routers/artifacts.py:1
  - Git helpers: app/api/git_ops.py:1 (ensure_repo, commit_and_push, repo_status, repo_history)
  - FE: app/frontend/components/artifacts-panel.tsx:1

Scope (In/Out)

- In scope: New `repos` model/table; `/api/repos` endpoints; FE Git Panel; typed errors; logs; minimal provider support (local, GitHub via env token); migration script from ArtifactRepo → Repo.
- Out of scope: Advanced diffs/PR UI, merge conflict resolution UI, OAuth token storage; worker offloading for all git ops (optional jobs scaffold only).

Data Model & Storage

- New SQLAlchemy model `Repo` (replaces/extends `ArtifactRepo`). Fields per PRD:
  - id (uuid), name (str), scope ("project"|"global"), project_id (nullable when global), provider (enum: github|gitlab|bitbucket|local), repo_url (nullable for local), default_branch (str, default "main"), visibility (enum), last_synced_at (datetime nullable).
- File changes
  - app/api/models.py: add `Repo` class; keep `ArtifactRepo` temporarily; add `Project.repos` relationship.
- Migrations
  - Introduce Alembic if not present; add migration to create `repos` table and enums; optional data-copy migration to seed new table from existing `artifacts` rows (scope=project, name="artifacts").
- On-disk layout
  - Project repos: `${DATA_DIR}/projects/<slug>/repos/<repo_id>`
  - Global repos: `${DATA_DIR}/repos/<repo_id>`
  - Keep legacy `${DATA_DIR}/projects/<slug>/artifacts` for compatibility while `ArtifactRepo` exists.

Backend Services & Adapters

- Generalize `git_ops` to operate on arbitrary repo paths and add:
  - list_branches(path) → [{name,is_current}]
  - create_branch(path, name, checkout=True)
  - checkout_branch(path, name)
  - pull(path)
  - push(path)
  - is_dirty(path) → bool
  - repo_root(scope, project_slug, repo_id) helper
- Provider behavior
  - Local: `repo_url` None → `Repo.init` and no remote.
  - GitHub: read token from `GITHUB_TOKEN` env; use `origin` remote with token if provided; otherwise attempt SSH.
- Error taxonomy: raise `GitError` with codes: GIT_AUTH, GIT_CLONE_FAILED, GIT_REMOTE_FAILED, GIT_PULL_FAIL, GIT_PUSH_FAIL, NETWORK_ERROR.

API Endpoints (new router)

- File: app/api/routers/repos.py
- Routes (authorized via `X-Token`, gated by `settings.git_integration`):
  - POST /api/repos { scope, project_id?, provider, name, repo_url?, visibility, default_branch? } → 201 {id,...}
  - GET /api/repos?project_id? → list for project or all globals when no project_id
  - GET /api/repos/{id}/status → { branch, ahead, behind, dirty }
  - GET /api/repos/{id}/branches → [{ name, is_current }]
  - POST /api/repos/{id}/branches { name } → 201
  - POST /api/repos/{id}/checkout { name } → 200
  - POST /api/repos/{id}/pull → 200
  - POST /api/repos/{id}/push → 200
  - GET /api/repos/{id}/history?limit=50 → list commits
  - DELETE /api/repos/{id} → 204 (optional: delete on-disk repo folder when confirmed)
- Schemas
  - app/api/schemas.py: add `RepoCreate`, `RepoOut`, `RepoStatus`, `Branch`, `RepoList`.
- Events & logs
  - Publish SSE `repo.status` on status/pull/push; structured logs include repo_id, action, ms, error_code.

Worker Jobs (optional, flag `GIT_JOBS`)

- Scaffold long ops as jobs for future: `repo_pull(repo_id)`, `repo_push(repo_id)` in app/worker/jobs/git_jobs.py, publishing events and reusing git_ops helpers.
- API can call jobs when flag on; otherwise perform inline with short timeout and error handling.

Frontend — Git Panel

- New components
  - app/frontend/components/repos/repos-panel.tsx: lists repos (cards), connect dialog, status, pull/push, branch dropdown, history.
  - app/frontend/components/repos/repo-connect-dialog.tsx
- Project page
  - app/frontend/app/projects/[project]/page.tsx: include `ReposPanel` when `config.GIT_INTEGRATION`.
- Global repos (MVP)
  - Optional tab in Sidebar Projects as "Global Repos" listing; or shown within project panel when scope==global.
- API hooks
  - Add fetchers in app/frontend/lib/api.ts: `getRepos`, `createRepo`, `getRepoStatus`, `pullRepo`, `pushRepo`, `getBranches`, `createBranch`, `checkoutBranch`, `getHistory`.
- UX behavior
  - Disabled buttons while loading; toasts on error with typed codes; branch dropdown reflects current branch; history shows recent commits.

Configuration & Flags

- app/api/routers/config.py returns `GIT_INTEGRATION` (already present), ensure wired to env.
- Docker: `apt-get install -y git` already in API Dockerfile; confirm present in worker.
- Env: support `GITHUB_TOKEN` in API/worker containers (document).

Testing Plan

- Unit
  - git_ops: branches, checkout, pull/push error mapping, status dirty detection.
- API integration (pytest)
  - Create/list/delete repos; status with and without remote; branches list/create/checkout; pull/push error codes.
  - History returns recent commits; limits respected.
- FE component/e2e
  - Connect → status → branch create/checkout → pull/push smoke path on project page.
- Performance smoke
  - Status p95 ≤ 2s on non-huge repo; tracked in `docs/dev/perf-search-smoke.md` style doc (add Git section).

Documentation Deliverables

- User: `docs/user/git.md` — connecting repos, tokens, common errors.
- Developer: `docs/architecture/git.md` — data model, on-disk layout, API, error taxonomy, jobs, flags.
- Update: `README.md` quickstart to mention `GIT_INTEGRATION` and tokens.

Rollout & Backward Compatibility

- Keep artifacts endpoints/UI operational; mark as legacy in UI when `repos` exist.
- Data migration script: copy ArtifactRepo → Repo; on first connect via new API, show deprecation toast.
- Rollout flags:
  - Stage 1: `GIT_INTEGRATION=1` in staging, monitor logs; Stage 2: enable in production; backout by flipping flag.

Task Breakdown (Trackable)

1) DB — Add Repo model and migration
2) API — `/api/repos` router and schemas
3) Services — Extend `git_ops` helpers
4) Worker — Optional `git_jobs` for pull/push
5) FE — Repos Panel components and hooks
6) FE — Wire into project page + flags
7) Tests — Unit/API/FE + perf smoke
8) Docs — User + Architecture + README
9) Migration — Data copy ArtifactRepo → Repo

Acceptance Checklist

- Create two repos (one local, one GitHub) on a project; list shows both; status reports branch/ahead/behind/dirty.
- Create and checkout a new branch; history updates accordingly.
- Pull/push succeed or error with typed codes; UI surfaces toasts; logs include action + ms.
- Legacy artifacts flow remains functional until removed; deprecation notice visible when new repos exist.

Key File References (to be added/modified)

- app/api/models.py: add `Repo` model and `Project.repos`
- app/api/git_ops.py: extend helpers
- app/api/routers/repos.py: new routes
- app/api/schemas.py: add Repo Pydantic models
- app/api/routers/config.py: ensure flag returned
- app/worker/jobs/git_jobs.py: long-op jobs (optional)
- app/frontend/components/repos/*.tsx: new UI
- app/frontend/app/projects/[project]/page.tsx: mount panel
- docs/user/git.md, docs/architecture/git.md, README.md

