---
title: "Implementation Plan — Dashboard Views & Project Cards"
status: Draft
version: 0.1
date: 2025-09-19
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-19-dashboard-views-and-project-cards-prd.md
owner: Growth Experience Delivery Lead (Backend: TBD, Frontend: TBD)
-----------------------------------------------------------------------------------

## 0) Summary

Execute the dashboard overhaul by delivering view-aware APIs, filter bar UX, multi-density project cards, and telemetry instrumentation. Work is staged across three workstreams: backend aggregation, UI components, and analytics/perf. Goal: reduce navigation churn while maintaining performance budgets (TTI ≤ 1.5 s, grid render ≤ 100 ms for 100 cards).

## 1) Scope & Complexity

Complexity: L — cross-cutting FE/BE updates, new caching, responsive UI variants, telemetry. Timeline ~4 weeks with 1 backend, 2 frontend (cards + filters), plus design + analytics support.

## 2) Workstreams

1. **Backend Aggregation & APIs** — enriched project list DTO, view/filter logic, pagination.
2. **Frontend Views & Filters** — views rail, filter bar, shared state, URL sync.
3. **Project Card Variants** — component system, density toggle, quick actions.
4. **Performance & Telemetry** — caching, perf tests, analytics wiring.
5. **Docs & Rollout** — runbooks, support, feature flags.

## 3) Milestones & Timeline

- **Phase 1 (Week 1)**: Backend API modernization, caching, schema alignment.
- **Phase 2 (Week 2-3)**: Frontend views/filter experiences, card variants with placeholder data.
- **Phase 3 (Week 4)**: Performance tuning, telemetry, rollout + docs.

## 4) Backend Delivery (Phase 1)

### 4.1 API Enhancements
- **Task**: Expand `/api/projects` to support new query params (`view`, `tags[]`, `language[]`, `owner`, `updated_after`, `sort`, `limit`, `cursor`).
  - Acceptance: Endpoint handles new params with validation and consistent error codes; legacy behavior preserved when params absent; integration tests cover each view.
  - Dependencies: Tag normalization (Search project). Estimate: 3 pts.

- **Task**: Deliver enriched DTO for cards.
  - Acceptance: Response includes description, tags (color), file_count, language_mix, owners, highlight snippet, activity sparkline, starred flag; typed schema exported for FE client.
  - Dependencies: Underlying services (project metadata, analytics). Estimate: 3 pts.

### 4.2 Aggregation & Caching
- **Task**: Implement `ProjectListAggregator` combining data with minimal queries.
  - Acceptance: Uses batched queries/joins, prevents N+1; unit tests verifying query counts; instrumentation logging durations.
  - Dependencies: DTO definition. Estimate: 3 pts.

- **Task**: Response caching + invalidation.
  - Acceptance: Cache subset responses by view/filter fingerprint with TTL; invalidated on project update; ensures stale-while-revalidate pattern.
  - Dependencies: Aggregator. Estimate: 2 pts.

### 4.3 Supporting Services
- **Task**: Owner + star data retrieval.
  - Acceptance: Ensure star relationships accessible; endpoint includes user-specific `starred` flag; caches per-user portion separately.
  - Dependencies: Auth context. Estimate: 2 pts.

- **Task**: Tag usage summary for left rail.
  - Acceptance: Provide top 10 tags with counts for "By Tag" view; API used by views rail or reuse facet endpoint.
  - Dependencies: Tag normalization. Estimate: 1 pt.

## 5) Frontend Experience (Phase 2)

### 5.1 Shared State & Routing
- **Task**: Create dashboard state store (React Query + Zustand) syncing view/filter/density to URL.
  - Acceptance: Single source of truth; `useDashboardFilters` hook; tests for serialization/deserialization; handles back/forward navigation.
  - Dependencies: API finalized. Estimate: 3 pts.

- **Task**: Views rail component.
  - Acceptance: Accessible keyboard nav; active state highlight; By Tag accordion fetching top tags; analytics events for selection.
  - Dependencies: Tag summary data. Estimate: 2 pts.

### 5.2 Filter Bar
- **Task**: Filter chip components (Tag, Language, Updated, Owner).
  - Acceptance: Tag chip supports multi-select with typeahead; language multi-select; updated presets + custom range; owner toggle; unit tests verifying state transitions.
  - Dependencies: Shared state hook. Estimate: 3 pts.

- **Task**: URL sync + reset handling.
  - Acceptance: Filter changes update URL; reset clears filters and view; deep links restore state on load; e2e test added.
  - Dependencies: Filter chip components. Estimate: 2 pts.

### 5.3 Project Grid Integration
- **Task**: Connect grid to new API with skeleton states.
  - Acceptance: React Query fetch with caching; skeleton placeholders appear on fetch; errors show inline message with retry; empty state per design.
  - Dependencies: Backend API availability. Estimate: 2 pts.

- **Task**: Sorting + pagination/infinite scroll.
  - Acceptance: Scroll loads new pages using cursor; `sort` param respects selection; ensures smooth animation and focus retention.
  - Dependencies: Grid integration. Estimate: 2 pts.

## 6) Project Card Variants (Phase 2-3)

