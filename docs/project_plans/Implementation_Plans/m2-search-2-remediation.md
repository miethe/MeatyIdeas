# M2 — Search 2.0 Remediation Plan (Applied)

Context

Reports showed two issues after initial rollout:
- Search returned no results in the UI regardless of keywords.
- Saved Searches UI was not visible/usable.

Root Causes

- Saved searches were only shown when at least one existed, which hid the “Save current search” affordance; users had no way to create the first one.
- Search endpoint used JSON1-only SQL for tag filters/facets. On environments without the SQLite JSON1 extension, any query using tag filters would fail silently in the UI and appear as “No results”.
- The command palette did not support the `project:` token, while the API only accepted `project_id`. This made project filtering from the palette awkward.
- The palette masked API errors as “No results” and required ≥2 characters, making diagnosis harder.

Fixes Implemented

- Saved searches UX
  - Always render a “Saved Searches” section with a visible “Save current search…” item even when there are no saved searches.
  - File: `app/frontend/components/search-command.tsx:1`

- Tag filters JSON1 fallback
  - Auto-detect JSON1 availability at API startup and transparently fall back to a LIKE-based filter for tags if JSON1 is missing.
  - Also skip tag facet computation when JSON1 is unavailable (facets remain empty, results unaffected).
  - File: `app/api/routers/search.py:1`

- Project slug filter
  - Added `project_slug` parameter to `GET /api/search` and wired `project:<slug>` typed token in the palette to `project_slug`.
  - Files: `app/api/routers/search.py:1`, `app/frontend/components/search-command.tsx:1`

- Palette resilience and quality-of-life
  - Show “Search error” when the API call fails (instead of generic “No results”).
  - Lowered minimum query length from 2 → 1 character to improve testability.
  - Files: `app/frontend/components/search-command.tsx:1`

- Documentation updates
  - Added `project:` token to user docs; documented new `project_slug` API parameter.
  - Files: `docs/user/searching.md:1`, `docs/architecture/search.md:1`

Validation Steps

- Backend
  - `curl -H 'X-Token: devtoken' \
    'http://localhost:8081/api/search?q=demo&limit=5'` → returns results with snippets.
  - `curl -H 'X-Token: devtoken' \
    'http://localhost:8081/api/search?q=demo&project_slug=demo-idea-stream'` → filtered results.
  - `curl -H 'X-Token: devtoken' \
    'http://localhost:8081/api/search/saved'` → list saved searches.
  - `curl -H 'X-Token: devtoken' -X POST \
    -H 'Content-Type: application/json' \
    -d '{"name":"Quick","query":"demo","filters":{"status":"idea"}}' \
    'http://localhost:8081/api/search/saved'` → 201 with id.

- Frontend
  - Open command palette (⌘K) → type `demo` → see matching files with highlighted snippets.
  - Type `project:demo-idea-stream demo` → see filtered results.
  - Open “Saved Searches” → use “Save current search…”, then confirm it appears and is runnable.

- Optional migration
  - Run `POST /api/search/index/rebuild` to switch to the multi‑column FTS layout and reindex all files for improved snippet quality and future weighting.

Notes

- Existing databases remain compatible; multi‑column FTS is adopted when the rebuild job is executed.
- Tag facets require JSON1; counts are omitted when unavailable, but results and filters continue to work.

