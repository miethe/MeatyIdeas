# Seed Data

The API container seeds a demo project on first start when `SEED_DEMO=1`.

Seeded project: `demo-idea-stream`

Files:

- `files/ideation/plan.md` (includes Mermaid and KaTeX examples)
- `files/prd.md`

Bundle preset selects both files.

Manual seed:

`docker compose exec api python -m api.seed`

