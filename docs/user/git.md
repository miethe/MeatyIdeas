---
title: "Repos (Git) — User Guide"
date: 2025-09-13
---

Overview

Connect one or more Git repositories to a project (or globally) to pull/push files and view branch status/history. This feature is gated by the `GIT_INTEGRATION` flag.

Basics

- Connect: In a project, open the Repos panel and click "Connect Local" to initialize a local repo. For remotes (e.g., GitHub), use the API with a `repo_url` and set `GITHUB_TOKEN` in the API environment.
- Status: Shows branch, ahead/behind vs origin, and whether the working tree is dirty.
- Branches: Create and checkout branches via the API; UI support is basic in this release.
- Pull/Push: Pull latest from origin or push your commits. Errors are surfaced with typed codes (e.g., GIT_AUTH).

API Quick Reference

- POST `/api/repos` { scope, project_id, provider, name, repo_url?, visibility, default_branch? }
- GET `/api/repos?project_id=<id>`
- GET `/api/repos/{id}/status`
- GET `/api/repos/{id}/branches`
- POST `/api/repos/{id}/branches` { name }
- POST `/api/repos/{id}/checkout` { name }
- POST `/api/repos/{id}/pull`
- POST `/api/repos/{id}/push`
- GET `/api/repos/{id}/history?limit=50`

Notes

- For GitHub, set `GITHUB_TOKEN` in the API container for authenticated operations when using HTTPS URLs.
- Legacy Artifacts panel remains available when `GIT_INTEGRATION=0`.