### 6.1 Component System
- **Task**: Build base `ProjectCard` primitive.
  - Acceptance: Accepts data props; handles hover interactions; composed with shadcn tokens; Storybook docs for default state.
  - Dependencies: Design tokens. Estimate: 2 pts.

- **Task**: Implement Compact/Standard/Rich variants.
  - Acceptance: Variants built via composition; responsive breakpoints adjust layout; storybook examples with knobs; visual regression tests.
  - Dependencies: Base card. Estimate: 3 pts.

- **Task**: Density toggle control.
  - Acceptance: Segmented control storing preference (local storage + user prefs when available); toggling updates grid; analytics events fired.
  - Dependencies: Card variants. Estimate: 2 pts.

### 6.2 Quick Actions & Interactions
- **Task**: Star toggle + optimistic update.
  - Acceptance: Hover reveals star button; toggling updates UI immediately; background mutation handles API response; error toast on failure.
  - Dependencies: API support for star/unstar. Estimate: 2 pts.

- **Task**: Quick peek + quick open actions.
  - Acceptance: Buttons appear on hover; quick peek triggers `ProjectDetail` modal (flag aware); quick open launches new tab; ensures focus management.
  - Dependencies: Modal availability. Estimate: 2 pts.

- **Task**: Tag/Pill interactions.
  - Acceptance: Clicking tag adds filter; cmd+click opens search modal seeded with tag; analytics event recorded.
  - Dependencies: Filter bar + search modal integration. Estimate: 1 pt.

## 7) Performance & Telemetry (Phase 3)

### 7.1 Performance Work
- **Task**: Web vitals measurement and regression guard.
  - Acceptance: Add custom metric logging for grid render time and TTI; perf tests on staging dataset; thresholds documented.
  - Dependencies: FE integration. Estimate: 2 pts.

- **Task**: Backend load testing for `/api/projects` new payload.
  - Acceptance: Load test scenario at 20 rps; p95 latency ≤ 250 ms; CPU/memory recorded; adjustments made as needed.
  - Dependencies: Backend finalization. Estimate: 2 pts.

### 7.2 Telemetry
- **Task**: Client analytics events.
  - Acceptance: Emit `dashboard_view_changed`, `dashboard_filter_applied`, `project_card_impression`, `project_card_clicked`, `project_card_density_changed`; events include metadata per PRD.
  - Dependencies: UI features. Estimate: 1 pt.

- **Task**: Impression tracking using Intersection Observer.
  - Acceptance: Cards fire impression once per session when ≥50% visible; sampling to avoid over-reporting; unit tests or harness verifying behavior.
  - Dependencies: Card components. Estimate: 2 pts.

### 7.3 Monitoring & Alerts
- **Task**: Dashboards for API and UI metrics.
  - Acceptance: Grafana/Looker board showing API latency, error rate, event counts; alert thresholds defined.
  - Dependencies: Telemetry events + backend metrics. Estimate: 1 pt.

## 8) QA & Accessibility

- **Task**: QA test plan creation.
  - Acceptance: QA writes scenarios covering views, filters, densities, quick actions, offline/error states; reviewed by PM.
  - Dependencies: Before Phase 2 testing. Estimate: 1 pt.

- **Task**: Accessibility review.
  - Acceptance: axe audits, keyboard navigation checks, color contrast validation for tags/views; documented sign-off.
  - Dependencies: UI stable. Estimate: 1 pt.

- **Task**: Visual regression snapshot tests.
  - Acceptance: Chromatic/Storybook tests for card variants across densities; baseline approved.
  - Dependencies: Card components. Estimate: 1 pt.

## 9) Documentation & Enablement

- **Task**: Update user help center + onboarding content.
  - Acceptance: Guides explaining views, filters, density toggle; includes gifs/screenshots.
  - Dependencies: UI final. Estimate: 1 pt.

- **Task**: Internal playbook for support.
  - Acceptance: FAQ covering common issues (filters not loading, star sync, latency); posted to support wiki.
  - Dependencies: QA insights. Estimate: 1 pt.

## 10) Rollout Plan

- Feature flag `DASHBOARD_V2` gating all new components.
- Pilot with internal org; collect qualitative feedback.
- Progressive rollout with metrics guard (error rate <0.5%, TTI within budget).
- Retain legacy list view accessible via link for one release cycle; remove once metrics stable.

## 11) Dependencies & Coordination

- Depends on Search project for normalized tags and shared filter state patterns.
- Requires ProjectDetail Modal for quick peek integration (if not ready, hide button behind `PROJECT_MODAL` flag).
- Design deliverables: final cards, filter bar, views rail specs due before Phase 2.
- Analytics team to validate event schemas and dashboards.

## 12) Risks & Mitigations

- **Payload bloat**: monitor response size; push highlights to optional field; compress via gzip.
- **UI clutter**: enforce design QA, use density toggle defaults, gather pilot feedback.
- **Telemetry noise**: implement sampling + batching; coordinate with analytics.
- **Cache staleness**: central invalidation strategy tied to project update events; monitor stale-hit rate.

## 13) Acceptance Gate

- API and UI tests passing in CI; perf budgets met on staging dataset.
- Telemetry dashboards live and monitored; alerts configured.
- Documentation and support materials published.
- Flag rollout checklist complete; stakeholders sign off on release to 100% of users.

-----------------------------------------------------------------------------------
