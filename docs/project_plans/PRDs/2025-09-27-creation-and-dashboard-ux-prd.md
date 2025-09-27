---
title: "MeatyProjects — Creation & Dashboard UX Enhancements PRD"
version: 1.0
status: Draft
date: 2025-09-27
owner: Product: TBD, Tech Lead: TBD
---

## 1) Purpose & Vision

Streamline how teams create files and projects while making the dashboard a richer control center. Introduce dual file creation modes, a unified "New" entry point, faster project bootstrapping, visible project group cues, plus two net-new improvements—a quick filter ribbon and a recent files rail—to keep contributors oriented and productive from the moment they land in the app.

## 2) Background & Problems Today

- File creation only works inside an open project, with a single modal and no way to prefill project context or use templates from the global nav.
- The top navigation only exposes "New Project," splitting creation workflows across disparate surfaces.
- The dashboard lacks an affordance for creating a project inline, and projects cannot be sorted by user preference.
- Project group affiliation exists but is visually subtle, so teams cannot scan for group ownership.
- Users must click into filters menus or drill into projects to find relevant content; the workspace offers no at-a-glance recent activity.
- Early-stage teams need better guidance yet the workspace presents empty states without actionable next steps.

## 3) Goals & Non-Goals

In scope
- Offer "Quick Create" and "Create..." file flows with project selection and template prep.
- Replace the nav "New Project" button with a "New" dropdown that routes to project or file creation (with nested file options).
- Add an inline "New Project" card and dashboard sort selector with multiple ordering options.
- Elevate project group visibility using customizable colors on dashboard cards and project detail views.
- Add a dashboard quick filter ribbon (status + group chips) for one-click scoping.
- Surface a "Recent Files" module highlighting the latest cross-project work.

Out of scope
- Fully featured file template management (only a stub picker with "Blank" for now).
- Bulk file creation or import workflows beyond existing import dialog.
- Deep redesign of project detail layout beyond group badge styling.
- Notification system or email digests for recent activity (dashboard-only scope).

## 4) Target Users & JTBD

- **Product Builders**: "When I have an idea, I want to spin up the right project or file in seconds without losing context."
- **Project Leads**: "When I glance at the dashboard, I need to recognize ownership, filter to my focus areas, and jump into active work."
- **Knowledge Curators**: "When organizing content, I need recent edits surfaced and consistent entry points so documentation stays tidy."

## 5) Success Metrics

- ≥ 60% of file creations initiated from the top nav automatically carry the intended project context (telemetry within 30 days).
- Decrease duplicate project creations caused by hidden entry points by 50% (compare baseline to post-launch events).
- Dashboard filter interactions per active session increase by ≥ 30% (status/group chip usage).
- 80% of usability test participants can identify a project's group in under 2 seconds (benchmarked via moderated tests).
- Adoption: at least 70% of weekly active users open the Recent Files rail within two weeks of launch.

## 6) Experience Overview

### 6.1 Dual File Creation Modes
- Clicking "Quick Create" opens the existing modal with a new required "Project" selector at the top. The field defaults to the current project (if the user is scoped) or empty with validation.
- Clicking "Create..." opens a full-screen editor seeded with rich markdown controls, metadata inputs, and a template dropdown (currently "Blank" only) before the user lands in the permanent editor route.
- Both flows support keyboard shortcuts (`N` for Quick Create within a project, `Shift+N` for Create... once implemented) and show a success toast + redirect to the created file modal.

### 6.2 Global "New" Menu
- The nav button becomes `New ▾`. Options: `New Project`, `New File → Quick Create`, `New File → Create...`.
- Menu items respect project context: when on a project route, file creation defaults the selector; otherwise, the user must choose a project.
- The dropdown honors existing feature flags so future create types (e.g., intake forms) can slot in.

### 6.3 Dashboard Inline Creation & Sorting
- A final card in the project grid shows a `+ New Project` tile mirroring other cards' dimensions. Clicking launches the project create sheet.
- A "Sort" dropdown (right-aligned above the grid) includes `Last Updated` (default, desc), `Name (A-Z)`, `Name (Z-A)`, `Date Created (Newest)`, `Date Created (Oldest)`.
- Sort selection persists in the URL query to keep the page shareable/bookmarkable.

### 6.4 Group Visibility Enhancements
- Project cards display prominent color chips/badges per group (using stored HEX values) with accessible contrast.
- Project detail headers reuse the same badge design, ensuring color and label consistency.
- Group colors can be managed in the groups dialog (color picker with preset palette + hex entry).

### 6.5 Dashboard Quick Filters (New Recommendation)
- Add a horizontal chip list under the dashboard header with two segments: project status (Idea, Discovery, Draft, Live, Archived) and top project groups.
- Chips toggle filters in combination with existing view filters (chips reflect active state, support multi-select across groups but single-select for status).
- Empty state hints appear if no items match (with clear CTA to reset filters).

