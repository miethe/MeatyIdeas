---
title: "Implementation Plan — ProjectDetail Modal"
status: Draft
version: 0.1
date: 2025-09-19
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-19-project-detail-modal-prd.md
owner: Experience Delivery Lead (Backend: TBD, Frontend: TBD)
-----------------------------------------------------------------------------------

## 0) Summary

This plan details the work required to ship the ProjectDetail Modal referenced in the 2025-09-19 PRD. Delivery will layer backend APIs, modal UI, file tree infrastructure, and activity data into a cohesive, performant experience. Sequencing favors backend contracts first, followed by modal scaffolding, then tree/preview integrations, and concludes with telemetry and rollout.

## 1) Scope & Complexity

Complexity: L — moderate data access changes, new APIs, advanced frontend interactions (virtualized tree/preview), integration with Git activity. Target timeline 3.5 weeks with 1 backend + 1 frontend engineer, plus design and QA.

## 2) High-Level Workstreams

1. **Backend APIs & DTOs** — enriched project metadata, tree endpoint, file preview, activity aggregator.
2. **Frontend Modal Framework** — modal shell, navigation, keyboard/focus management.
3. **File Tree & Preview Experience** — virtualized tree, lazy loading, preview rendering, fallback states.
4. **Activity Tab Integration** — Git service hooks, job history display.
5. **Telemetry, Testing, Rollout** — analytics events, automated tests, feature flag gating.

## 3) Milestones & Timeline

- **Milestone A (Week 1)**: Backend contracts ready and tested; sample responses via mocked data.
- **Milestone B (Week 2)**: Modal shell + overview tab working against stubbed data; tree component prototype.
- **Milestone C (Week 3)**: Tree + preview + activity wired to live APIs, telemetry and tests complete; rollout prep.

## 4) Backend Delivery (Milestone A)

### 4.1 Enriched Project Metadata
- **Task**: Extend `/api/projects/:id` to include modal DTO fields (tags with colors, file counts, language mix, last commit summary).
  - Acceptance: Endpoint returns new fields; versioned schema validated; regression tests for existing consumers.
  - Dependencies: Tag normalization from Search project. Estimate: 3 pts.

- **Task**: Implement caching layer for project modal snapshot.
  - Acceptance: Cache keyed by project id + updated timestamp; invalidated by SSE events or updates; instrumentation showing hit rate.
  - Dependencies: Metadata endpoint. Estimate: 2 pts.

### 4.2 Project Tree Endpoint
- **Task**: Build `/api/projects/:id/tree` with pagination + depth controls.
  - Acceptance: Supports `cursor`, `path`, `depth`, `include_dirs`; returns folder-first sorted nodes; handles >10k nodes via pagination; contract tests ensure deterministic order.
  - Dependencies: Project metadata service. Estimate: 3 pts.

- **Task**: Add tree search parameter for quick filter.
  - Acceptance: `q` param filters nodes by prefix; returns limit 50; tested for performance ≤ 200 ms.
  - Dependencies: Tree endpoint. Estimate: 2 pts.

### 4.3 File Preview Endpoint
- **Task**: Implement `/api/files/:id/preview` route (alias of `/api/files/:id`).
  - Acceptance: Returns metadata + truncated content (≤200 KB) + `is_truncated`; handles unsupported MIME with flag; unit tests for text/binary.
  - Dependencies: File service. Estimate: 2 pts.

### 4.4 Activity Aggregator
- **Task**: Create `ProjectActivityService` to fetch recent commits and job events.
  - Acceptance: Aggregates ≤20 commits, ≤10 recent jobs; normalized DTO with type, message, timestamp, link.
  - Dependencies: Git service & job logs. Estimate: 3 pts.

- **Task**: Expose `/api/projects/:id/activity` endpoint.
  - Acceptance: Endpoint returns aggregated payload; supports `limit`, `types[]`; contract tests; latency ≤ 300 ms.
  - Dependencies: Activity service. Estimate: 2 pts.

## 5) Frontend Delivery (Milestones B & C)

### 5.1 Modal Shell & Routing
- **Task**: Build modal container with focus trap and ESC handling.
  - Acceptance: Accessible titles/descriptions; triggered via card click/hotkey; deep-link `?modal=project&id=` opens modal on load; Storybook entry.
  - Dependencies: Design tokens. Estimate: 3 pts.

- **Task**: Router integration + state persistence.
  - Acceptance: URL sync using Next router; close returns focus to origin; last active tab stored in local storage/user prefs.
  - Dependencies: Modal container. Estimate: 2 pts.

### 5.2 Overview Tab
- **Task**: Overview layout using new DTO fields.
  - Acceptance: Displays description, tags, stats, language bar, owners; skeleton state for loading; responsive down to 1024px.
  - Dependencies: Project metadata endpoint. Estimate: 2 pts.

