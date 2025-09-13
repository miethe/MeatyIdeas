# Searching

Find the right docs fast using full‑text search with filters, highlighted snippets, and saved searches.

Basics

- Open the Command Palette with ⌘K / Ctrl+K or `/` and start typing.
- Results show titles, paths, and a highlighted snippet of the match.

Typed Filters

- `project:<slug>`: filter by project.
- `tag:<name>`: filter by tag. Repeat for multiple tags.
- `status:<idea|discovery|draft|live>`: filter by project status.
- `sort:updated`: sort by last update time (default is rank).

Examples

- `deployment tag:infra` → files mentioning “deployment” with tag `infra`.
- `roadmap status:draft sort:updated` → draft items sorted by recency.

Saved Searches

- In the palette, open “Saved Searches” to run a saved query.
- Use “Save current search…” to persist the current query + filters.
- CLI equivalents:
  - `ideas search-saved list`
  - `ideas search-saved create --name "Infra" --query deploy --tag infra`
  - `ideas search-saved delete <id>`

Admin Rebuild (advanced)

- If the index falls out of sync, an admin can rebuild it: `POST /api/search/index/rebuild`.
- The rebuild runs in the background as a job; check via `GET /api/jobs/{id}` or the Jobs watcher in the CLI.
