---

title: "MeatyProjects — Next Iteration PRD (World-Class Project Planning Tool)"
version: 1.0
status: Ready for Implementation
date: 2025-09-11
-----------------------------------------------------------------------------------

## 1) Purpose & Vision

**Purpose.** Evolve MeatyProjects from a solid Markdown+Git ideation capture tool into a **world-class project planning system**: a beautiful, fast, dark-mode app that turns messy sparks into structured, versioned, discoverable knowledge—then ships curated bundles to agents and repos with audit-grade reliability.

**Vision.** “**Capture → Connect → Curate → Ship**.” Delightful editing, rich linking/backlinks, facet+semantic search, opinionated bundle workflows, first-class Git artifacts, and automation-friendly API/CLI. Design for solo builders now; scale to small teams later without regressing DX.

---

## 2) Scope

### In scope (this iteration)

* UI overhaul (shadcn/radix): polished dark theme, project catalog grid, item tiles, modal viewer.
* **Rich Editor** (split view, slash commands, templates), **attachments**, **wiki-links**, **backlinks**.
* **Search 2.0**: filters, highlighted snippets, saved searches; optional semantic.
* **Bundles v2**: selection wizard, roles, branch push, PR creation.
* **Artifacts v2**: status, history, commit/push UX; provider adapters (GitHub first).
* **Activity & Notifications**: events table, SSE stream, toasts; job progress.
* **API/CLI upgrades**, migrations, telemetry, and stricter security.

### Out of scope (for this iteration)

* Live multi-user co-editing, SSO/RBAC, billing.
* External plugin marketplace.
* Mobile apps (read-only PWA acceptable later).

---

## 3) Users & JTBD

* **Builder/Founder/Tech Lead.** Capture ideas → evolve into PRDs/RFCs → ship bundles to agents/repo.
* **Automation/Agent.** Create/update/search/export via API/CLI, watch jobs, open PRs.
* **Reviewer (future).** Review diffs, comment, approve bundles.

---

## 4) Goals & Success Metrics

* p50 **Capture→Export** ≤ **2 min** with wizard (seeded project).
* **Search** p95 ≤ **200 ms** @ 10k files (FTS path).
* **Editing satisfaction** ≥ **4/5**; **error rate** < **1%**.
* **Artifacts ops** success ≥ **95%**; errors typed.
* **UI performance**: first catalog paint after data ≤ **200 ms**; modal open ≤ **100 ms**.

---

## 5) Current State (baseline)

* **API (FastAPI)**: projects, files, search (SQLite FTS5), artifacts (Git), bundles (ZIP), token auth.
* **Data**: SQLite, SQLAlchemy models for Project/File/ArtifactRepo/Bundle; virtual `search_index`.
* **Worker**: RQ + Redis skeleton; bundle jobs stub.
* **Frontend**: Next.js App Router, React Query, shadcn/radix, dark mode, global command palette; projects & files views; modal Markdown viewer (Mermaid + basic ToC).
* **CLI**: Typer with project create, file add, search, artifacts connect, bundle create.
* **Infra**: Docker Compose (API, FE, worker, Redis, Caddy), optional OTel collector.

---

## 6) Product Epics & Requirements

### EPIC A — Rich Editor & Knowledge Graph

**User value.** Turn Markdown into a connected knowledge system: wiki-links, backlinks, file tree, attachments, reliable preview.

**A.1 Features**

* Full-page **Editor**: split view, slash-menu (headings, callouts, tables, fenced code), Mermaid, KaTeX, YAML front-matter, local draft autosave.
* **Wiki-links** `[[Some Doc]]` with autocomplete; **backlinks** sidebar; graceful link resolution on rename/move.
* **File tree** (folders), quick rename/move; **templates**: PRD, ADR, RFC, Ideation Canvas, Prompt Card/PBOM.
* **Attachments** upload UI → stored under `/artifacts/assets/<project>/...` with sanitized paths; inserted as `![alt](relative/path)`; preview inline.
* **Link integrity**: detect broken links; batch fix on rename.

**A.2 API**

