---
title: "Git Architecture — Repos"
date: 2025-09-13
---

Data Model

- `Repo` table: id, name, scope (project|global), project_id?, provider, repo_url?, default_branch, visibility, last_synced_at.
- Relationships: `Project.repos` backref; `ArtifactRepo` retained for back-compat.

Filesystem Layout

- Project repos: `${DATA_DIR}/projects/<slug>/repos/<repo_id>`
- Global repos: `${DATA_DIR}/repos/<repo_id>`

API Surface

- `/api/repos` CRUD + operations: status, pull/push, branches list/create/checkout, history.
- Guarded by `GIT_INTEGRATION` flag (returns 404 when disabled).

Git Ops

- Helpers in `app/api/git_ops.py`: ensure_repo, repo_status, repo_history, list_branches, create_branch, checkout_branch, pull, push, is_dirty.
- Errors mapped to structured codes (e.g., GIT_PULL_FAIL, GIT_PUSH_FAIL).

Events & Telemetry

- Emits SSE events on repo operations (repo.created, repo.status, repo.pull, repo.push, etc.).
- Structured logs can be added where needed (repo_id, action, ms, error_code).

Rollout

- Feature-flagged via GET `/api/config`.
- Legacy artifacts UI/routes remain active when flag off.

