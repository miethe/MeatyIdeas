---

title: "Idea Projects — MVP PRD"
version: 0.9
status: Draft for Implementation
date: 2025-09-09
owner: Product (Nick) • Tech Lead (TBD) • Backend (TBD) • Frontend (TBD)
------------------------------------------------------------------------

# 1) TL;DR

A local-first, Git-optional app to capture, organize, and ship project ideation as **Markdown**. Users create **Projects**, add **Markdown files** (rendered with full formatting), optionally attach an **/artifacts** Git repo, and **export an Agent Bundle** (zip or git branch) that an AI agent can consume to continue work. MVP targets: fast doc creation, beautiful render, solid search, simple Git commit/push, and a clean API/CLI for automation.

---

# 2) Goals / Non-Goals

## 2.1 Goals (MVP)

1. Create/manage **Projects** with tags and status.
2. Create/edit **Markdown files** with full rendering (GFM tables, code highlighting, Mermaid, KaTeX).
3. **Search** across titles/body/tags; filters by project, tag.
4. Optional **Git integration**: connect an `/artifacts` repo (submodule or link), commit & push from UI/API/CLI.
5. **Agent Bundle export**: select files → produce `.zip` with `bundle.yaml` manifest; optionally push to a git branch.
6. **API + CLI** for headless use.
7. **Docker Compose** deployment; single-user auth (local) + Git provider OAuth (GitHub) for artifacts.

## 2.2 Non-Goals (MVP)

* Multi-tenant teams, real-time multi-user editing.
* Notion/Confluence bi-directional sync (importers later).
* Task management deep sync (Linear/Jira full lifecycle).
* RBAC/SSO; mobile apps; offline PWA.

---

# 3) Success Metrics

* **TTFD (time-to-first-doc)** < 60s from first run.
* **Doc save latency** p95 < 200ms; **render switch** p95 < 150ms.
* **Search latency** p95 < 150ms on ≤ 2k docs.
* **Bundle validity**: ≥ 90% bundles pass schema + content checks in CI agent.
* **Git ops reliability**: ≥ 99% commit/push success (network permitting).

---

# 4) Users & JTBD

* **Solo builder / CTO / PM**: Capture ideas, PRDs, specs; hand clean bundles to agents.
* **Staff IC / Architect**: Keep ideation artifacts versioned; link to artifacts repo; export bundles for implementation.
* **Automation/Agent**: Use API/CLI to create/update projects/files and generate bundles unattended.

---

# 5) Scope & Feature List (MVP)

* Projects CRUD (name, description, tags\[], status).
* Files CRUD (Markdown only) with split editor/preview + outline.
* Renderer: GitHub-flavored Markdown, Mermaid, KaTeX, code highlighting (Shiki/Prism).
* Global and per-project search (FTS).
* Git: attach `/artifacts` repo; stage/commit/push; semantic commit messages.
* Agent Bundle export (.zip + `bundle.yaml`; optional git branch `bundle/<slug>/<ts>`).
* REST API (token) and CLI (Typer).
* Packaging: Docker Compose; volumes for data and repos.
* Basic telemetry (OpenTelemetry traces; structured logs).

---

# 6) System Architecture

**Frontend:** Next.js (App Router), Tailwind, Radix UI, CodeMirror-based editor (Markdown), Mermaid/KaTeX render in preview.
**Backend:** FastAPI (Python), SQLite (FTS5) for MVP; background worker (RQ/Redis) for git ops + export.
**Storage:** `/data/projects/<slug>/files` (markdown), `/data/projects/<slug>/artifacts` (git submodule or linked repo), `/data/projects/<slug>/bundles`.
**Auth:** Local token; optional GitHub OAuth app for artifacts repo access.
**Deployment:** Docker Compose (proxy, web, api, worker, redis).
**Observability:** OTel SDK → collector → logs/metrics.

---

# 7) Data Model

## 7.1 Tables

**projects**

* `id` (uuid pk)
* `name` (string, unique per user)
* `slug` (string, unique)
* `description` (text)
* `tags` (json\[])
* `status` (enum: idea|discovery|draft|live)
* `color` (string, optional)
* `created_at`, `updated_at`

**files**

* `id` (uuid pk)
* `project_id` (fk)
* `path` (string; e.g., `ideation/plan.md`)
* `title` (string)
* `front_matter` (json)
* `content_md` (text)
* `rendered_html` (text, cached)
* `tags` (json\[])
* `updated_at`

**artifacts**

