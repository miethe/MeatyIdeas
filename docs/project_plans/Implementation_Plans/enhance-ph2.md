Here’s the plan I followed and what I shipped. Highlights: PRD artifacts generated, search upgraded (snippets/filters), SSE events added, bundle export moved to a job with status API + UI toasts, seed indexing improved, CLI updated.

What I Implemented

PRD Aggregation: docs/PRD.md created (aggregates docs/project_plans/PRDs/init-prd.md + enhancement addendum). Decision captured in docs/decisions/ADR-001-prd-source.md.
Roadmap & Traceability: docs/roadmap.mdx (Epics → Stories → Acceptance), docs/traceability.md (requirements → implementation/tests).
Search 2.0 (MVP):
Snippets + filters endpoint: app/api/routers/search.py now returns {file_id,title,path,project_id,snippet,score} with q, project_id, tag, status, limit, offset. Uses SQLite FTS5 snippet() + bm25.
Frontend command palette now consumes richer results: app/frontend/components/search-command.tsx.
Seeded docs now indexed: app/api/seed.py renders and indexes seeded files.
SSE Events:
Model: Event in app/api/models.py.
Publisher util: app/api/events_pub.py.
Stream router: app/api/routers/events.py exposes GET /api/events/stream?project_id=...&token=... (query param auth, because browsers can’t send headers with EventSource).
Wired router in app/api/main.py.
Frontend SSE consumer: app/frontend/components/projects/project-events.tsx, embedded in project page app/frontend/app/projects/[project]/page.tsx. Shows toasts for bundle started/completed and commit started/completed/failed.
Bundles as Jobs:
API enqueues RQ job and publishes events: app/api/routers/bundles.py now returns {"job_id": ...} with 202.
Worker publishes start/complete events: app/worker/jobs/bundle_jobs.py.
Jobs status API: app/api/routers/jobs.py (GET /api/jobs/{id} returns status and result).
Artifacts Events:
Publish events on connect/commit: app/api/routers/artifacts.py.
CLI Updates:
Bundle now creates a job and polls status: app/cli/__main__.py bundle_create.
Added jobs_watch <id> to watch jobs.
Docs & Test:
README updated with SSE, job export, CLI flows: README.md.
Added basic search test: app/api/tests/test_search.py.
Key File References

Aggregated PRD: docs/PRD.md:1
ADR: docs/decisions/ADR-001-prd-source.md:1
Roadmap: docs/roadmap.mdx:1
Traceability: docs/traceability.md:1
API main: app/api/main.py:1
Search Router: app/api/routers/search.py:1
Events Publisher: app/api/events_pub.py:1
SSE Stream Router: app/api/routers/events.py:1
Bundles Router (job enqueue): app/api/routers/bundles.py:1
Jobs Router: app/api/routers/jobs.py:1
Worker Bundle Job (events): app/worker/jobs/bundle_jobs.py:1
Artifacts Events: app/api/routers/artifacts.py:1
Seed Enhancements: app/api/seed.py:1
Frontend SSE client: app/frontend/components/projects/project-events.tsx:1
Project Page SSE hookup: app/frontend/app/projects/[project]/page.tsx:1
Search UI: app/frontend/components/search-command.tsx:1
CLI: app/cli/__main__.py:1
README: README.md:1
Test: app/api/tests/test_search.py:1
How to Run

Prereqs: Docker/Podman. This repo expects Docker Compose in normal use; the provided docker-compose.yml coordinates api, worker, frontend, redis, and proxy (Caddy).
Quickstart:
Copy .env.example to .env (defaults okay).
Start everything: docker compose up --build
UI: http://localhost:8081
API: http://localhost:8081/api
OpenAPI: http://localhost:8081/api/docs
SSE stream: GET /api/events/stream?project_id=<id>&token=devtoken
CLI (inside API container):
docker compose exec api python -m cli --help
New: docker compose exec api python -m cli new "My Project"
Add: echo "# Hello" | docker compose exec -T api python -m cli add --project my-project --path notes/hello.md
Bundle (job): docker compose exec api python -m cli bundle_create --project my-project
Watch job: docker compose exec api python -m cli jobs-watch <job_id>
Smoke Checklist

API health: curl -H "X-Token: devtoken" http://localhost:8081/api/healthz → {"status":"ok"}
Projects → Create → Add file → Search:
Search returns snippet + metadata via /api/search?q=....
Command palette uses the enriched search results.
Artifacts:
Connect repo via UI or POST /api/projects/{id}/artifacts/connect.
Commit emits SSE toasts (started/completed/failed) on project page.
Bundles:
Export triggers job (202 + job_id), SSE toasts for started/completed.
Zip at /data/projects/<slug>/bundles/.
SSE:
Project page shows toasts on bundle/commit events.
Tests:
Inside API container: pytest -q (search smoke test included).
Notes & Decisions

SSE authentication: EventSource cannot send headers; stream endpoint accepts token query param and is included in the UI streamer.
Search filters: Tag filter uses a pragmatic LIKE over JSON text for MVP. Can be replaced by proper JSON functions if needed.
Error schema: Errors stay consistent with the repo pattern (detail={"code":...}) for now; can be wrapped to {error:{...}} per PRD in a follow-up.
Files move endpoint, wiki-links/backlinks indexing and rename rewrite are out of this pass; if you want I can add minimalist link extraction + backlinks and a move route next.
Optional Next Steps

Add files.move endpoint and link/backlink model with automatic link rewrite on rename.
Persist bundle/job history in DB and add UI for bundle history.
Saved searches + FE command palette typed filters (tag:, status:) persisted.
SSE FE enhancements for progress bars and job detail view.
CI workflow for lint+test+build and GitHub PR integration stub.
If you want, I can run a local smoke (build containers) once Docker Compose is available in your environment, or proceed to implement links/backlinks and the move endpoint.