* `PATCH /api/files/{id}` partial updates (title/path/front\_matter/tags/content\_md).
* `POST /api/files/{id}/move` → updates path + link targets; returns changes summary.
* `GET /api/projects/{id}/files/tree` (hierarchy).
* `GET /api/files/{id}/links` (outgoing); `GET /api/files/{id}/backlinks`.
* `POST /api/projects/{id}/attachments/upload` → stores under `artifacts/assets/…` and returns relative URL + hash.

**A.3 Data model**

* `links`(id, project\_id, source\_file\_id, target\_file\_id nullable, target\_path, link\_text, created\_at).
* Extend `files`: `hash` (sha256 of content), `word_count` (int).
* Optional `templates` table (seeded, read-only in this phase).

**A.4 Acceptance**

* Creating `[[New Doc]]` prompts creation or link; backlinks list shows referencing files.
* Renaming a file updates links or flags conflicts; index refreshes.
* Image upload places under `/artifacts/assets/...`; renders in preview and modal.
* Mermaid/math render; malformed graph falls back to code block (no crash).

---

### EPIC B — Search 2.0 (Filters, Snippets, Semantic)

**User value.** Find the right doc fast; remember useful queries; optionally use semantic.

**B.1 Features**

* FTS with highlighted snippets; filters: project, tag, status; sort by `updated_at`.
* Saved searches (per user); command palette supports typed filters `tag:infra status:draft`.
* Optional semantic: background embeddings (worker) + pgvector (if Postgres) behind feature flag.

**B.2 API**

* `GET /api/search?q=&project_id=&tag=&status=&limit=&offset=` → `{ file_id, title, path, snippet, score, highlights[], facets{} }`.
* `POST /api/search/index/rebuild` (admin) + incremental index on file changes.
* `GET/POST /api/search/saved`.

**B.3 Data model**

* Extend `search_index` with title/path fields.
* `saved_searches`(id, user\_id, name, query, filters, created\_at).
* `embeddings`(file\_id, chunk\_ix, vector) when semantic enabled.

**B.4 Acceptance**

* Query `"deployment tag:infra"` shows filtered results with highlighted matches.
* p95 latency ≤ 200 ms @ 10k files (FTS only path).
* Semantic results labeled `"semantic"` with confidence.

---

### EPIC C — Bundles v2 (Wizard, Roles, Branch/PR)

**User value.** Consistent, auditable bundles; one-click branch push + PR.

**C.1 Features**

* UI **wizard**: select by file/folder/tag; assign **roles** (Spec/Test Plan/PRD/etc.); include checksums; preview manifest.
* **Branch push** to artifacts repo, and optionally **open PR** with generated description + file list.
* **Bundle history** per project; verify manifest/checksums.

**C.2 API**

* `POST /api/projects/{id}/export/bundle` → job id (worker creates zip, optionally push branch + open PR).
* `GET /api/bundles/{id}` (status/details/download); `GET /api/projects/{id}/bundles` (list).
* `POST /api/bundles/{id}/verify`.

**C.3 Data model**

* Extend `bundles`: `status` enum (queued|running|completed|failed), `error` (text), `metadata` (json: roles, selection), `branch`, `pr_url`.

**C.4 Acceptance**

* Completed bundles listed with timestamp, manifest preview, download.
* With `push_branch=true`, remote branch exists; PR URL surfaced in UI.
* Verify returns `ok: true` for intact checksums.

---

### EPIC D — Artifacts Integration v2

**User value.** Confidence and control over artifacts with clear status/history.

**D.1 Features**

* **Status card**: repo/provider/branch/last sync/ahead-behind.
* **Commit & push** selected paths; view recent commits.
* GitHub provider adapter first; tokens via settings (PAT); OAuth later.

**D.2 API**

* `GET /api/projects/{id}/artifacts/status`.
* `POST /api/projects/{id}/artifacts/commit` `{ paths[], message, push:true }` → `{ commit_sha, pushed }`.
* `GET /api/projects/{id}/artifacts/history?limit=`.

**D.3 Acceptance**

* After connect, status reflects remote & branch; commit/push shows typed errors (`GIT_AUTH_FAILED`, `NETWORK_ERROR`, etc.).
* History shows last N commits with messages and SHAs.

---

### EPIC E — Projects Home Enhancements

