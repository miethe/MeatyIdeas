# PRD: Project Workspace Experience Enhancements — Set 2

**Date:** 2025-09-27  
**Author:** Codex (Strategic Technical Lead)  
**Status:** Draft  
**Related Docs:** docs/project_plans/enhancements/9-27-2.md

## Summary
We are elevating the project workspace experience to support faster triage, richer context, and smoother creation flows ahead of private beta. This initiative introduces a unified multi-select filter bar, contextual chips, and global clear actions; streamlines project/file navigation with improved modal ↔ editor handoffs; modernises creation flows with Quick Create expansion, inline project creation, and markdown tooling; and fixes blocking issues that prevent immediate file access after creation. Collectively, these upgrades aim to reduce context switching, improve discoverability, and create predictable UX patterns as we scale the product surface area.

## Goals & Success Metrics
- Reduce time to locate a relevant project/file by enabling multi-criteria filtering within 2 clicks.
- Drive adoption of the modal workflow by keeping navigation in-context (modal vs page) for >80% of actions during usability tests.
- Ensure 100% success opening a newly created file without requiring manual refresh.
- Increase completion of file creation with rich metadata (tags, type) by 30% through inline controls.
- Qualitative goal: users describe the filter bar and tag chips as "fast" or "predictable" in post-test interviews.

## Scope
### In Scope
- Dashboard filter bar redesign, including status, tags, config-driven options, and bulk clear.
- Sidebar tag chips with OR filtering behaviour and sync with filter bar state.
- Project view improvements: removal of redundant buttons, recent files rail, template selection, modal ↔ page navigation updates.
- Quick Create & full Create flows: expansion button, inline project creation, markdown toolbar + backlinks, tag/type creation.
- Backend contract updates to expose statuses/types/templates via `/config`.
- Bug fix to allow immediate access to newly created files.

### Out of Scope
- Advanced analytics or saved filter presets.
- Full template management UI (only default "Blank" template provided).
- Editor content enhancements beyond markdown toolbar/backlink insertion.
- Real-time collaboration or cross-session persistence of filter states.

## Stakeholders
- Product: Founder / Product lead
- Design: Lead product designer
- Engineering: Frontend lead, Backend lead, QA automation engineer
- GTM/CS: Early customer advisory group (for validation)

## User Personas
- **Founder PM:** triages ideas and files daily; needs rapid filters and recent context.
- **Contributor:** creates new project files; needs quick setup, templates, and formatted content.
- **Ops Partner:** navigates metadata to ensure status accuracy; relies on chip counts and configurability.

## User Stories
1. As a PM, I can combine status, tag, and other filters from a single bar so that I narrow projects quickly without multiple clicks.
2. As a contributor, I can open a project's modal from the sidebar and jump into the full editor if deeper work is required, without losing context.
3. As a contributor creating a file, I can expand into a full form, set formatting, create or choose tags/types, and create a project inline.
4. As an ops partner, I can select template defaults when creating a project to enforce structure.
5. As any user, when I complete file creation I can immediately open and edit it.

## Functional Requirements
### Filter Bar & Tags
- FR1: Move "Sort By" into the filter bar, right-aligned, maintaining existing sort options.
- FR2: Add a multi-select status chip powered by `/config` values with defaults (Idea, Discovery, Draft, Live, Archived) and workspace overrides.
- FR3: Update all filter chips (Filters, Status, Tags, etc.) to support multi-select, display selected counts, and include an inline clear ("x").
- FR4: Provide a global `Clear All Filters` action that resets every chip and emits corresponding events to refresh the project list.
- FR5: Sidebar tags render as colored chips; clicking toggles selection, updates dashboard results with OR logic, and keeps filter bar in sync.

