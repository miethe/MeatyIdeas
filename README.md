MeatyProjects — Idea Projects MVP

Quickstart

- Prereqs: Docker, Docker Compose v2
- Copy `.env.example` to `.env` (optional; defaults are fine)
- Run: `docker compose up --build`
- App URL: http://localhost:8081
- API base: http://localhost:8081/api
- OpenAPI: http://localhost:8081/api/docs
- SSE stream: `GET /api/events/stream?project_id=<id>&token=devtoken`
- Editor: `/projects/<project_id>/edit/<file_id>` (split view, autosave, attachments)

CLI

- From the API container: `docker compose exec api python -m cli --help`
- Create a project: `docker compose exec api python -m cli new "My Project"`
- Add a file from stdin: `echo "# Hello" | docker compose exec -T api python -m cli add --project my-project --path notes/hello.md`
- Export bundle (job): `docker compose exec api python -m cli bundle_create --project my-project`
- Watch a job: `docker compose exec api python -m cli jobs-watch <job_id>`

Acceptance

1) API health: `curl http://localhost:8080/api/healthz`
2) Create project → add file → search (with snippets)
3) Attach artifacts repo → commit & push (no-op push if no remote)
4) Export bundle (job) → zip under `/data/projects/<slug>/bundles/` and SSE toasts on progress
5) Open Editor → edit content, insert wiki-links `[[Title]]`, upload attachments (stored under `/artifacts/assets/...`), see backlinks
5) CLI flows as above

Docs

- See `docs/` for deploy, bundle schema, git setup, and seed details.
