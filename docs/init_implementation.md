I’ve read the PRD and scaffolded the full monorepo with a runnable MVP implementation. Next steps on your side: run docker compose and try the flows below.

What I delivered

Monorepo: API (FastAPI), Worker (RQ/Redis), Frontend (Next.js), CLI (Typer), Docker Compose, and docs
SQLite + FTS5 search; Agent Bundle export (.zip + bundle.yaml)
Git ops for artifacts: connect/init repo, commit, push (no-op if no remote)
Token auth via X-Token (defaults to devtoken), health check at /api/healthz
OTel collector stub + JSON structured logging
Seed demo project with two Markdown files
How to run

Copy env: MeatyProjects/.env.example → MeatyProjects/.env (optional; defaults OK)
Start stack: in MeatyProjects, run: docker compose up --build
App: http://localhost:8080 (proxy routes to web and /api)
API docs: http://localhost:8080/api/docs
Health: curl http://localhost:8080/api/healthz
CLI quickstart

Help: docker compose exec api python -m cli --help
Create project: docker compose exec api python -m cli new "My Project"
Add file from stdin:
echo "# Hello" | docker compose exec -T api python -m cli add --project my-project --path notes/hello.md
Search:
docker compose exec api python -m cli search "Hello"
Connect artifacts:
docker compose exec api python -m cli artifacts-connect --project my-project
Bundle create:
docker compose exec api python -m cli bundle-create --project my-project
Acceptance flows to verify

API healthz:
curl -H "X-Token: devtoken" http://localhost:8080/api/healthz
Create → add file → search:
Use CLI commands above; search should return file_id hits.
Artifacts repo:
POST /api/projects/{id}/artifacts/connect (provider=local) then commit:
POST /api/projects/{id}/artifacts/commit with paths; response shows committed/pushed.
Export bundle:
POST /api/projects/{id}/export/bundle with file_ids; zip at /data/projects/<slug>/bundles/<slug>-<ts>.zip
CLI:
new + add via stdin succeed; nonzero exit on obvious errors
Key files

Compose and config:
MeatyProjects/docker-compose.yml
MeatyProjects/.env.example
MeatyProjects/docker/Caddyfile
MeatyProjects/ops/otel-collector-config.yaml
Backend (FastAPI):
MeatyProjects/app/api/api/main.py
MeatyProjects/app/api/api/models.py
MeatyProjects/app/api/api/schemas.py
MeatyProjects/app/api/api/db.py
MeatyProjects/app/api/api/search.py
MeatyProjects/app/api/api/git_ops.py
MeatyProjects/app/api/api/bundle.py
MeatyProjects/app/api/api/routers/projects.py
MeatyProjects/app/api/api/routers/files.py
MeatyProjects/app/api/api/routers/search.py
MeatyProjects/app/api/api/routers/artifacts.py
MeatyProjects/app/api/api/routers/bundles.py
MeatyProjects/app/api/api/seed.py
Worker (RQ/Redis):
MeatyProjects/app/worker/worker/worker.py
MeatyProjects/app/worker/worker/jobs/git_jobs.py
MeatyProjects/app/worker/worker/jobs/bundle_jobs.py
CLI (Typer):
MeatyProjects/app/cli/main.py
MeatyProjects/app/cli/config.py
Frontend (Next.js App Router):
MeatyProjects/app/frontend/Dockerfile
MeatyProjects/app/frontend/app/page.tsx
MeatyProjects/app/frontend/package.json
Docs:
MeatyProjects/README.md
MeatyProjects/docs/DEPLOY.md
MeatyProjects/docs/BUNDLE_SCHEMA.md
MeatyProjects/docs/GIT_SETUP.md
MeatyProjects/docs/SEED.md
Notes and assumptions

Token auth enforced for all API routes except /api/healthz; send header X-Token: devtoken (configurable via .env).
FTS5 index is updated on file create/update. Ranking uses FTS defaults; heading/body weighting can be enhanced later.
Artifacts repo uses a local git repo under /data/projects/<slug>/artifacts. Remote push is attempted only if an origin remote exists; otherwise push is a no-op (per acceptance).
Agent bundle excludes repo contents (PRD default), includes bundle.yaml and selected files with sha256 checksums.
OTel collector runs and logs spans to console (basic stub). Full instrumentation can be expanded.
Manual next steps (optional)

If you want true submodule semantics for artifacts, I can wire git submodule attach and status reporting next.
Add more frontend features (split editor/preview, outline, artifacts panel UI) once API is validated in your environment.
Set up GitHub Actions CI for lint/test if desired.
Want me to add a simple E2E script to exercise “create → add file → search → connect → commit → export” against a running stack?