**User value.** Navigate many projects quickly; see state at a glance.

**E.1 Features**

* **Board view** by status (Idea/Discovery/Draft/Live) with drag to move.
* Quick filters: tag chips; **pin favorites**; color/emojis.
* Bulk actions: delete, export selected.

**E.2 Acceptance**

* Dragging updates status and persists; filters combine; favorites persist (local storage).

---

### EPIC F — Activity & Notifications

**User value.** Awareness of job progress, errors, and changes without polling.

**F.1 Features**

* **Activity feed** per project: file changes, bundle exports, artifact commits.
* **SSE stream**: real-time toasts & progress bars for jobs (bundle/commit).
* CLI can **watch** a job id.

**F.2 API/Data**

* `events`(id, project\_id, type, payload json, created\_at);
* `GET /api/events/stream?project_id=…` (SSE); `GET /api/jobs/{id}`.

**F.3 Acceptance**

* Triggering bundle or commit emits events; UI shows non-blocking toasts; CLI `jobs watch` tails updates.

---

### EPIC G — API & CLI Enhancements

**G.1 CLI (Typer)**

* `ideas login`, `ideas mv`, `ideas rm`, `ideas open`, `ideas bundle create --push --open-pr`, `ideas search --semantic`, `ideas links list`, `ideas jobs watch <id>`.
* `--json` output for automation.

**G.2 API**

* ETags on GET; pagination (limit/offset); `PATCH` for partial updates; consistent `error.code` taxonomy.

**G.3 Acceptance**

* Commands return correct exit codes; `--json` prints machine-readable data; ETags reduce payloads.

---

### EPIC H — Architecture & Platform

**H.1 Database & Migrations**

* Alembic migrations (SQLite baseline; optional Postgres target).
* If Postgres enabled, pgvector available; otherwise feature flag off.

**H.2 Services layer**

* Introduce `services/` and `repositories/` to thin routers.
* Worker jobs: render, index, link extraction, bundle export, git commit/push, embeddings.

**H.3 Events/SSE**

* Redis pub/sub → persist to `events`; SSE per project.

**H.4 Security & Observability**

* Request rate limiting per token; payload size caps; strict path validation; CORS tightened.
* OTel traces/metrics; structured logs; optional Sentry (env-gated).

**H.5 Acceptance**

* Migrations apply idempotently; app runs with SQLite and Postgres.
* Routers ≤ 100 LoC; services unit-tested.

---

## 7) Detailed UI Specification

**Design system.** shadcn/ui + Radix + Tailwind; **dark mode default** (next-themes), Inter font, lucide icons; Framer Motion micro-animations; accessible focus rings and contrast (WCAG AA).

**Shell.** Header: ⌘K search, theme toggle, user/token menu. Left rail: Projects, filters, favorites. Content area responsive (≥1280, 1024, 768).

**Projects Home (Grid + Board).**

* **Grid cards**: title, tags, status pill, last updated, file count; hover elevation.
* **Board**: columns by status; draggable cards; inline status edit.

**Project Catalog (Tiles).**

* Tiles render file type badges (PRD/ADR/RFC/Note); tag chips; updated time.
* Filters: tag/status; search within project.
* **Add Item**: dialog for new file (template selector).

**Item Modal Viewer.**

* Title, metadata, ToC; MDX render: GFM, Mermaid, KaTeX, Shiki.
* Actions: Duplicate, Export to Bundle, Delete (confirm). Esc/overlay to close.

**Editor (Full page).**

* Split view; slash menu; template chooser; attachments uploader; backlinks panel.
* Save (⌘S), New (N), Toggle preview (P). Draft autosave toast.

**Artifacts Panel.**

* Status card; connect CTA; recent commits; commit+push dialog.

**Command Palette (⌘K).**

* Global fuzzy search with typed filters; actions (new project/file, open recent). Keyboard navigation.

**Empty & error states.**

* Friendly blanks with tips; skeletons during load; typed error toasts with retry.

---

## 8) Data Model Changes (DDL sketch)

