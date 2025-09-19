---
title: "Implementation Plan — Global Search & Filtering"
status: Draft
version: 0.1
date: 2025-09-19
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-19-global-search-and-filtering-prd.md
owner: Delivery Lead (Backend: TBD, Frontend: TBD)
-----------------------------------------------------------------------------------

## 0) Summary

Operationalize the Search & Filtering PRD into layered work that upgrades tagging, search infrastructure, dashboard filters, and instrumentation. Delivery is structured across three sprints: foundational data/model work, experience assembly, and hardening + rollout. Key risks involve migration safety and latency regressions; mitigations are built into sequencing, feature flags, and perf gates.

## 1) Scope & Complexity

Complexity: L — multi-squad coordination (backend, frontend, data), database migrations, new APIs, UI surfaces, and telemetry. Estimated effort ~4 calendar weeks with two dedicated engineers (backend + frontend) plus design + QA support.

## 2) Architecture Layers & Workstreams

1. **Data & Migrations** — normalize tags, establish search abstraction tables.
2. **Services & Indexing** — search service interface, indexing jobs, cache strategy.
3. **APIs** — `/api/search`, facet endpoints, dashboard views interoperability.
4. **Frontend** — Search Modal, Filter Bar, Views rail integration, shared state.
5. **Testing & Perf** — contract tests, load tests, accessibility.
6. **Telemetry & Rollout** — metrics wiring, feature flags, runbooks.

## 3) Milestones & Timeline

- **Sprint 1 (wk 1–1.5)**: Tag normalization, search service abstraction, facet APIs baseline, backend perf harness.
- **Sprint 2 (wk 2–2.5)**: Search Modal UX, Filter Bar + Views plumbing, shared state, keyboard/a11y, API integration.
- **Sprint 3 (wk 3–4)**: Telemetry, perf tuning, migration clean-up, docs, rollout via staged flags.

Parallelization: Backend foundational work must land before FE integration. Telemetry and docs run in parallel during sprint 3.

## 4) Foundational Tasks (Sprint 1)

### 4.1 Migration & Data Hygiene
- **Task**: Create `tags` and `project_tags` tables, backfill legacy data.
  - Acceptance: Alembic migration creates tables with indexes; backfill script maps existing project tags; dry-run verified on snapshot.
  - Dependencies: None. Estimate: 3 pts.

- **Task**: Tag normalization script + duplicate resolver.
  - Acceptance: CLI script dedupes case/whitespace variants; reports collisions; unit tests cover edge cases.
  - Dependencies: Migration. Estimate: 2 pts.

### 4.2 Search Service Abstraction
- **Task**: Introduce `SearchService` interface with SQLite FTS strategy implementation.
  - Acceptance: Service exposes `searchProjects`, `searchFiles`, `searchAll` with typed DTOs; existing endpoints refactored to use service; >95% unit coverage.
  - Dependencies: None. Estimate: 3 pts.

- **Task**: Batch indexer jobs + delta hooks.
  - Acceptance: Background job seeds indexes; hooks on project/file create/update/delete enqueue delta updates; job metrics logged.
  - Dependencies: Service interface. Estimate: 3 pts.

### 4.3 Facet Data APIs (Backend)
- **Task**: Implement `/api/filters/tags` with caching.
  - Acceptance: Endpoint returns normalized tags with counts scoped by query params; 60s cache; contract test verifying shape.
  - Dependencies: Tag migration. Estimate: 2 pts.

- **Task**: Implement `/api/filters/languages` aggregation.
  - Acceptance: Aggregates from files table or search index; handles filters; perf test ≤ 200 ms p95 on fixture dataset.
  - Dependencies: None. Estimate: 2 pts.

## 5) Experience Assembly (Sprint 2)

### 5.1 API Surface Completion
- **Task**: Finalize `/api/search` v2 endpoint (cursor pagination, validation, error taxonomy).
  - Acceptance: Supports params per PRD; returns mixed result envelope; error codes documented; integration tests cover success, empty, invalid cases.
  - Dependencies: Search service abstraction. Estimate: 3 pts.

- **Task**: Dashboard view interoperability.
  - Acceptance: `/api/projects` accepts new filter params; ensures consistent DTO fields (tags with colors); regression tests for legacy responses.
  - Dependencies: Tag normalization. Estimate: 2 pts.

### 5.2 Frontend Search Modal
- **Task**: Build Search Modal shell & keyboard plumbing.
  - Acceptance: Hotkey triggers; focus trap; persists last scope; Storybook entry; unit tests for state hooks.
  - Dependencies: Basic design tokens. Estimate: 3 pts.