* `id` (uuid pk)
* `project_id` (fk)
* `repo_url` (string)
* `default_branch` (string)
* `visibility` (enum: public|private)
* `provider` (enum: github|gitlab|bitbucket|local)
* `last_synced_at`

**search\_index** (FTS virtual table over title/headings/body)

* `file_id`, `content_text`

**bundles**

* `id` (uuid pk)
* `project_id` (fk)
* `selection` (json: file\_ids/paths, filters)
* `output_path` (string)
* `created_at`

## 7.2 On-disk layout

```
/data/projects/<slug>/
  project.json
  files/**/*.md
  artifacts/           # git submodule or linked working tree
  bundles/<slug>-<timestamp>.zip
```

---

# 8) Functional Requirements & User Stories

## 8.1 Stories

**PRJ-001 Create project**
As a user, I create a project with name, description, tags, status.
**Acceptance:** Project appears in sidebar; slug auto-generated; created\_at set.

**DOC-001 Create & edit Markdown file**
As a user, I add a Markdown doc to a project; I can edit in split view and preview renders Mermaid/KaTeX/code.
**Acceptance:** Save persists; preview updates; outline shows H1–H3.

**SRCH-001 Global/project search**
As a user, I can search by keyword and filter by project, tag.
**Acceptance:** Results ranked by term frequency; clicking opens file; “no results” state.

**GIT-001 Attach artifacts repo**
As a user, I connect an existing repo (or create new) as `/artifacts`.
**Acceptance:** Repo cloned/initialized; status visible; provider stored.

**GIT-002 Commit & push artifacts**
As a user, I can stage selected paths under `/artifacts`, commit with a generated or custom message, and push.
**Acceptance:** Branch up-to-date; errors surfaced (auth, conflicts).

**BND-001 Export Agent Bundle**
As a user, I select files to include; system generates `.zip` with `bundle.yaml`.
**Acceptance:** Zip contains selected files under relative paths; checksums included; manifest schema valid.

**API-001 Use REST API to automate**
As a script, I create projects/files and export bundles.
**Acceptance:** Endpoints auth via token; responses JSON; errors typed.

**CLI-001 Use CLI**
As a user/agent, I perform common ops (`new`, `add`, `search`, `artifacts connect`, `bundle create`).
**Acceptance:** Exit codes correct; helpful stdout; respects config.

## 8.2 Cross-cutting requirements

* Editor supports paste of images (MVP: reject with message “assets supported in /artifacts only”; store later).
* Render cache invalidates on save.
* Content safe-write (no data loss on crash).
* Semantic commit templates: `docs: add <title>` / `docs: update <title>`.

---

# 9) UX Specification (MVP)

## 9.1 Screens

* **Projects List (Left Rail):** pinned + recent; “+ New Project”; tag filter.
* **Project Home:** header (name, status, tags); recent files grid; “New Document”.
* **Editor:** top action bar (Save ⌘S, Preview toggle, Outline, More); split view; right drawer (tags, status, file path); footer (updated time).
* **Artifacts Panel:** repo URL, provider, branch, sync status, changes list, commit message field, Commit & Push button.
* **Export Modal:** file picker (checkboxes, select by tag), include options, summary, “Export .zip” / “Push bundle branch”.

## 9.2 Keyboard

* Global search ⌘K; Save ⌘S; New file N; Toggle preview P.

## 9.3 Empty states / errors

* Friendly blanks with “Create first project/doc”.
* Git auth error → CTA “Connect GitHub”.

---

# 10) API (REST, v1) — Initial Surface