```sql
-- links
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_file_id TEXT NOT NULL,
  target_file_id TEXT NULL,
  target_path TEXT NOT NULL,
  link_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- files extensions
ALTER TABLE files ADD COLUMN hash TEXT;
ALTER TABLE files ADD COLUMN word_count INTEGER;

-- bundles extensions
ALTER TABLE bundles ADD COLUMN status TEXT;           -- queued|running|completed|failed
ALTER TABLE bundles ADD COLUMN error TEXT;
ALTER TABLE bundles ADD COLUMN metadata JSON;         -- roles, selection
ALTER TABLE bundles ADD COLUMN branch TEXT;
ALTER TABLE bundles ADD COLUMN pr_url TEXT;

-- events
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,               -- file.updated, bundle.completed, git.pushed, etc.
  payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- saved searches
CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT,
  filters JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- optional embeddings (behind flag)
CREATE TABLE embeddings (
  file_id TEXT NOT NULL,
  chunk_ix INTEGER NOT NULL,
  vector VECTOR(768),               -- if Postgres+pgvector
  PRIMARY KEY (file_id, chunk_ix)
);
```

---

## 9) API Contracts (representative)

**Errors (standardized):**

```json
{ "error": { "code": "VALIDATION_ERROR|NOT_FOUND|GIT_AUTH_FAILED|NETWORK_ERROR|CONFLICT|RATE_LIMITED", "message": "…", "details": {...} } }
```

**Search:**
`GET /api/search?q=&project_id=&tag=&status=&limit=&offset=`

```json
{
  "results": [
    {
      "file_id": "f_123",
      "title": "Deployment Plan",
      "path": "plans/deploy.md",
      "snippet": "…deploy to <mark>staging</mark>…",
      "score": 12.3,
      "highlights": ["staging"]
    }
  ],
  "facets": { "tags": {"infra": 8}, "status": {"draft": 3} }
}
```

**Files (partial update):**
`PATCH /api/files/{id}`

```json
{ "title": "New Title", "path": "notes/new-title.md", "content_md": "# ..." }
```

**Move (with link updates):**
`POST /api/files/{id}/move`

```json
{ "new_path": "designs/overview.md", "update_links": true }
```

→ `{ "updated_links": 5, "conflicts": [] }`

**Links/Backlinks:**
`GET /api/files/{id}/links` → `{ "links":[{ "target_path":"…", "target_file_id":"…" }] }`
`GET /api/files/{id}/backlinks` → same shape, reversed.

**Attachments:**
`POST /api/projects/{id}/attachments/upload` (multipart) → `{ "url": "artifacts/assets/proj/imgs/…png", "hash":"…" }`

**Bundles:**
`POST /api/projects/{id}/export/bundle`

```json
{
  "selection": { "file_ids": ["f1","f2"], "tags": ["PRD"], "roles": { "f1": "Spec" } },
  "include_checksums": true,
  "push_branch": true,
  "open_pr": true
}
```

→ `{ "job_id": "job_abc" }`

`GET /api/bundles/{id}` → `{ "status":"running", "progress": 0.6, "download":"…", "branch":"…", "pr_url": null }`

**Artifacts:**
`GET /api/projects/{id}/artifacts/status` → `{ "provider":"github", "repo_url":"…", "branch":"main", "ahead":1, "behind":0, "last_sync":"…" }`
`POST /api/projects/{id}/artifacts/commit` → `{ "commit_sha":"…", "pushed":true }`
`GET /api/projects/{id}/artifacts/history?limit=20` → commits\[]

**Events (SSE):**
`GET /api/events/stream?project_id=…`
Server pushes `event: job.progress`, `data: {"id":"…","progress":0.42}`

---

## 10) Telemetry & Analytics

**Traces.** `ui.load.projects`, `ui.search`, `ui.open.item_modal`, `api.files.save`, `svc.links.extract`, `job.bundle.export`, `git.push`.

**Metrics.** Search latency, render duration, index size, queue depth, job success rate, commit/push success, bundle duration.

**Logs.** Structured JSON with correlation ids; redact content.

---

## 11) Implementation Plan (Milestones)

**M0 — Foundations (1 sprint)**

* Alembic migrations; services/repositories split.
* `events` table; SSE endpoint; job status endpoint.
* Error schema; OTel wiring.

