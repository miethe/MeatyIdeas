{MeatyIdeas}

# Near-Term Enhancement Plan (PRD Seed)

This is a focused, high-leverage plan to ship immediate value while laying clean foundations for later power-features. It’s organized by Objectives → Scope & Acceptance → Architecture/Model updates → UX notes with rough wireframes → Tasks/Sprint plan.

---

## 0) Objectives (next 4–6 weeks)

1. **Make finding things fast and obvious.**
   Ship reliable search with first-class filters (incl. Tags) and a dedicated **Search Modal** for power use.

2. **Tighten the “peek → open” loop.**
   Add a **ProjectDetail Modal** with file tree + inline file preview, plus “Expand” to the full project page.

3. **Level-up the Dashboard.**
   Rich, scannable **Project Cards**, new filter bar and left-rail **Views** (GitHub-style), with variants for density.

4. **Be extensible from day one.**
   Normalize tags, add a future-proof search index, telemetry, and component APIs that can later mirror MeatyPrompts’ PromptCards patterns.

---

## 1) Global Search & Filtering (incl. Tags)

### Scope & Acceptance

* **Feature**: Search Modal (⌘K / / shortcut), with query + facets: `Type (Project | File)`, `Tags (multi)`, `Updated`, `Language`, `Owner`, `Has Readme`.
* **Filter**: On dashboard, a persistent **Filter Bar** (chips + dropdowns) that narrows the visible Projects without opening the Search Modal.
* **Correctness**: Searching “token” by project name/description/tag/file name returns relevant projects; file content search returns files.
* **Performance**: Debounced (<150ms UI), results within 500ms for common queries on medium datasets.
* **Empty states**: Clear guidance + CTA to reset filters or broaden scope.
* **Accessibility**: Keyboard navigable; announced results count.

### Architecture & Data

* **Indexing**

  * *Near-term (MVP)*: Keep current engine (e.g., SQLite FTS5) if that’s live; add field weighting and per-scope search.
  * *Path to Postgres*: Design index abstraction so we can swap to `tsvector/tsquery + trigram` without API changes.
* **Search domains**

  * `project_index`: name\*, description\*, tags\*, readme snippet, languages, owners, updated\_at
  * `file_index`: path\*, filename\*, content (where supported), language, project\_id, updated\_at
  * `*` = higher weight
* **Tags**

  * Normalize to `tags` table (`id, slug, label, color`) + `project_tags(project_id, tag_id)`.
  * Optional `file_tags(file_id, tag_id)` later (schema supports it).

### API (illustrative)

* `GET /search` — params: `q, scope=projects|files|all, tags[], language, updated_after, owner, limit, cursor`
* `GET /filters/tags` — returns all tags (with counts per scope if `scope` passed)
* `GET /filters/languages` — language facets (aggregated from files)

### UX & Wireframe (Search Modal)

```
┌──────────────────────────────────────────────────────────┐
│  🔎  Search…                                  [Esc]      │
│  [ q: "vector index" ] [Scope: All ▼] [Tags: ml,+2 ▼]   │
│  [ Language: Any ▼ ] [Updated: 30d ▼] [Owner: Me ▼ ]    │
├──────────────────────────────────────────────────────────┤
│  RESULTS (12)                                            │
│  • Project — MeatyIdeas                                  │
│    … “Add vector index abstraction”  · Tags: search, db  │
│  • File — /projects/mi/search/indexer.py                 │
│    … “weights: name^3, tags^2, desc^1 …”                │
│  • Project — MeatyPrompts                                │
│    … “PromptCards + cross-app tags”                      │
│                                                          │
│  [Show more]                                    ↑↓ Enter │
└──────────────────────────────────────────────────────────┘
```

---

## 2) ProjectDetail Modal (peek before commit)

### Scope & Acceptance

* **Open** from any Project Card (and via keyboard from a focused card).
* **Includes**: left file tree, right panel with **Overview** (description, tags, counts, languages), **File Preview** (text/markdown), and **Activity (recent commits/files)** if available.
* **Primary CTA**: **Expand** → navigates to the full project page.
* **Performance**: Lazy-load tree + preview; first paint <300ms; preview load <400ms typical.
* **Persistence**: Deep-linkable (`?modal=project&id=…`).

### API

* `GET /projects/:id` — metadata, tags, stats
* `GET /projects/:id/tree?path=` — paged children
* `GET /files/:id` — metadata + content preview (text/markdown; binary -> unsupported message)