```yaml
openapi: 3.0.3
info:
  title: Idea Projects API
  version: 1.0.0
servers:
  - url: /api
paths:
  /projects:
    post:
      summary: Create project
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProjectCreate'
      responses:
        '201': { $ref: '#/components/responses/Project' }
    get:
      summary: List projects
      responses:
        '200':
          description: OK
  /projects/{id}:
    get: { summary: Get project, responses: { '200': { $ref: '#/components/responses/Project' } } }
    put: { summary: Update project, responses: { '200': { $ref: '#/components/responses/Project' } } }
    delete: { summary: Archive project, responses: { '204': { description: No Content } } }
  /projects/{id}/files:
    post:
      summary: Create file (Markdown)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/FileCreate' }
      responses:
        '201': { $ref: '#/components/responses/File' }
    get:
      summary: List files
      responses:
        '200': { description: OK }
  /files/{id}:
    get: { summary: Get file, responses: { '200': { $ref: '#/components/responses/File' } } }
    put: { summary: Update file, responses: { '200': { $ref: '#/components/responses/File' } } }
    delete: { summary: Delete file, responses: { '204': { } } }
  /search:
    get:
      summary: Search files
      parameters:
        - in: query; name: q; schema: { type: string }
        - in: query; name: project_id; schema: { type: string }
        - in: query; name: tag; schema: { type: string }
      responses:
        '200': { description: OK }
  /projects/{id}/artifacts/connect:
    post:
      summary: Attach artifacts repo
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                repo_url: { type: string }
                provider: { type: string, enum: [github, gitlab, bitbucket, local] }
                visibility: { type: string, enum: [public, private] }
      responses:
        '200': { description: OK }
  /projects/{id}/artifacts/commit:
    post:
      summary: Commit & push artifacts
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                paths: { type: array, items: { type: string } }
                message: { type: string }
      responses:
        '200': { description: OK }
  /projects/{id}/export/bundle:
    post:
      summary: Export Agent Bundle
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                file_ids: { type: array, items: { type: string } }
                include_checksums: { type: boolean, default: true }
                push_branch: { type: boolean, default: false }
      responses:
        '201':
          description: Bundle created
          content:
            application/json:
              schema:
                type: object
                properties:
                  zip_path: { type: string }
                  branch: { type: string }
components:
  schemas:
    ProjectCreate:
      type: object
      required: [name]
      properties:
        name: { type: string }
        description: { type: string }
        tags: { type: array, items: { type: string } }
        status: { type: string, enum: [idea, discovery, draft, live] }
    FileCreate:
      type: object
      required: [path, content_md]
      properties:
        path: { type: string }
        title: { type: string }
        front_matter: { type: object, additionalProperties: true }
        tags: { type: array, items: { type: string } }
        content_md: { type: string }
  responses:
    Project:
      description: Project
    File:
      description: File
security:
  - bearerAuth: []
```

**Error model:**
`{ "error": { "code": "GIT_AUTH_FAILED"|"VALIDATION_ERROR"|"NOT_FOUND"|"FS_IO_ERROR", "message": "...", "details": {...} } }`

---

# 11) CLI Spec (Typer)

```
ideas init
ideas login --token <...>
ideas new "<project name>" [--tags t1,t2] [--status idea|discovery|draft|live]
ideas add <project-slug> <path> --title "..." --file ./local.md | --stdin
ideas open <project-slug>
ideas search "query" [--project <slug>] [--tag t1]
ideas artifacts connect <project-slug> --repo <url> --provider github --visibility private
ideas artifacts commit <project-slug> --paths "assets/*" --message "docs: add diagrams"
ideas bundle create <project-slug> --file-ids f1,f2 --zip
```

Exit codes: `0` success, `1` generic error, `2` validation, `3` auth, `4` git.

---

# 12) Git Integration (MVP)

* Default model: **submodule** under `/data/projects/<slug>/artifacts`.
* “Connect”:

  * If `repo_url` provided → clone as submodule; else → init new local repo and offer “Create on GitHub” (defer to V1).
* Status shows: current branch, ahead/behind, untracked/modified counts.
* Commit flow: stage provided paths (or all), compose message:

  * `docs: add <title>` (new), `docs: update <title>` (edit), or user message.
* Push: use stored credential (OAuth app token) for provider.

---

# 13) Search (MVP)

* Build **FTS5** virtual table from Markdown (strip code fences for body index; keep headings separately for boosting).
* Rank: heading hits > body hits; recency tie-breaker.
* Filters: `project_id`, `tag`.

---

# 14) Agent Bundle Format (MVP)

`bundle.yaml` (example):

```yaml
project:
  name: "acme-idea-stream"
  slug: "acme-idea-stream"
generated_at: "2025-09-09T16:00:00Z"
files:
  - path: "files/ideation/plan.md"
    sha256: "..."
    role: "overview"
  - path: "files/prd.md"
    sha256: "..."
    role: "prd"
artifacts_dir: "artifacts/"
notes: "Exported for agent execution."
```

Zip structure:

```
/bundle.yaml
/files/**.md
/artifacts/   # (optional pointer or empty; MVP: omit repo contents to keep bundle lean)
```

Option: `push_branch=true` → create `bundle/<slug>/<ts>` with `bundle.yaml` and selected files.

---

# 15) Non-Functional Requirements

* **Performance:** targets in §3.
* **Reliability:** safe write with temp files and atomic rename; autosave every 10s.
* **Security:** local token auth; secrets at rest (file-based keyring); outbound to Git provider only when configured.
* **Privacy:** no analytics that exfiltrate content; telemetry is metadata only.
* **Portability:** all data is Markdown + JSON/YAML on disk.

