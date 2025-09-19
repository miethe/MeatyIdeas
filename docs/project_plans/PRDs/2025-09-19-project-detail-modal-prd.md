---
title: "MeatyProjects — ProjectDetail Modal PRD"
version: 1.0
status: Draft
date: 2025-09-19
owner: Product & Experience Squad (PM: TBD, Design Lead: TBD)
---

## 1) Purpose & Vision

Enable builders to preview a project’s structure, content, and recent activity without leaving the dashboard. The ProjectDetail Modal should feel instant, give confident context, and provide a springboard into deeper workflows like editing, sharing, or Git operations.

## 2) Background & Problems Today

- Users must load the full project page to inspect files, which can be slow and disorienting when triaging multiple projects.
- There is no consistent quick-view UI; card clicks currently navigate away, breaking focus during review sessions.
- Previewing file contents requires jumping between multiple tabs and waiting for heavy components to load.
- Activity signals (recent commits, top files) are buried, making it hard to assess project freshness at a glance.

## 3) Goals & Non-Goals

In scope
- Modal launched from dashboard cards and keyboard navigation with persistent deep-link support.
- Split-pane UI: left file tree, right-side tabs for Overview, File Preview, and Activity.
- Lazy data fetching to keep first paint fast (<300 ms) and avoid unnecessary payloads.
- Fallback states for unsupported file types, empty projects, and limited metadata.

Out of scope
- In-modal editing of files or settings (view-only context in MVP).
- Real-time collaborative cursors or presence indicators.
- Advanced analytics (burndown, velocity) beyond basic activity recap.
- Mobile-specific redesign (desktop-first, responsive adjustments optional but not primary).

## 4) Target Users & JTBD

- **Builder / Owner**: "I’m triaging which projects to polish; let me peek at structure and README quickly." Needs fast access to overview and preview.
- **Reviewer / Manager**: "I’m preparing an update; I want to confirm recent activity and top files without context switching." Needs activity tab and quick navigation.
- **New Contributor**: "I’m onboarding to a project; I want to scan directories and read the README before diving in." Needs intuitive tree and preview.

## 5) Success Metrics

- Modal open to first content render ≤ 300 ms median, ≤ 450 ms p90.
- ≥ 70% of dashboard card clicks open modal (vs direct navigation) after launch.
- ≥ 50% of modal sessions interact with File Preview or Activity tabs.
- Drop-off rate (close modal within 3 seconds) ≤ 15%.
- Error rate (failed to load tree or preview) ≤ 1% per 10k modal opens.

## 6) Experience Overview

### 6.1 Invocation & Navigation
- Open from card click, card keyboard shortcut (`Enter`), or quick menu action ("Quick peek").
- Support query parameter `?modal=project&id=<project_id>` for deep links; back/forward retains state.
- Closing modal returns focus to previously focused card or trigger.

### 6.2 Layout
- **Header**: project name, key tags, star toggle, last updated, primary CTA `Expand →` (navigates to full project page), secondary actions for copy link / share (future flags).
- **Left Pane**: virtualized file tree with lazy loading per directory. Supports folder expand/collapse, file selection, and shows file type icons.
- **Right Pane Tabs**:
  - **Overview**: description, top tags, file count, language distribution bar, owners/avatars, quick stats (last commit summary, last editor).
  - **File Preview**: renders text/markdown files; code viewer with syntax highlighting; fallback message for unsupported types with link to open full view.
  - **Activity**: recent commits list (message, author, timestamp), recent file changes, upcoming scheduled jobs (if any).
- Responsive behavior collapses tree on narrow viewports with toggle button.

### 6.3 Interactions
- Selecting a file in the tree loads preview tab automatically; maintain loading indicator with skeleton lines.
- `Cmd+P` within modal jumps focus to tree search input for quick file find.
- If project has no files, show empty state with CTA to import or open project.
- Activity entries link to Git panel or change view when available.

## 7) Functional Requirements

### 7.1 Data Fetching
1. Initial modal open fetches minimal payload: project meta (name, tags, updated, summary stats).
2. File tree endpoint returns paginated children with folder-first ordering and counts.
3. File preview fetch lazily loads content; limit text preview to 200 KB and indicate truncation when exceeded.
4. Activity tab fetches recent commits (≤ 20) and file change summaries; load on tab first exposure and cache in session.
5. All requests include etag/last-modified headers for caching.

