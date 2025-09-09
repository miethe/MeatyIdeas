MeatyProjects — Idea Projects MVP

Quickstart

- Prereqs: Docker, Docker Compose v2
- Copy `.env.example` to `.env` (optional; defaults are fine)
- Run: `docker compose up --build`
- App URL: http://localhost:8080
- API base: http://localhost:8080/api
- OpenAPI: http://localhost:8080/api/docs

CLI

- From the API container: `docker compose exec api python -m cli --help`
- Create a project: `docker compose exec api python -m cli new "My Project"`
- Add a file from stdin: `echo "# Hello" | docker compose exec -T api python -m cli add --project my-project --path notes/hello.md`

Acceptance

1) API health: `curl http://localhost:8080/api/healthz`
2) Create project → add file → search
3) Attach artifacts repo → commit & push (no-op push if no remote)
4) Export bundle → zip under `/data/projects/<slug>/bundles/`
5) CLI flows as above

Docs

- See `docs/` for deploy, bundle schema, git setup, and seed details.