### UX & Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│  Project: “Idea Graph MVP”                     [Expand] [Close] │
├───────────────┬─────────────────────────────────────────────────┤
│  FILES        │  Overview                                       │
│  ▸ src        │  • Tags: graph, ml, ux                           │
│  ▸ docs       │  • Desc: “Idea capture + search MVP …”          │
│  ▸ data       │  • Files: 27   • Langs: TS 68%, Py 22%, MD 10%   │
│  README.md    │  • Updated: 2d ago  • Owner: nick                │
│               │─────────────────────────────────────────────────│
│               │  File Preview: README.md                         │
│               │  # Idea Graph MVP                                │
│               │  This project…                                   │
│               │  [Open File]   [Copy Path]                       │
└───────────────┴─────────────────────────────────────────────────┘
```

---

## 3) Dashboard UX: Views, Filter Bar, and Rich Project Cards

### Scope & Acceptance

* **Views (left rail)**: `All`, `Starred`, `Recently Updated`, `By Tag`, `Archived`.

  * View selection **filters** the right-hand grid; it does **not** open the Search Modal.
* **Filter Bar (top)**: quick filter chips (Tags, Language, Owner, Updated).
* **Project Cards**: three density variants: **Compact**, **Standard**, **Rich**.

  * Show: name, truncated description, tags (colored), last updated, file count, language bar, owners/avatars, star/bookmark.
  * Cards color system derived from tags or project color token.

### Architecture

* **Card data API**: `GET /projects?view=recent&tags[]=…&sort=-updated&limit=…` returns enough info to render cards without N+1s.
* **Telemetry**: impressions, hovers, opens, expand clicks, filter usage (exported as OTel spans + events).

### UX & Wireframe (Dashboard)

```
┌─ VIEWS ────────────┐  ┌─────────────────────────────────────────┐
│ ● All              │  │  Filter: [Tags: +search +ml] [Lang: TS] │
│   Starred          │  │          [Updated: 30d] [Owner: Me]     │
│   Recently Updated │  └─────────────────────────────────────────┘
│   By Tag           │
│   Archived         │  ┌───────────────┬───────────────┬─────────┐
└────────────────────┘  │  PROJECT CARD │  PROJECT CARD │  …      │
                        │  [Rich]       │  [Standard]   │         │
                        │  Title        │  Title        │         │
                        │  Desc…        │  Desc…        │         │
                        │  #files  langs│  tags         │         │
                        │  tags   ★     │  ↑ modal on   │         │
                        │  [Open ▸]     │  click        │         │
                        └───────────────┴───────────────┴─────────┘
```

### Project Card Variants

**Compact (list/grid)**

* Title · tags · updated\_at · star
* One-line description elided

**Standard (default)**

* Title
* 1–2 line description
* Tag pills (colored)
* Footer: language bar + file count + updated\_at + star

**Rich**

* Adds: owner avatars, top file highlights (e.g., README.md), small activity sparkline
* Used when screen width permits or via density toggle

---

## 4) Component & State Architecture

* **Front-end**: React + Tailwind + shadcn/ui + Radix; React Query for data; Zustand (or Context) for UI state (filters, modal).
* **Component atoms**: `TagPill`, `LanguageBar`, `AvatarStack`, `CardStat`, `FileTree`, `FilePreview`.
* **Organisms**: `ProjectCard{Compact|Standard|Rich}`, `FilterBar`, `SearchModal`, `ProjectDetailModal`.
* **Layouts**: `DashboardView`, `ProjectPage`.
* **Keyboard**: ⌘K open search, `Esc` close, `Enter` activate, `↑/↓` navigate result list, `f` focus Filter Bar.

---

## 5) Telemetry & Quality

* **Metrics**: search latency p50/p90, no-result rate, filter usage, card CTR, modal expand rate, time-to-content.
* **Events**: `search_executed`, `filter_applied`, `project_modal_opened`, `file_preview_opened`, `project_expanded`.
* **Tracing**: backend spans for search pipeline; annotate with query length, scope, facet counts.

---

## 6) Non-Functional

* **Performance**: lazy trees, streaming previews, result virtualization (e.g., `react-virtual`).
* **Security**: server-side param validation; query timeouts; limit content preview sizes; XSS-safe markdown rendering.
* **Accessibility**: ARIA roles in modals, focus traps, tags with accessible color contrast.
* **Content extraction (files)**: MVP supports `md/txt/json/py/js/ts` (text). Binary shows “preview unsupported.”

---

## 7) Data Model Changes (DDL sketch)

```sql
-- Tags
create table tags (
  id serial primary key,
  slug text unique not null,
  label text not null,
  color text null
);
create table project_tags (
  project_id uuid not null references projects(id) on delete cascade,
  tag_id int not null references tags(id) on delete cascade,
  primary key (project_id, tag_id)
);

