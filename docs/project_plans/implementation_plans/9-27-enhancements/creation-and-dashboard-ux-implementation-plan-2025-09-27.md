---
title: "Implementation Plan — Creation & Dashboard UX Enhancements"
status: Draft
version: 1.0
date: 2025-09-27
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-27-creation-and-dashboard-ux-prd.md
owner: Delivery Lead: TBD (Frontend: TBD, Backend: TBD)
-----------------------------------------------------------------------------------

## 0) Summary

Execute the dual-mode file creation experience, consolidate creation entry points, and upgrade the dashboard with inline project creation, sort controls, quick filters, group color presence, and a recent files rail. Work spans new backend APIs, React Query data orchestration, design system updates, telemetry, and accessibility compliance.

## 1) Scope & Complexity

Complexity: Medium-High — touches nav shell, project detail, global dashboard, file editor, project groups, and new backend endpoints. Requires close sequencing to avoid regressions in existing creation flows and to manage state explosion from new filters.

## 2) Workstreams

1. **Backend Services & APIs** — new create endpoint, recent files feed, project sorting, group color management.
2. **Creation Experience (Frontend)** — nav updates, Quick Create enhancements, full-screen Create... workflow, template stub.
3. **Dashboard Enhancements (Frontend)** — inline new project card, sort selector, quick filters, group visuals, recent files rail.
4. **Design System, Telemetry & QA** — shared components, accessibility, analytics plumbing, rollout readiness.

## 3) Milestones & Timeline

- **Week 1**: Backend endpoints, schema validations, group color API updates.
- **Week 2**: Nav + creation flows, Quick Create refactor, Create... screen skeleton, unit smoke.
- **Week 3**: Dashboard UI upgrades, telemetry wiring, accessibility & QA, launch checklist.

## 4) Backend Services & APIs (Week 1)

### 4.1 File Creation Endpoint
- **Task**: Add `POST /files` accepting `{ project_id, title, path, content_md, tags, template_id? }`; reuse existing serializer and publish events.
  - Acceptance: Endpoint returns new file payload, enforces project ownership, responds <250ms P95.
  - Dependencies: Existing `/files/project/{id}` logic (reuse core function).
  - Estimate: 3 points.

### 4.2 Recent Files Feed
- **Task**: Implement `GET /files/recent` with pagination (`limit`, `cursor`), filtering to accessible projects, returning project summary data.
  - Acceptance: Results sorted by `updated_at desc`, includes `{ file_id, title, project: { id, name, color }, updated_at }`; integration test with fixtures.
  - Dependencies: File and project models, permission rules.
  - Estimate: 3 points.

### 4.3 Project Sorting Support
- **Task**: Extend `GET /projects` to accept `sort` param (enum). Implement server-side ordering (updated_at, name asc/desc, created_at asc/desc) with indexes.
  - Acceptance: Validation on invalid sort; query plan confirmed with EXPLAIN; regression tests cover ordering.
  - Dependencies: Dashboard query usage.
  - Estimate: 2 points.

### 4.4 Group Color Mutations
- **Task**: Ensure project group APIs accept and persist `color` (hex) updates; add validation helper.
  - Acceptance: Invalid hex rejected with 400; color returned in list/detail endpoints.
  - Dependencies: Current groups router.
  - Estimate: 1 point.

### 4.5 Telemetry Contracts
- **Task**: Document payloads for new analytics events (see PRD §10) and expose server config if needed.
  - Acceptance: Shared schema doc in `docs/telemetry/creation-dashboard.md`.
  - Dependencies: Events publisher.
  - Estimate: 1 point.

### 4.6 Workspace Status Config
- **Task**: Ensure workspace status definitions are configurable (either persisted or config-driven) and exposed via `/config` for dashboard filters.
  - Acceptance: API returns status list with label + key, honors workspace overrides; regression tests cover defaults.
  - Dependencies: Existing config service.
  - Estimate: 1 point.

## 5) Creation Experience (Frontend) (Week 2)

