# Deploy (Docker Compose)

Prereqs: Docker, Docker Compose v2.

- Copy `.env.example` to `.env` and adjust if needed.
- Run: `docker compose up --build`
- Proxy serves on http://localhost:8080
- API docs at http://localhost:8080/api/docs

Data layout:

- `/data/projects/<slug>/files/**.md`
- `/data/projects/<slug>/artifacts/` (git submodule or linked repo)
- `/data/projects/<slug>/bundles/` (zip outputs)

Env vars:

- `DATA_DIR` default `/data`
- `TOKEN` default `devtoken` (single-user)
- `REDIS_URL` default `redis://redis:6379/0`
- `OTEL_EXPORTER_OTLP_ENDPOINT` default `http://otel-collector:4317`