-- Search abstraction tables (optional if using virtual indexes now)
-- project_index(project_id, name, description, tags_text, readme, languages, owners, updated_at)
-- file_index(file_id, project_id, path, filename, content, language, updated_at)
```

---

## 8) Detailed Tasks & Sprints

### Sprint 1 — Search & Filters (1.5–2 weeks)

**Backend**

* MI-SEARCH-001: Introduce search abstraction layer with weighted fields (project/file).
* MI-SEARCH-002: Add facet endpoints (`/filters/tags`, `/filters/languages`).
* MI-SEARCH-003: Normalize tags + data migration; backfill `project_tags`.
* MI-SEARCH-004: Add cursor-based pagination; enforce query timeouts and size caps.
* MI-SEARCH-005: Smoke/perf tests for representative datasets; fixtures.

**Frontend**

* MI-UI-001: Search Modal (layout, keyboard, debounced search hook).
* MI-UI-002: Result list with mixed entities (Project/File) and icons.
* MI-UI-003: Filter Bar component (chips, dropdowns), persisted in URL params.
* MI-UI-004: Views left-rail with routing (`/dashboard?view=recent|starred|…`).
* MI-A11Y-001: Focus management + ARIA for modal.

**QA/Acceptance**

* Queries return expected entities by scope; tags filter narrows correctly; ≤500ms median latency on dev dataset.

### Sprint 2 — ProjectDetail Modal (1–1.5 weeks)

**Backend**

* MI-API-010: `GET /projects/:id` enriched payload (tags, stats, languages).
* MI-API-011: `GET /projects/:id/tree` paged; returns directories and leaf files.
* MI-API-012: `GET /files/:id` preview (content or unsupported).

**Frontend**

* MI-UI-010: Modal shell with panes; deep-link support (`?modal=project`).
* MI-UI-011: Virtualized file tree; lazy nodes.
* MI-UI-012: File preview with markdown renderer; code viewer fallback.
* MI-UI-013: “Expand” button → project page navigation.

**QA/Acceptance**

* Open modal from card; tree navigable; previews render; expand navigates; back/forward keeps state.

### Sprint 3 — Dashboard Cards & Variants (1 week)

**Backend**

* MI-API-020: `GET /projects` list returns card-ready DTO (name, desc, tags, updated, file\_count, languages, owners).
* MI-API-021: Language distribution aggregation.

**Frontend**

* MI-UI-020: ProjectCard components (Compact/Standard/Rich) with design tokens.
* MI-UI-021: Density toggle; responsive grid; hover actions (star, quick-open).
* MI-UI-022: Skeleton loaders & empty states.

**QA/Acceptance**

* Cards render from single payload; variants switch correctly; performance: grid paints smoothly with >100 items.

### Sprint 4 — Telemetry, Polish, Docs (0.5–1 week)

* MI-OBS-001: OTel events for search + modal.
* MI-POL-001: Edge-case fixes (no tags, huge descriptions, binary files).
* MI-DOC-001: Update PRD.md, API docs, and UI component README; add Storybook entries.

---

## 9) Rough UI Inventory (components to implement)

* `SearchModal` (shell, query input, facet bar, results list)
* `FilterBar` (chips: Tags, Language, Updated, Owner)
* `ViewsRail` (left nav: All, Starred, Recently Updated, By Tag, Archived)
* `ProjectCard{Compact|Standard|Rich}` (+ `LanguageBar`, `TagPill`, `AvatarStack`)
* `ProjectDetailModal` (`FileTree`, `FilePreview`, `OverviewPanel`)
* Utilities: `useSearch`, `useFilters`, `useModalState`, `useKeyboardNav`

---

## 10) Copy & Micro-interactions (snippets)

* Search placeholder: “Search projects and files… (⌘K)”
* Empty search: “No matches. Try removing filters or broadening your query.”
* File preview unsupported: “Preview not available for this file type. Open in full view.”

---

## 11) Risks & Mitigations

* **Index performance** on large content: cap preview size; index only text-like files first; async background indexing.
* **Tag sprawl**: use tag pickers with suggestions; admin merge tool later.
* **Scope creep**: stick to MVP schemas; design API for parity with future Postgres migration.

---

## 12) Definition of Done (phase)

* All acceptance criteria met across the three pillars (Search/Filters, ProjectDetail Modal, Dashboard Cards).
* Telemetry emitting; basic dashboards for search latency & CTR.
* Documentation updated (PRD.md, API reference, component README).
* Lighthouse pass: a11y ≥ 90, perf ≥ 85 on dashboard.

---

## 13) Future-Facing Hooks (not in MVP, but enabled by design)

* Postgres `tsvector` + synonym dictionaries; semantic reranking.
* Cross-app Tag federation (shared taxonomy with MeatyPrompts).
* Saved searches & smart views; per-user pinning.
* File diff/commit activity inside modal.

---

### Appendix — Additional Wireframes

**Filter Bar (chips)**

```
[ Tags: +ml +ux  × ] [ Language: TS ▼ ] [ Updated: 14d ▼ ] [ Owner: Me ▼ ]  [Reset]
```

**Project Card — Standard**

```
┌───────────────────────────────┐
│ Idea Graph MVP         ★      │
│ Capture & search ideas…       │
│ [graph] [ml] [ux]             │
│ ▓▓▓▓▓▓▓▓▓▓▓░░  27 files  · 2d │
└───────────────────────────────┘
```

**Project Card — Rich**

```
┌───────────────────────────────────────────────┐
│ Idea Graph MVP                         ★      │
│ Capture & search ideas with…                  │
│ [graph] [ml] [ux]                             │
│ Langs: ▓▓▓▓▓ TS ▓▓ Py ░ MD                    │
│ Owners: (A)(B)(C)   Updated: 2d   Files: 27   │
│ Highlight: README.md · “Architecture sketch”  │
└───────────────────────────────────────────────┘
```
