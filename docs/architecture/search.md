# Search Architecture

Overview

The app uses SQLite FTS5 for full‑text search over project files. Search 2.0 introduces multi‑column indexing, filters, saved searches, and an admin rebuild job.

Schema

- FTS table: `search_index` (virtual, FTS5)
  - Legacy: `(file_id UNINDEXED, content_text)`
  - Current: `(file_id UNINDEXED, title, body, path)`
- Saved searches: `saved_searches(id, name, owner, query, filters json, created_at)`

Indexing

- On create/update/delete, the indexer updates the FTS row for the file.
- `index_file(conn, file_id, content_text, title?, path?)` writes to the appropriate schema (auto‑detects columns).

Query

- Endpoint: `GET /api/search` with `q`, `tag` (repeatable), `status`, `project_id`, `sort`, `limit`, `offset`.
- Ranks using `bm25(search_index)`; default sort by score + recency, optional sort by `updated_at` only.
- Snippets via `snippet(search_index, col_ix, '[', ']', '...', 8)` using `body` when available, else legacy column.
- Facets are computed server‑side when needed via JSON1:
  - `SELECT je.value, COUNT(1) FROM json_each(f.tags) GROUP BY je.value` across matched rows.

Rebuild Job

- Endpoint: `POST /api/search/index/rebuild` enqueues `worker.jobs.search_jobs.reindex_all`.
- The job drops and recreates the multi‑column FTS table, then reindexes all files.

Flags & Limits

- `SEMANTIC_SEARCH` (placeholder, off by default) for future vector search.
- `SEARCH_MAX_LIMIT` caps page size to prevent expensive queries.

Key Files

- API router: `app/api/routers/search.py`
- Indexer: `app/api/search.py`
- Job: `app/worker/jobs/search_jobs.py`
- Model: `app/api/models.py:SavedSearch`
- FE: `app/frontend/components/search-command.tsx`