---

# 16) Telemetry & Logging

* **Traces:** `http.request`, `render.markdown`, `search.query`, `git.commit`, `git.push`, `bundle.export`.
* **Metrics:** request latency, render duration, index size, git ops success rate.
* **Logs:** structured JSON; user/project/file ids; redacted content.

---

# 17) Acceptance Criteria (Traceability Matrix)

| Story    | Key Criteria                                         | Tests (Happy/Edge)                                                                  |
| -------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| PRJ-001  | Create project with name; slug auto; appears in list | POST /projects 201; GET list contains; duplicate name → 409                         |
| DOC-001  | Save .md; render Mermaid/KaTeX/code; outline H1–H3   | PUT /files 200; preview shows diagram; malformed Mermaid → safe fallback code block |
| SRCH-001 | Query returns ranked results; filter by tag/project  | GET /search returns ids sorted; tag filter reduces set                              |
| GIT-001  | Connect repo; status visible                         | POST /artifacts/connect 200; invalid token → `GIT_AUTH_FAILED`                      |
| GIT-002  | Commit & push selected paths                         | POST /artifacts/commit 200; offline → `NETWORK_ERROR`                               |
| BND-001  | Zip created; bundle.yaml schema valid                | POST /export/bundle 201; unzip & validate; incorrect id → 404                       |
| API-001  | Token auth; JSON errors typed                        | Unauthorized → 401; invalid body → 422                                              |
| CLI-001  | Commands succeed with correct output                 | Exit codes as spec; config persisted                                                |

---

# 18) Test Plan (MVP)

* **Unit:** renderer, search indexer, git ops adapter, bundle serializer.
* **Integration:** API endpoints (pytest + httpx), CLI (subprocess).
* **E2E (headless):** create project → add file → search → attach repo → commit → export bundle.
* **Schema validation:** `bundle.yaml` against JSONSchema.
* **Performance smoke:** render 500-line doc < 150ms p95; search on 1k docs p95 < 150ms.

---

# 19) Deployment & Ops

* **Docker Compose** with services: `proxy`, `web`, `api`, `worker`, `redis`, `otel-collector`.
* Volumes: `/data` bind mount.
* Health checks: `/api/healthz`.
* Backups: tar `/data/projects` nightly (cron in container disabled by default; documented for homelab).

---

# 20) Risks & Mitigations

* **Git submodule complexity:** one-click flows; clear status; docs.
* **Markdown plugin perf:** lazy-load Mermaid/KaTeX; cache rendered HTML.
* **File path conflicts:** validate and prevent overwrite unless confirmed.
* **Auth sprawl:** scope tokens minimally; store provider tokens encrypted.

---

# 21) Open Decisions (MVP defaults proposed)

1. **Submodule vs linked worktree** for `/artifacts` — **Default: submodule**.
2. **Include artifacts in bundle zip?** — **Default: exclude**, include pointer + repo\_url.
3. **Local accounts** — **Yes**, token auth; no email signup.
4. **Embeddings** — **Defer to V1** (toggle off in MVP).
5. **Image/asset handling** — **Defer**; show guidance to store assets under `/artifacts`.

---

# 22) Out of Scope (for MVP)

* Multi-user collaboration and sharing links.
* Notion/Confluence/Drive importers.
* Advanced task integrations.
* Graph/backlinks UI.
* Role-based access control.

---

# 23) Deliverables (MVP Definition of Done)

* Running app via `docker compose up` with example project seeded.
* API + CLI covering stories; OpenAPI served at `/api/docs`.
* Docs: quickstart, API reference, bundle schema, git setup guide.
* Example **bundle** zip produced from seeded project and validated.
* Basic OTel traces visible in logs (or collector).

---

# 24) Example Seed Content (for Dev)

* Project: `demo-idea-stream`

  * `files/ideation/plan.md` (includes Mermaid, KaTeX)
  * `files/prd.md` (this PRD trimmed)
* Bundle preset: select both files.

---

# 25) Next Steps (for Implementation Agent)

1. Scaffold repo (frontend, api, worker, docker).
2. Implement Projects/Files CRUD + editor/preview render pipeline.
3. Implement FTS search.
4. Wire artifacts connect/commit/push (GitPython + provider token).
5. Implement bundle export + schema + zip/branch outputs.
6. Expose REST + CLI; write seed and E2E script.
7. Package via Docker Compose; write docs.

---

**End of PRD**