- **Task**: Results list + virtualization.
  - Acceptance: Virtualized list handles mixed entity tiles, multi-select; infinite scroll uses API cursor; ensures ≤ 16 ms frame budget.
  - Dependencies: Modal shell. Estimate: 3 pts.

- **Task**: Facet bar integration.
  - Acceptance: Tags, Language, Updated, Owner filters; local persistence; analytics events fired; query state shared with Filter Bar.
  - Dependencies: Facet APIs. Estimate: 3 pts.

### 5.3 Dashboard Filter Bar & Views Rail
- **Task**: Implement Views rail with routing + analytics.
  - Acceptance: View selection updates URL; accessible nav; events logged; By Tag expand works.
  - Dependencies: Tag API, design assets. Estimate: 2 pts.

- **Task**: Filter Bar chips + URL sync.
  - Acceptance: Multi-select tags with typeahead; language dropdown; updated presets; owner toggle; skeleton states; resets gracefully.
  - Dependencies: Shared search state. Estimate: 3 pts.

- **Task**: Connect filters to project grid (React Query store).
  - Acceptance: Filters update grid with optimistic skeleton; caches per-query; handles empty/error states per spec.
  - Dependencies: `/api/projects` enhancements. Estimate: 3 pts.

## 6) Hardening & Rollout (Sprint 3)

### 6.1 Testing & Performance
- **Task**: Load tests for `/api/search` and facet endpoints.
  - Acceptance: Gatling/locust scenario hitting 10 concurrent users, verifying p95 <500 ms; report stored in repo.
  - Dependencies: Backend endpoints stable. Estimate: 2 pts.

- **Task**: End-to-end tests for modal + filter bar.
  - Acceptance: Playwright/Cypress flows covering search execution, filter application, navigation, keyboard flows; integrated into CI.
  - Dependencies: FE features. Estimate: 2 pts.

- **Task**: Accessibility audit.
  - Acceptance: axe/lighthouse passes; manual keyboard review; documented issues resolved.
  - Dependencies: UI stable. Estimate: 2 pts.

### 6.2 Telemetry & Observability
- **Task**: Instrument client events (`search_opened`, `filter_applied`, etc.).
  - Acceptance: Events fire with payload; analytics pipeline receives; unit tests for instrumentation wrappers.
  - Dependencies: UI features. Estimate: 1 pt.

- **Task**: Backend metrics + logging.
  - Acceptance: Expose histogram for search latency; structured logs include query length bucket, scope; Grafana dashboard created.
  - Dependencies: Search service. Estimate: 2 pts.

### 6.3 Documentation & Runbook
- **Task**: Update API reference (OpenAPI) + developer docs.
  - Acceptance: `/api/search` and facet endpoints documented with examples; published in docs site.
  - Dependencies: Endpoint finalization. Estimate: 1 pt.

- **Task**: Author support runbook for indexing + troubleshooting.
  - Acceptance: Runbook covers migrations, backfill, index rebuild, feature flag procedures; stored in ops wiki.
  - Dependencies: Indexing tasks. Estimate: 1 pt.

### 6.4 Rollout Coordination
- **Task**: Feature flag gating (`TAGS_V2`, `SEARCH_V2`, `FILTER_BAR`).
  - Acceptance: Flags toggled via config; fallback to legacy search documented; smoke tests executed before broad enablement.
  - Dependencies: Entire feature set. Estimate: 1 pt.

- **Task**: Pilot rollout + feedback loop.
  - Acceptance: Internal cohort enabled; telemetry monitored 3 days; capture feedback + backlog adjustments.
  - Dependencies: Flags, telemetry. Estimate: 1 pt.

## 7) Resource Plan

- Backend engineer owns migrations, service, APIs, perf testing.
- Frontend engineer owns modal, filter bar, views rail, instrumentation.
- Design partners deliver final UI specs by Sprint 2 start.
- QA lead schedules regression suite during Sprint 3.
- PM/Tech Lead manage stakeholder reviews and rollout readiness.

## 8) Risks & Mitigations

- **Migration failure**: run staging backfill, add dry-run, maintain rollback scripts.
- **Latency regressions**: enforce perf tests, cache facets, iterate weighting after monitoring.
- **UI complexity**: share state management (Zustand/React Query) to avoid divergence; perform design QA.
- **Scope creep (semantic search)**: document future hooks, keep interface stable, defer vector work.

## 9) Acceptance Gate (Go/No-Go)

- All automated tests green, including perf thresholds.
- Telemetry dashboards live with alerts; baseline captured.
- Release playbook executed (flags toggled, pilot feedback addressed).
- Sign-off from Backend, Frontend, Product, Design, Support.

-----------------------------------------------------------------------------------