**M1 — Editor & Links (1–2 sprints)**

* Editor route, file tree, slash commands, backlinks panel, attachments upload.
* Link extraction on save; links/backlinks endpoints; safe move/rename.
* CLI: `mv`, `rm`, `links list`.

**M2 — Search 2.0 (1 sprint)**

* Snippets + filters; saved searches; rebuild index; palette filters.
* Background incremental indexer.

**M3 — Bundles v2 (1 sprint)**

* Wizard with roles, preview; branch push + PR (GitHub).
* History, verify, CLI flags `--push --open-pr`.

**M4 — Artifacts v2 (1 sprint)**

* Status & history APIs; commit/push improvements; provider adapter.
* Frontend status card + history.

**M5 — Activity & Notifications (0.5 sprint)**

* Emit events on file/bundle/git; SSE toasts; CLI `jobs watch`.

**M6 — Optional Postgres & Semantic (parallel)**

* Postgres path with pgvector; embedding job behind flag; FE/CLI semantic toggle.

**Docs & Hardening (continuous).** Update README, API ref, UI guide; unit/integration/E2E tests; performance budgets enforced.

---

## 12) Test Plan

**Unit (backend).** services: render, links, search, bundle, git adapters; migrations.
**Integration.** API contract tests (httpx/pytest); CLI subprocess smoke; SSE stream.
**Frontend.** Component tests (React Testing Library) for Cards, Modal, Editor toolbar; Cypress E2E: create→link→search→bundle→push.
**Performance.** Search p95 ≤ 200 ms @ 10k docs; render ≤ 150 ms p95; bundle typical ≤ 10 s.
**Security.** Path traversal block; size limits; rate limiting; invalid token; CORS.

---

## 13) Rollout & Migration

* Apply Alembic migrations (`links`, `events`, bundle columns).
* Backfill `word_count` and `hash` on first write.
* Feature flags: `SEMANTIC_SEARCH`, `POSTGRES_MODE`, `PR_INTEGRATION`.
* Provide fallback to SQLite when Postgres not configured.

---

## 14) Risks & Mitigations

* **Git auth complexity.** Start with PATs; adapter abstraction; clear error taxonomy.
* **Semantic indexing cost/latency.** Feature flag; batch jobs; degrade to FTS.
* **Link updates on move.** Dry-run preview; conflict list; undo.
* **SSE scalability.** Per-project streams; Redis pub/sub; message size caps.

---

## 15) Open Decisions

1. **Editor engine**: CodeMirror + remark/rehype vs. Milkdown. *Default: CodeMirror + MDX pipeline.*
2. **PR creation scope**: GitHub first; GitLab/Bitbucket later. *Default: GitHub.*
3. **Bundle roles taxonomy**: provide seed set; allow custom roles later. *Default: seed set only.*
4. **Saved searches ownership**: per-user vs project. *Default: per-user with optional share later.*
5. **Attachments storage**: always under `/artifacts/assets`. *Default: yes, enforce path.*

---

## 16) Appendix

### A. Bundle Manifest v2 (example)

```yaml
project:
  name: "acme-idea-stream"
  slug: "acme-idea-stream"
generated_at: "2025-09-11T14:00:00Z"
selection:
  files:
    - id: f1
      path: files/prd.md
      role: PRD
      sha256: "…"
    - id: f2
      path: files/plan.md
      role: Spec
      sha256: "…"
artifacts:
  repo_url: "https://github.com/org/repo"
  branch: "bundle/acme-idea-stream/2025-09-11"
metadata:
  created_by: "cli@1.4.0"
  checksums: true
```

### B. Event Types

* `file.created|updated|moved|deleted`
* `links.updated`
* `bundle.queued|running|completed|failed`
* `git.committed|pushed|failed`

### C. Keyboard Shortcuts

* ⌘K search, ⌘S save, **N** new file, **/** focus search, **Esc** close modal.

---

**Definition of Done (iteration):**
UI overhaul with dark theme and polished interactions; Editor + links/backlinks + attachments; Search 2.0; Bundles v2 with PR; Artifacts v2 status/commit/push; Activity SSE; CLI/API parity; migrations & telemetry; tests and docs updated.