### 5.1 AppShell "New" Menu
- **Task**: Replace existing button with dropdown menu; wire `New Project`, `New File → Quick Create`, `New File → Create...`; respect keyboard interactions.
  - Acceptance: Dropdown accessible (arrow nav, focus trap), integrates with feature flag, triggers telemetry.
  - Dependencies: Radix menu components already in use.
  - Estimate: 2 points.

### 5.2 Quick Create Dialog Enhancements
- **Task**: Refactor `FileCreateDialog` to accept optional `initialProjectId`; add project selector (combobox) at top and validation.
  - Acceptance: Works from nav (no project preselected) and within project page (prefilled); hitting submit calls new `POST /files` endpoint; regression tests for initial slug logic.
  - Dependencies: 4.1 API, existing dialog component.
  - Estimate: 3 points.

### 5.3 Full-Screen Create... Flow
- **Task**: Create new route `/files/create` (or `/projects/[project]/create`) with layout reusing `RichEditor` components but scoped to new file creation (no file ID yet). Support template dropdown (single `Blank` option), metadata inputs, and dual actions for `Save` vs `Save & Close`.
  - Acceptance: "Save" persists without leaving the screen, "Save & Close" returns to the previous context; guard prevents duplicate submissions or accidental double saves.
  - Dependencies: 4.1 API, existing editor utilities.
  - Estimate: 4 points.

### 5.4 Keyboard Shortcuts & Events
- **Task**: Update hotkeys (`n`, `shift+n`) to open appropriate flows; add event dispatch bridging for nav (like existing project hotkey).
  - Acceptance: Works across dashboard/project pages without clobbering input fields.
  - Dependencies: 5.1.
  - Estimate: 1 point.

## 6) Dashboard Enhancements (Frontend) (Week 3)

### 6.1 Inline New Project Card
- **Task**: Add placeholder card component at end of `ProjectGrid`; use existing sheet trigger.
  - Acceptance: Responsive layout parity; accessible label (`aria-label="Create new project"`).
  - Dependencies: AppShell button removal (5.1).
  - Estimate: 1 point.

### 6.2 Sort Selector Integration
- **Task**: Add `Sort` dropdown; sync with URL query + React Query key; update fetchProjects to send `sort` param.
  - Acceptance: Changing sort triggers refetch, persists on reload, telemetry event fires.
  - Dependencies: 4.3 API.
  - Estimate: 2 points.

### 6.3 Quick Filter Ribbon
- **Task**: Build chip list component with horizontal scroll, loading status options from workspace config and top-N groups (fetch via `/project-groups`). Store selected chips in search params and query key.
  - Acceptance: Status chips single-select using config-provided labels, group chips multi-select, clear button appears when active; combinations compose with existing filters; accessible semantics.
  - Dependencies: 4.3 sort (shared query), group color data (4.4).
  - Estimate: 3 points.

### 6.4 Group Badge Styling
- **Task**: Update dashboard card + project detail badges to use new color tokens, ensure contrast (WCAG AA). Possibly centralize in `GroupBadge` component.
  - Acceptance: Snapshot test or Storybook entry verifying color usage; fallback to default when color missing.
  - Dependencies: 4.4 API.
  - Estimate: 2 points.

### 6.5 Recent Files Rail
- **Task**: Add sidebar/section to dashboard layout fetching `useQuery(['recent-files'])`; render list with actions (`Quick peek`, `Open`).
  - Acceptance: Loading skeleton, empty state copy, respects feature flag; telemetry on click.
  - Dependencies: 4.2 API; ensure layout responsive (stack on small screens).
  - Estimate: 3 points.

## 7) Design System, Telemetry & QA (Week 3)

### 7.1 Component Library Updates
- **Task**: Create reusable components (ProjectSelector, FilterChips, GroupBadge). Document in Storybook and add tests.
  - Acceptance: Components exported via `/components/...`; Storybook stories with controls.
  - Dependencies: 5.x/6.x tasks consuming components.
  - Estimate: 2 points.

### 7.2 Telemetry Wiring
- **Task**: Emit events defined in PRD from nav menu, create flows, sort/filter interactions, recent file actions; ensure payload schema accuracy.
  - Acceptance: Events visible in dev analytics; unit smoke tests for event creators.
  - Dependencies: 4.5 contract, 5.x/6.x UI.
  - Estimate: 1 point.