### 6.6 Recent Files Rail (New Recommendation)
- Right column (or beneath filters on mobile) shows a list of the five most recently updated files across projects, each with title, project badge, timestamp, and quick open icon.
- Hovering a row reveals "Open" and "Peek" actions; clicking uses existing modal/viewer flows.
- A "View all" link routes to `/files/recent` (future scope but link can be stubbed with same filter view or command palette fallback).

## 7) Functional Requirements

1. File creation UI exposes both Quick Create and Create... options in nav and in-project contexts.
2. File creation requires selecting a project; defaults obey route context and enforce validation when blank.
3. Create... full-screen experience pre-populates editor with template content, metadata fields (title, tags, optional summary), and supports draft autosave before final submission.
4. Top nav "New" menu and project blank card trigger existing project and file creation flows without regressions.
5. Dashboard sort dropdown updates project queries and URL params; backend honors sort keys efficiently.
6. Project group badges display stored color token, fallback to default if undefined, and remain AA contrast compliant.
7. Dashboard quick filter chips toggle query parameters and combine with existing view/language/tag filters.
8. Recent Files rail queries a new `/files/recent` endpoint scoped to the current user workspace, sorted by `updated_at` with pagination.
9. All new UI elements respect responsive breakpoints (mobile: nav menu collapses, chips scroll horizontally, recent files stack below projects).
10. Telemetry events fire for new menu selections, filter usage, and recent file opens.

## 8) System & Architecture Requirements

- Introduce a backend endpoint to create files by project ID independent of the current page (`POST /files` with `project_id`), reused by both creation modes.
- Extend file serializer to support lightweight template injection (initially static blank template constant).
- Build `/files/recent` endpoint leveraging existing `File` table indexes; cap results and include project summary data to avoid extra round-trips.
- Update project list API to accept `sort` parameter with server-side ordering for requested fields.
- Persist quick filter state in URL query; React Query keys should include status/group filters to avoid stale caches.
- Add group color attributes to the groups API payloads if not already present and support updates via existing mutation endpoints.

## 9) Data Model Changes

- No new tables required. Ensure `ProjectGroup.color` persists HEX values and validate format on write.
- Optionally store a `last_viewed_at` per user-file in future; not required for MVP but consider telemetry storage for recent rail to avoid conflict with actual `updated_at` semantics.

## 10) Analytics & Telemetry

- `nav_new_select` with payload `{ item: 'project' | 'file_quick' | 'file_full', context_project_id }`.
- `file_create_mode` with `{ mode: 'quick' | 'full', project_id, template }`.
- `dashboard_sort_change` with `{ sort_key }`.
- `dashboard_filter_chip` with `{ type: 'status' | 'group', value, active }`.
- `recent_file_open` with `{ file_id, action: 'peek' | 'open' }`.
- Monitor conversion funnel: nav entry → project selection → successful creation.

## 11) Rollout Strategy

- Ship behind a temporary `ux_creation_dashboard_refresh` feature flag.
- Roll out to internal users first; gather feedback on color contrast and create flows.
- Enable for staging, monitor analytics/telemetry and error rates, then graduate to production after one week of stability.
- Provide documentation snippet in release notes and update onboarding checklist.

## 12) Dependencies & Coordination

- Design for new dropdown, full-screen editor layout, chips, and recent files card list.
- Backend collaboration for new file create endpoint, recent files API, and project sort options.
- QA for regression around file/project creation, filter combinations, and responsive layout.
- Accessibility review focused on new interactive controls (dropdown nesting, chips, color pickers).

## 13) Open Questions

1. Should Create... redirect to the persistent editor page after save or remain in modalized view? (Proposal: land on editor route with success toast.) A: For now, there should be a "Save" which remains on the screen, and "Save and Close" button should return to the previous context. Future enhancement will add autosaving and drafts, with only a "Save and Close" button to return to the previous context.
2. Do we allow multi-project recent files for all users, or should we respect permissions/visibility rules? (Assume same permissions as project list for now.) A: Yes, respect existing permissions.
3. Are status chips configurable per workspace? A: Yes.
4. Does the recent files rail need to include file owner metadata? A: Future enhancement.

## 14) Risks & Mitigations

- **Scope Creep on Templates**: Limit to static "Blank" option, log future template work separately.
- **Color Accessibility**: Provide preset palette with accessible defaults, enforce contrast check in picker.
- **API Load**: Recent files endpoint may introduce additional queries; add limit/offset and caching as needed.
- **State Drift**: New filters + sort combinations increase cache keys; ensure invalidations are centralized.

## 15) Definition of Done

- Dual file creation flows operate from nav and project contexts with validated project selection and telemetry.
- Dashboard displays new sort selector, quick filters, recent files rail, and inline new project card without layout regressions.
- Project group colors render consistently on dashboard and project detail view with accessible contrast.
- Backend endpoints for file creation, sorting, and recent files achieve performance SLAs (<300ms P95).
- Feature flag removed following successful QA, accessibility, and analytics sign-off.