- **Task**: CTA + quick actions.
  - Acceptance: `Expand →` navigates to project page; star toggle blocked (tooltip referencing future release); copy link button hidden behind flag.
  - Dependencies: Overview layout. Estimate: 1 pt.

### 5.3 File Tree
- **Task**: Implement virtualized tree component (leveraging `react-virtual`).
  - Acceptance: Lazy loads nodes via API; handles expand/collapse; keyboard nav (arrow keys, enter); tests for recursion edge cases.
  - Dependencies: Tree endpoint. Estimate: 4 pts.

- **Task**: Tree search input.
  - Acceptance: Debounced query hitting `q` param; results highlight matches; fallback message when no results.
  - Dependencies: Virtualized tree. Estimate: 2 pts.

### 5.4 File Preview
- **Task**: Preview renderer with syntax highlighting + markdown.
  - Acceptance: Select file loads preview with spinner; uses `prism`/`shiki` (existing infra) for code; markdown sanitized; displays truncation notice when `is_truncated` true.
  - Dependencies: File preview API. Estimate: 3 pts.

- **Task**: Unsupported file fallback and open-in-project CTA.
  - Acceptance: Non-text files render message with button to open full project view; ensures analytics fire.
  - Dependencies: Preview renderer. Estimate: 1 pt.

### 5.5 Activity Tab
- **Task**: Activity feed UI.
  - Acceptance: Renders commits and job events with icons; group by day; clickable to relevant views; skeleton for loading.
  - Dependencies: Activity API. Estimate: 2 pts.

- **Task**: Pagination/infinite scroll.
  - Acceptance: Fetch additional items on scroll; retains state when switching tabs; error handling with retry.
  - Dependencies: Activity feed. Estimate: 1 pt.

### 5.6 State Management
- **Task**: Modal store (Zustand/Context) centralizing metadata, tree, preview, activity caches.
  - Acceptance: Avoids redundant fetches; exposes hooks; unit tests for store transitions.
  - Dependencies: FE components. Estimate: 2 pts.

## 6) Quality, Telemetry, & Docs

### 6.1 Automated Testing
- **Task**: Backend integration tests for new endpoints (pytest).
  - Acceptance: Tests cover happy path, permissions, large trees, binary preview fallback.
  - Dependencies: Backend features. Estimate: 2 pts.

- **Task**: Playwright e2e covering modal flows.
  - Acceptance: Tests opening from dashboard, tree navigation, preview, activity tab, deep-link; runs in CI.
  - Dependencies: FE integration. Estimate: 2 pts.

- **Task**: Accessibility checks (axe) integrated into CI for modal page.
  - Acceptance: No critical violations; manual checklist completed.
  - Dependencies: UI stable. Estimate: 1 pt.

### 6.2 Telemetry & Logging
- **Task**: Emit FE events (`project_modal_opened`, `project_modal_tab_changed`, etc.).
  - Acceptance: Events include project id, tab, time-to-first-byte; verified in analytics pipeline.
  - Dependencies: Modal store. Estimate: 1 pt.

- **Task**: Backend structured logs & metrics.
  - Acceptance: Add timers for tree/preview/activity endpoints; Grafana panel for modal latency; alert threshold set.
  - Dependencies: Backend endpoints. Estimate: 1 pt.

### 6.3 Documentation
- **Task**: Update API docs and TypeScript client.
  - Acceptance: Endpoints documented with examples; TS client typed definitions regenerated.
  - Dependencies: Backend finalization. Estimate: 1 pt.

- **Task**: Author UX handoff + support guide.
  - Acceptance: Figma spec annotated; support doc covering feature, flags, troubleshooting.
  - Dependencies: UI completion. Estimate: 1 pt.

## 7) Rollout Strategy

- Feature flag `PROJECT_MODAL` wraps modal entry points.
- Internal alpha: enable flag for Meaty core team, monitor telemetry for 3 days.
- Staged rollout: enable for 25% users, then 100% once metrics stable.
- Backout plan: disable flag to revert to direct navigation; keep endpoints available for future reuse.

## 8) Dependencies & Coordination

- Relies on Search project for normalized tag data (colors, counts).
- Git integration team must expose recent commits endpoint or share aggregator interface.
- Design deliverables (modal layout, tree states) required by Milestone B start.
- QA and Support engaged before pilot for documentation + training.

## 9) Risks & Mitigations

- **Tree performance on large repos**: enforce pagination, add lazy loading indicators, prefetch limited nodes.
  
- **Preview size blow-ups**: cap content, show truncation banner, offer download action.

- **Activity data gaps**: fall back to commits-only view if job data unavailable; log warning for follow-up.

- **Path conflicts in API responses**: centralize DTO builder; add automated tests covering special characters.

## 10) Acceptance Gate

- Modal meets latency (<300 ms median) in staging load test.
- Functional, e2e, and accessibility suites pass in CI.
- Telemetry dashboard live; alert thresholds validated.
- Documentation completed; stakeholders sign off; support ready for inquiries.

-----------------------------------------------------------------------------------
