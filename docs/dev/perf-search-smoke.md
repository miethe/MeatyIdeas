# Search Performance Smoke — Procedure

Goal: Measure p95 latency for `/api/search` at ~10k files (FTS path).

Steps

- Start stack: `docker compose up --build`
- Seed synthetic files:
  - Inside API container, run a short script to create 10k small markdown files via the existing create file route (batching 500/tx), or write directly to DB and call indexer.
- Rebuild index to multi‑column: `POST /api/search/index/rebuild` → wait for job finished.
- Warmup: run 50 requests of `GET /api/search?q=demo&limit=20`.
- Measure: run 200 requests and capture response times; compute p95.
- Record results here (hardware, Docker version, timestamps).

Notes

- Ensure `SEMANTIC_SEARCH=0` so FTS path is isolated.
- If JSON1 is unavailable in SQLite build, tag facets are skipped in perf runs.
