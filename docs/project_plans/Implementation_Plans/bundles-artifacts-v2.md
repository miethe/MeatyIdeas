# Implementation Plan — Bundles v2 & Artifacts v2 (2025-09-11)

Scope: Implement PRD EPIC C (Bundles v2) and EPIC D (Artifacts v2) server/worker features with basic GitHub integration for branch/PR. Keep UI minimal; expose APIs, worker jobs, and events ready for frontend wiring.

Goals

- Bundles v2: roles in manifest, verify checksums, job-based export, optional branch push + PR, bundle history endpoints.
- Artifacts v2: status (ahead/behind), recent commit history, commit with optional push, typed errors.
- GitHub adapter: open PR when `open_pr=true` and token present.

Design Decisions

- Persist bundles in DB with status enum and metadata. Update status via worker job lifecycle events.
- Keep bundle zip contents as selected `files/**` plus `bundle.yaml`. Artifacts repo push branch contains the same (no zip), targeting `bundle/<slug>/<ts>`.
- Checksums: SHA-256 of each selected file included in manifest; verification reads from the zip to compute actual hash.
- Git status: compute ahead/behind via `git rev-list --left-right --count` after a `fetch --prune`.
- Provider adapters: in-process minimal GitHub REST using token from env; no OAuth flow.

API Changes

- POST `/api/projects/{id}/export/bundle` body:
  - `selection.file_ids[]`, optional `selection.tags[]`, optional `selection.roles{file_id: role}`
  - `include_checksums` (bool, default true)
  - `push_branch` (bool), `open_pr` (bool)
  - Returns `{ job_id }`
- GET `/api/bundles/{id}` → `{ id, project_id, status, created_at, output_path, branch, pr_url, error, metadata }`
- GET `/api/projects/{id}/bundles` → list bundles (latest first)
- POST `/api/bundles/{id}/verify` → `{ ok: boolean, issues[] }`
- GET `/api/projects/{id}/artifacts/status` → `{ provider, repo_url, branch, ahead, behind, last_sync }`
- POST `/api/projects/{id}/artifacts/commit` body: `{ paths[], message, push:true }` → `{ commit_sha, pushed }`
- GET `/api/projects/{id}/artifacts/history?limit` → recent commits

Data Model

- Extend `bundles` with: `status` (queued|running|completed|failed), `error` (text), `metadata` (json), `branch` (str), `pr_url` (str).
- If table exists without columns (SQLite), add columns at startup via lightweight migration.

Worker

- Expand `bundle_jobs.export` to accept: `include_checksums`, `push_branch`, `open_pr`, `roles{}`. Update DB row status and publish events: `bundle.started`, `bundle.completed`, `bundle.failed`, `bundle.branch_pushed`, `bundle.pr_opened`.
- Implement helper to prepare artifacts branch: checkout from default branch, write `bundle.yaml` + copy selected files under `files/**`, commit, push.

Git Ops

- Add functions: `repo_status(path)`, `repo_history(path, limit)`. Enhance `commit_and_push(path, rel_paths, message, push=True)` to return `{ commit_sha, pushed }`.

Settings

- Add `github_token` in API settings from `GITHUB_TOKEN` env for PR creation.

Risks & Mitigations

- No Alembic: add defensive column creation at startup; log warnings if failed.
- Git auth: surface typed errors `GIT_AUTH_FAILED`, `NETWORK_ERROR`, `NOT_CONNECTED`.

Deliverables

1. DB/model/schema updates.
2. New/updated routers for bundles and artifacts.
3. Worker job updates for export and branch/PR.
4. Git ops helpers for status/history.
5. Minimal docs update (GIT setup + API notes).

Validation

- Local smoke: create project → add files → connect local repo → commit without push → export bundle with `push_branch=false` → verify → connect GitHub remote (optional) → export with `push_branch=true, open_pr=false` (offline OK).

