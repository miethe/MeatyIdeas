# Requirements Traceability

This document maps PRD requirements to implementation and tests.

- API health endpoint
  - Requirement: PRD 6/Deployment; Deliverable Checklist
  - Impl: `app/api/main.py:/api/healthz`
  - Test: `app/api/tests/test_health.py`

- Projects CRUD
  - Requirement: PRD 5/Projects
  - Impl: `app/api/routers/projects.py`
  - Test: add API tests (pending)

- Files CRUD + Markdown render
  - Requirement: PRD 5/Files
  - Impl: `app/api/routers/files.py`
  - Test: add API tests (pending)

- Search 2.0 (FTS + snippets + filters + saved)
  - Requirement: PRD Epic B — Search 2.0
  - Impl: `app/api/routers/search.py` (enhanced), `app/api/search.py` (indexer), `app/worker/jobs/search_jobs.py` (reindex job), `app/api/models.py:SavedSearch`
  - FE: `app/frontend/components/search-command.tsx` (typed filters, snippets, saved)
  - CLI: `app/cli/__main__.py` (filters, saved subcommands)
  - Tests: `app/api/tests/test_search.py`, `app/api/tests/test_search_advanced.py`
  - Docs: `docs/user/searching.md`, `docs/architecture/search.md`

- Bundles export
  - Requirement: PRD 5/Bundles; Epic C
  - Impl: `app/api/routers/bundles.py`, `app/api/bundle.py`, `app/worker/jobs/bundle_jobs.py`
  - Test: CLI smoke + API tests (pending)

- Artifacts connect/commit
  - Requirement: PRD 5/Artifacts; Epic D
  - Impl: `app/api/routers/artifacts.py`, `app/api/git_ops.py`, `app/worker/jobs/git_jobs.py`
  - Test: API tests (pending)

- Activity & SSE
  - Requirement: PRD Epic F
  - Impl: `app/api/routers/events.py` (planned), worker event publishing (planned)
  - Test: SSE smoke (pending)

- CLI commands
  - Requirement: PRD 5/CLI
  - Impl: `app/cli/__main__.py`
  - Test: CLI smoke (pending)
