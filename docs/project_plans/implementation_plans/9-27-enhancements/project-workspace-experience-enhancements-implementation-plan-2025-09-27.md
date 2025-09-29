# Implementation Plan: Project Workspace Experience Enhancements — Set 2

**Date:** 2025-09-27  
**Author:** Codex (Strategic Technical Lead)  
**Status:** Draft  
**Related PRD:** docs/project_plans/PRDs/2025-09-27-enhancements-set-2-prd.md

## Objective
Deliver the multi-select filter bar, sidebar chip sync, project navigation improvements, enhanced creation flows, and file-access fix within a 3-sprint window to support the upcoming private beta.

## Delivery Milestones
1. **Sprint 1 — Filter System Revamp (Week 1)**
   - Ship new filter bar architecture, status chip, global clear, and sidebar tag chips with shared state store.
   - Backend exposes config-driven statuses/types/templates.
   - Instrument telemetry for filter interactions.
2. **Sprint 2 — Project Workspace Navigation & Templates (Week 2)**
   - Implement recent files rail, blank new file card, sidebar modal routing updates, and template selection in project creation.
   - Update modal ↔ editor navigation handoffs and enlarge expand/collapse hit targets.
3. **Sprint 3 — Creation Flow Enhancements & Reliability Fix (Week 3)**
   - Deliver Quick Create expand, inline project creation entry, markdown toolbar + backlinks, tag/type creation, and immediate file access fix.
   - Complete end-to-end QA, regression testing, and documentation.

## Workstreams & Tasks
### Backend/API
- Extend `/config` response schema with `projectStatuses`, `fileTypes`, `projectTemplates`; add version field and caching layer.
- Add mutation endpoints/handlers for creating tags and types (if not existing) or piggyback on existing endpoints with inline creation flags.
- Provide `recentFiles` query (workspace scoped, order by `updated_at`, limit 5) and ensure file payload matches modal requirements.
- Ensure file create endpoint returns fully populated payload; review eventual consistency or caching causing stale data.
- Update project creation to accept template id and apply defaults (metadata, starter directories placeholder).

### Frontend — Dashboard & Filters
- Refactor filter bar component to render chip group with configurable multi-select behaviour and counts.
- Integrate statuses from config, storing selections in central store (e.g., Zustand/Redux) shared with sidebar.
- Implement global `Clear All` button with animation and analytics event.
- Replace sidebar tag list with chip components; ensure OR logic merges with existing filters and updates state store.
- Relocate `Sort By` dropdown into filter bar, preserving keyboard accessibility.

### Frontend — Projects & Navigation
- Remove redundant in-pane `New File` button.
- Build `RecentFilesRail` component, responsive behaviour, skeleton loading state.
- Append blank `New File` card to project file lists; hook to Quick Create pre-populated with project id.
- Update sidebar navigation to open modal on text click, widen expand/collapse icon hitbox, and ensure focus states.
- Implement modal title click → editor navigation; editor title click ↔ modal open with metadata view.
- Wire project template dropdown within New Project modal, defaulting to `Blank`.

### Frontend — Creation Flow
- Add `Expand` CTA in Quick Create to load full form inside modal (reuse create form component, lazy load heavy dependencies).
- Enable inline project creation from project dropdown (combobox with `Create new` option, handles success state).
- Integrate markdown toolbar (bold, italics, headings, list, link) leveraging existing editor utilities; ensure toolbar triggers update content.
- Implement backlink picker scoped to selected project; include search for large lists, handle empty state when no project selected.
- Enhance tags field with create-on-type, color assignment, and dedupe logic.
- Introduce type dropdown (config-driven) with inline creation supporting fallback icon.

### Quality Engineering & Tooling
- Expand unit tests for filter store, sidebar chip interactions, and creation form utilities.
- Add integration tests covering filter combinations, recent files interactions, and modal↔editor navigation.
- Automate regression test for file creation → immediate open.
- Update Storybook (or component catalog) entries for chip states, rails, and toolbar to aid design review.

## Sequencing & Dependencies
- Backend config changes must land before Sprint 1 FE stories (mock config in FE during development, switch once live).
- Recent files rail depends on backend endpoint; schedule API PR early Sprint 2.
- Backlink picker requires project file list availability; ensure API or store present before FE binding.
- Telemetry schema updates should be coordinated with analytics pipeline before release.

## Clarifications on PRD Open Questions
- Saved filter presets remain out of scope for this release; record as backlog item for post-beta roadmap review.
- Recent files rail will ship as workspace-wide (shared across users) for launch, with user-specific filtering deferred.
- Initial project templates will only scaffold metadata and empty directory placeholders (no auto-created starter files) until the dedicated template manager project lands.

## Resourcing & Ownership
- **BE Lead (1 FTE):** config endpoint, recent files, file creation consistency, template handling.
- **FE Lead (1 FTE):** filter bar revamp, state management, sidebar chips, modal routing.
- **FE Contributor (0.5 FTE):** creation flow enhancements, markdown toolbar, backlink picker.
- **Design (0.3 FTE):** chip styling, rail layout, toolbar icons, interaction review.
- **QA (0.5 FTE):** automated + manual regression, telemetry validation.

## Testing Strategy
- Component-level unit tests (Jest/RTL) for chip counts, filter store, toolbar actions.
- Cypress/Playwright flows:
  - Filters: apply/remove multi-select, sidebar chip sync, clear all.
  - Navigation: sidebar open modal, modal title → editor, editor title → modal.
  - Creation: Quick Create expand, inline project creation, tags/types creation, backlink insert.
  - Bug fix: create file → open immediately (runs on CI).
- Manual sanity: cross-browser (Chrome, Safari tech preview), keyboard-only navigation, screen reader labels for chips/buttons.

## Rollout & Monitoring
- Feature flag `workspace_filters_v2` gating FE changes; use staged rollout (internal → alpha → beta).
- Log analytics events (`filters.changed`, `filter.clear_all`, `file.create.expand`, `file.create.backlink_added`).
- Track error rates for tag/type creation and file open requests in observability dashboard.
- Collect qualitative feedback via weekly founder sync and Notion feedback doc.

## Risk Management
- **State sync regressions:** mitigate via shared store tests and QA scenarios.
- **API latency with config + recent files:** batch requests on dashboard load and cache where possible.
- **Creation modal complexity:** evaluate performance; if load is heavy, split components with dynamic imports.
- **Inline entity creation conflicts:** enforce validation (case-insensitive dedupe) and handle race conditions with optimistic updates + server confirmation.

## Acceptance & Handover
- All FRs in PRD validated by Product in staging.
- QA sign-off documented with test evidence.
- Release notes and Loom walkthrough circulated to stakeholders.
- Post-launch review scheduled one week after release to collect metrics and feedback.