### Project Navigation & Templates
- FR6: Remove the in-pane "New File" button; rely on global nav `New` button and inline blank card.
- FR7: Display a "Recent Files" rail (5 most recently updated files across workspace) on dashboard and project view; clicking opens modal.
- FR8: Append a blank "New File" card in project file lists that opens Quick Create scoped to that project.
- FR9: Add template selection (default "Blank") to New Project modal; templates define default metadata, starter files/structure (initial version only sets metadata & empty directories).
- FR10: Sidebar project/file text opens modal; expand/collapse icon toggles children, has minimum hit area 24x24 and accessible label.
- FR11: Modal title click navigates to persistent editor route for that entity; editor title click returns to modal for metadata editing.

### File Creation Flow
- FR12: Quick Create modal includes `Expand` control to load full Create form within modal context.
- FR13: Project dropdown in Create screen includes "Create new project" entry launching New Project modal; on success, selects new project.
- FR14: Markdown toolbar (bold, italics, headings, lists, links) is available in Content field with standard shortcuts.
- FR15: Backlink button lists files within selected project (alphabetical + search) and inserts markdown link at cursor; guarded with message if no project selected.
- FR16: Tags field auto-completes existing tags, supports new tag creation; new tags persist to workspace and remain selected.
- FR17: Type field is config-driven multi-select/dropdown with default list; allows inline creation with optimistic update.

### Reliability
- FR18: Newly created files are instantly accessible via modal and editor (no refresh). Ensure API returns ready data and FE cache updates.

## User Experience Notes
- Filter bar chip design mirrors Apple-style segmented controls with soft shadows; states: default, active (count bubble), hover, focused.
- Recent Files rail: 320px width on desktop, collapsible on smaller viewports; includes icon, project name, updated timestamp.
- Modal ↔ page transitions use consistent animations (fade/slide) to reinforce continuity.
- Markdown toolbar matches existing design system tokens and keyboard shortcuts (⌘B, ⌘I, etc.).

## Technical Requirements & Considerations
- Extend `/config` endpoint to return `projectStatuses`, `fileTypes`, `projectTemplates` (initial: blank) with versioning.
- Introduce FE store module for filters that normalises state across filter bar and sidebar chips.
- Use optimistic updates when creating tags/types/templates; ensure backend idempotency or conflict resolution.
- Recent Files rail requires new backend query (top 5 by `updated_at`), cached per workspace; consider pagination for future.
- Ensure modal routing handles deep links (`/projects/[project]?modal=true`) and fallback for direct navigation.
- Markdown toolbar/backlink features should leverage existing editor libs; evaluate lightweight plugin or existing WYSIWYG components.
- Add telemetry events: `filters.changed`, `filter.clear_all`, `recent_file.opened`, `file.create.expand`, `file.create.backlink_added`.

## Dependencies & Assumptions
- Config endpoint already authenticated and cached per workspace.
- Design system tokens available for chips and rails; new icons may be needed (`plus`, `clear`, `backlink`).
- Project templates initialisation does not require migrations (blank template is virtual / config-based).
- Backlink dropdown requires per-project file list API or reused data from file tree store.

## Rollout & Adoption Plan
1. Ship behind `filters_v2` feature flag for internal QA.
2. Run moderated usability test with 3 target users to validate filter discoverability and navigation flow.
3. Once stable, enable for internal alpha workspace, gather feedback, then roll into private beta by default.
4. Provide release notes and quick Loom walkthrough covering new creation workflow.

## Risks & Mitigations
- **Complex filter UX**: Potential confusion with multi-select chips → add inline helper text & onboarding tooltip.
- **Config drift**: Workspaces without statuses/types defined → enforce defaults server-side and surface fallback.
- **Performance**: Extra backend calls for config and recent files → batch in single request on dashboard load, add caching.
- **Backlink dropdown scaling**: Large project file lists → add search + incremental fetch for >50 files.

## Open Questions
- Do we need saved filter presets in near term? (Likely future iteration.)
- Should recent files rail be user-specific vs workspace-wide? A: User-specific preferred, but workspace-wide for MVP is acceptable.
- What initial template-generated files should exist beyond blank structure? A: We will capture this in future iterations for templates. For now we are just building those foundations.