### 7.3 Accessibility & QA Sweep
- **Task**: Conduct keyboard-only walkthrough, AXE scans, run regression suite for file/project creation.
  - Acceptance: No critical accessibility violations; QA sign-off doc in `docs/qa/2025-09-27-creation-dashboard.md`.
  - Dependencies: Feature complete UI.
  - Estimate: 2 points.

### 7.4 Launch & Feature Flagging
- **Task**: Implement `ux_creation_dashboard_refresh` flag gating new UI; create rollout checklist, update docs & release notes.
  - Acceptance: Flag toggles entire experience safely; runbook stored in `docs/runbooks/ux_creation_dashboard_refresh.md`.
  - Dependencies: Prior tasks complete.
  - Estimate: 1 point.

## 8) Risks & Mitigations

- **State Explosion**: New filters could multiply cache keys. Mitigation: centralize query key builder and limit group chips to top 6 by usage.
- **Performance Regression**: Recent files endpoint could be heavy. Mitigation: add composite index on `(workspace_id, updated_at DESC)` and cache results for short TTL.
- **Color Contrast Failures**: Validate chosen colors via automated checker; enforce fallback when failing.
- **User Confusion Between Modes**: Add tooltip copy explaining Quick vs Create..., include in release notes and onboarding banner.

## 9) Exit Criteria

- New file creation endpoint and frontend flows live behind feature flag with telemetry verified.
- Dashboard shows new sort selector, quick filters, inline new project card, recent files rail with responsive layout and no console errors.
- Group badges render accessible colors across dashboard and project detail.
- Telemetry dashboards populated, QA + accessibility sign-off complete, rollout plan approved.

## 10) Dev-Ready Breakdown (Repo Touchpoints)

### Backend
- `app/api/routers/files.py`: Add `POST /files`, recent feed route, serializer tweaks.
- `app/api/routers/projects.py`: Support `sort` param.
- `app/api/routers/groups.py`: Color validation + persistence.
- `app/api/schemas.py`: Update request/response models.
- `app/api/tests/`: New tests for file create endpoint, recent feed, sort orders, color validation.
- `alembic/`: Confirm indices exist; add migration if new index needed.

### Frontend
- `app/frontend/components/app-shell.tsx`: Replace new button with dropdown, integrate feature flag.
- `app/frontend/components/files/file-create-dialog.tsx`: Add project selector, use new endpoint.
- `app/frontend/app/files/create/page.tsx` (new): Full-screen create flow.
- `app/frontend/components/projects/project-card` (existing in page.tsx): Inline new card, group badges, sort dropdown.
- `app/frontend/components/dashboard/recent-files.tsx` (new). 
- `app/frontend/lib/apiClient.ts`: Helpers for new endpoints if needed.
- `app/frontend/lib/queryKeys.ts` (new or updated) for consistent query key generation with filters.

### Shared/Docs
- Storybook entries for new components.
- `docs/telemetry/creation-dashboard.md`, `docs/qa/2025-09-27-creation-dashboard.md`, `docs/runbooks/ux_creation_dashboard_refresh.md`.

## 11) Testing Plan

- Unit tests for new API request/response schemas.
- React Testing Library coverage for nav menu, quick filter chips, recent files rail interactions.
- End-to-end smoke (Playwright/Cypress) for Quick Create and Create... flows from nav and project context.
- Performance check: load dashboard with 50 projects; ensure render time comparable to baseline.
- Accessibility audit with AXE + manual screen reader spot checks on nav menu and new filters.

## 12) Rollout Checklist

1. Verify feature flag defaults to off in production config.
2. Deploy backend + frontend; enable flag in staging.
3. Run regression suite + accessibility checks in staging.
4. Share release note & short loom demo with stakeholders.
5. Enable flag for internal users; monitor telemetry for 48 hours.
6. Gradually enable for all workspaces; monitor error dashboards.
7. Remove flag after stable week, archive runbook.

