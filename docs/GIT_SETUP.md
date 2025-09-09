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