### 7.2 Tree & Preview Behavior
1. Tree selection keeps previously expanded state when modal reopens during session.
2. Multi-select not required in MVP; arrow keys navigate tree items, `Enter` opens file.
3. Display file badges for README/highlighted files; if README exists, auto-select on first open.
4. Provide inline search input (typeahead) at top of tree for quick filtering.

### 7.3 Accessibility & Feedback
1. Modal uses focus trap and accessible labels for sections/tabs.
2. Screen readers announce tab changes and file load completion.
3. Error states show descriptive message with retry; fallback ensures no blank panes.
4. Loading states show skeleton UI for tree nodes and preview text.

### 7.4 Analytics
1. Emit events: `project_modal_opened`, `project_modal_tab_changed`, `project_modal_file_previewed`, `project_modal_expand_clicked`.
2. Capture file extensions previewed and tree depth interactions to inform future optimizations.

## 8) System & Architecture Requirements

- APIs: extend `/api/projects/:id` to return modal metadata (tags, stats, languages, readme slug).
- Add `/api/projects/:id/tree` with pagination (`cursor`), `path`, `include_dirs`, `depth` parameters.
- Add `/api/files/:id` preview endpoint returning metadata + truncated content with highlight hints.
- Activity data sourced from Git service or internal job logs; provide aggregator service to avoid multiple round-trips.
- Introduce caching layer for project metadata to keep TTFB low; consider in-memory or Redis caching keyed by project id + updated timestamp.
- Ensure SSE events (from file changes) can invalidate cached modal data when relevant.

## 9) Data Model Considerations

- No new core tables required; rely on existing projects/files/repos models.
- Store modal preference (last opened tab) in user preferences or local storage for improved UX.
- Ensure file metadata includes MIME/type and size to quickly determine preview eligibility.

## 10) Dependencies & Integration Points

- Depends on search/filter work for consistent project DTOs (tag colors, stats).
- Requires collaboration with Git integration team for consistent activity feed data.
- Design system updates: modal shell, split panes, tree component, skeleton states.
- QA requires seeding dataset with nested directories and large files for realistic testing.

## 11) Rollout Plan

1. Implement backend APIs behind `PROJECT_MODAL` feature flag.
2. Ship modal UI hidden behind query param for internal testing.
3. Enable for staged users (internal org) while monitoring latency and errors.
4. Gradually expose quick-open CTA on dashboard once metrics stable.
5. Post-launch, evaluate adding edit shortcuts and multi-select DnD within modal.

## 12) Success Criteria & Acceptance Tests

- Opening modal from dashboard returns project metadata and default tree within performance thresholds.
- README (if present) auto-previewed with markdown render.
- Activity tab shows last 20 commits with correct ordering and linking.
- Deep link `?modal=project&id=` opens modal directly after refresh and back navigation functions as expected.
- Accessibility audit (WCAG 2.1 AA) passes for modal interactions.

## 13) Open Questions

1. Should Activity include non-Git events (imports, exports)? (Recommendation: include top 5 recent jobs if available.)
2. Do we allow star/unstar or tag edits from modal header? (Default: view-only; revisit post MVP.)
3. How do we handle very large trees (>10k nodes)? (Proposed: lazy pagination + load indicators at each branch.)
4. Should file preview support diff view when Git has uncommitted changes? (Out of scope for MVP.)

## 14) Risks & Mitigations

- **Performance spikes on first load**: mitigate with aggregated project DTOs and caching.
- **Inconsistent data between tabs**: centralize data fetching through modal store; share caching logic.
- **Overfetching tree data**: enforce pagination and depth limits.
- **UX overwhelm on small screens**: ensure responsive collapse of tree and vertical stack layout below 1024px.

## 15) Definition of Done

- Modal available to all users with feature flag on, meeting latency and reliability targets.
- Documentation updated: user guide, shortcut reference, developer API docs.
- Telemetry dashboards live for modal usage and performance.
- Support runbook covering troubleshooting for tree/previews/activity endpoints.
- Stakeholder sign-off from Product, Design, Engineering.
