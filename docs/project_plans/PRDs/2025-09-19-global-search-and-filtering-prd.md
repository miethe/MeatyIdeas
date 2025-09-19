---
title: "MeatyProjects — Global Search & Filtering PRD"
version: 1.0
status: Draft
date: 2025-09-19
owner: Product & Platform Duo (PM: TBD, Tech Lead: TBD)
---

## 1) Purpose & Vision

Deliver a unified, high-trust search experience that lets builders locate any project or file within two interactions. The search stack must feel instantaneous, make filters first-class, and establish a modular indexing layer that can later expand to semantic, cross-product discovery.

## 2) Background & Problems Today

- Search is currently coupled to opportunistic SQLite FTS queries without a clear abstraction, making it brittle to evolve.
- Tags exist only as free-form strings; there is no normalized taxonomy for filtering or analytics.
- Dashboard filtering requires full navigation context switches and lacks persistent state.
- Builders report "guess and re-search" loops because facets are hidden behind separate screens.

## 3) Goals & Non-Goals

In scope
- Global Search Modal (⌘K / `/`) with query box, primary filters, keyboard navigation, and quick actions.
- Dashboard Filter Bar and left-rail Views that narrow visible projects without modal context swaps.
- Normalized tag model and search abstraction layer that cover projects and files.
- Pagination, debouncing, and feedback patterns that make search responsive and predictable.

Out of scope
- Cross-account or multi-tenant sharing surfaces.
- AI/semantic search or vector reranking (design for, do not implement).
- Saved searches, subscriptions, or scheduled digests.
- Full-text indexing of binary assets.

## 4) Target Users & JTBD

- **Builder / Owner**: "When I remember the theme or tag, let me jump straight to the right project or file without slogging through the tree." Needs low-latency query, facets, and actionable results.
- **Contributor / Contractor**: "I’m triaging issues and need to locate relevant files quickly, even if I don’t know exact names." Needs filters, keyboard navigation, and consistent result metadata.
- **Automation / Ops**: "I need system-level visibility into tagged content for audits." Needs reliable tags schema and API access to filters.

## 5) Success Metrics

- Search completion rate (result selected within 10 seconds of open) ≥ 75%.
- Median search latency ≤ 300 ms; p90 ≤ 500 ms on representative dataset (50k files, 2k projects).
- Filter Bar adoption: ≥ 60% of dashboard sessions apply at least one filter or view toggle within 4 weeks.
- Tag normalization migration with ≤ 0.5% orphan tags and zero data loss.
- < 2% error rate for `/api/search` and facet endpoints over trailing 7 days.

## 6) Experience Overview

### 6.1 Search Modal
- Opens via keyboard shortcut, quick actions menu, or tag/filter "View all" triggers.
- Layout: sticky header with query + facets, virtualized mixed-entity list, result count indicator.
- Results show icon, type (Project/File), breadcrumb path, tags, snippet preview, updated timestamp.
- Actions: `Enter` opens in appropriate context (project page or file preview); `Cmd+Enter` open in new tab; `Shift+Enter` copy path.
- Bulk actions: multi-select with spacebar, `Cmd+C` copy paths, `Cmd+Shift+E` enqueue export job (if export flag on).
- Empty state: friendly copy, quick links to create project or clear filters.

### 6.2 Dashboard Filter Bar & Views
- Left rail Views: All, Starred, Recently Updated (30 days), By Tag (expands to tag list), Archived.
- Filter Bar chips for Tags (multi-select with typeahead), Language, Updated window, Owner; values reflected in URL params for shareable state.
- Reset control and "Open Search" link to escalate to full modal.
- Filters update project grid in place with skeleton states ≤ 120 ms.

### 6.3 Feedback & Accessibility
- Live aria announcements for result counts and filter changes.
- Keyboard-first flows: `Tab` cycles chips, `Arrow` keys for result list, accessible focus outlines.
- Loading states with shimmer placeholders, error toasts with retry.

## 7) Functional Requirements

### 7.1 Search Modal
1. Provide immediate invocation from anywhere in app (global hotkey + top-level nav button).
2. Persist last-used scope and facets per user in local preferences.
3. Support scopes: `projects`, `files`, `all`; default to previous scope.
4. Facets available inline: Tags (multi), Type, Language, Updated (presets + custom range), Owner, Has README.
5. Debounced search request after 200 ms idle; typing continues to show previous results with "Searching…" indicator.
6. Mixed result list that clusters top hits by type, but remains single stream for keyboard nav.
7. Cursor-based pagination with infinite scroll; maintain selection state when more results load.
8. Entering modal from tag chip seeds tag filter automatically.
9. Exiting modal returns focus to invoking element; `Esc` always closes.

