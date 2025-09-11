# Git Setup for Artifacts (MVP)

Artifacts directory: `/data/projects/<slug>/artifacts`

Connect (local):

1. POST `/api/projects/{id}/artifacts/connect` with `{ "provider": "local" }`
2. The system initializes a git repo in the artifacts directory.

Connect (remote):

1. Ensure token is configured as environment variable for provider.
2. POST with `{ "repo_url": "git@github.com:org/repo.git", "provider": "github" }`

Commit & Push:

POST `/api/projects/{id}/artifacts/commit` with `paths` and optional `message`.
If no remote is configured, push is a no-op.

Status & History (Artifacts v2):

- GET `/api/projects/{id}/artifacts/status` → ahead/behind vs. remote after a fetch.
- GET `/api/projects/{id}/artifacts/history?limit=20` → recent commits.

Pull Requests (Bundles v2):

- Set `GITHUB_TOKEN` in the API/worker environment for GitHub PR creation.
- When exporting with `push_branch=true` and `open_pr=true`, a PR is opened from `bundle/<slug>/<ts>` to the default branch if the remote is GitHub.