### 7.2 Dashboard Filters & Views
1. Filters update URL query parameters; deep links restore state on page load.
2. Filter chips show applied count and allow quick removal via `Backspace`.
3. Views rail anchors to viewport; selecting a view updates filter state and analytics events.
4. Changing filters triggers project list fetch with aggregated stats (file count, languages, updated).
5. Provide "No projects match" empty state with CTA to reset filters.

### 7.3 Tag Normalization
1. Introduce `tags` and `project_tags` tables with migrations and idempotent backfill.
2. Enforce slug uniqueness and maintain color tokens.
3. Provide admin script to map legacy tags to new schema.
4. Include API for tag suggestions (prefixed search, usage counts).

### 7.4 Search API
1. `/api/search` accepts parameters: `q`, `scope`, `tags[]`, `language`, `updated_after`, `updated_before`, `owner`, `has_readme`, `limit`, `cursor`.
2. Response includes: `results[]` with `type`, `id`, `name`, `path`, `project`, `tags`, `excerpt`, `updated_at`, `score`; plus `next_cursor`.
3. Enforce max limit 50; default 20.
4. Request guardrails: 5s timeout, safe escaping, parameter validation with actionable error codes.

### 7.5 Facet APIs
1. `/api/filters/tags` returns list with id, label, slug, color, usage count (respecting scope).
2. `/api/filters/languages` returns aggregated languages with counts.
3. Provide optional `q` filter for tags for typeahead.

## 8) System & Architecture Requirements

- Abstract search layer (`SearchService`) with strategy interface to support SQLite FTS now and future Postgres/vector providers.
- Batch indexing jobs for projects and files; delta updates on create/update/delete events via message bus/SSE triggers.
- Introduce search telemetry instrumentation (latency, errors, query length) and store in existing logging infra.
- Cache facet responses for 60s per scope to reduce load.
- Tag normalization requires migration scripts and update to existing seed data.
- Ensure search queries respect project permissions and future private scopes; implement guard to hide archived projects unless view explicitly includes them.

## 9) Data Model Changes

```sql
create table tags (
  id serial primary key,
  slug text unique not null,
  label text not null,
  color text null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table project_tags (
  project_id uuid not null references projects(id) on delete cascade,
  tag_id int not null references tags(id) on delete cascade,
  primary key (project_id, tag_id)
);

-- Optional future: file_tags(file_id uuid, tag_id int)
```

Search abstraction tables or views will depend on storage engine; initial implementation may use virtual tables but must expose consistent DTOs.

## 10) Analytics & Telemetry

- Events: `search_opened`, `search_executed`, `search_result_selected`, `filter_applied`, `filter_cleared`, `view_changed`.
- Payload fields: query length bucket, scope, facet counts, result type, latency, error codes.
- Dashboards: p50/p90 latency, error rate, % zero results, top filters used, adoption of views.

## 11) Rollout Strategy

1. Ship tag normalization behind `TAGS_V2` feature flag; run migrations and backfill in staged environments.
2. Release API endpoints under `SEARCH_V2` flag; provide compatibility mode for existing simple search.
3. Roll out Search Modal to internal users first with feature toggle for instrumentation.
4. After stability week, enable Filter Bar and Views for all accounts; keep modal CTA visible even when disabled for fallbacks.
5. Post-launch: monitor telemetry, adjust scoring weights, and publish usability guide.

## 12) Dependencies & Coordination

- Requires coordination with backend infra for migrations and indexing jobs.
- Needs design/UX for modal, filter chips, empty states, keyboard flows.
- QA must prepare representative dataset to validate latency and accuracy.
- Documentation update for user guide and API reference.
- Potential interplay with MeatyPrompts tag system; align naming to enable future federation.

## 13) Open Questions

1. Should tags support colors at launch or default to theme palette? (Recommendation: optional color column, default palette.)
2. Do we expose search scopes via URL for deep linking? (Preferred: yes, keep canonical `?search` param for instrumentation.)
3. How do we treat archived projects in results by default? (Default: hide unless `view=archived` or explicit filter.)
4. Should we prefetch top results when modal opens? (Consider for performance; evaluate cost.)

## 14) Risks & Mitigations

- **Performance regressions**: mitigate with capped result size, caching, and background indexing.
- **Migration errors**: dry-run tag backfill, include rollback scripts, and capture duplicates before production.
- **UI complexity**: enforce consistent component APIs and share SearchModal primitives across app to avoid drift.
- **Scope creep into AI search**: document roadmap, keep MVP focused.

## 15) Definition of Done

- Search Modal and Filter Bar meet accessibility and performance requirements.
- All APIs documented with OpenAPI or equivalent reference.
- Telemetry dashboards live with alerting on latency/error thresholds.
- Support runbook updated with troubleshooting for search index and facet endpoints.
- Stakeholder sign-off from Product, Design, and Engineering leads.
