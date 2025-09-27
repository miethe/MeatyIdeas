---
title: "MeatyProjects — Project File UX Refresh PRD"
version: 1.0
status: Draft
date: 2025-09-24
owner: Product: TBD, Tech Lead: TBD
---

## 1) Purpose & Vision

Deliver an intuitive, live-updating project file experience that removes stale views, reduces user friction when creating content, and surfaces complete metadata wherever files appear. The project detail page should mirror the fidelity of the detail modal while providing richer context for decision-making.

## 2) Background & Problems Today

- After adding files or folders, the project detail page keeps stale results until a full app refresh, forcing users to guess whether operations succeeded.
- Tag updates applied to a file are reflected in aggregate counts and the modal view, but not on the project detail page cards, creating mismatched states.
- The `Path` field in the "Create File" dialog is free-text, requiring users to remember directory structures and type perfectly formatted paths.
- Creating folders relies on the browser's `prompt` dialog, which breaks UI consistency and lacks validation, context, or accessibility affordances.
- File cards expose only title, path, and summary; front matter metadata such as status, owner, or tags remains hidden unless the modal is opened.

## 3) Goals & Non-Goals

In scope
- Real-time (or near real-time) synchronization for file/folder CRUD actions between modals, file tree, and project detail page cards.
- Unified tag rendering and metadata hydration for file cards to match modal data fidelity.
- Guided folder selection/creation during file creation to eliminate path typing errors.
- Replacement of browser-native dialogs with first-class, accessible UI components for folder creation tasks.
- Expanded file card details that display known front matter metadata in a structured layout.

Out of scope
- Bulk editing of file metadata or tags.
- Modifications to the underlying markdown/front matter format beyond consumption/display.
- Major redesign of the project detail page layout or card grid (incremental enhancements only).
- Real-time collaborative editing within file content.

## 4) Target Users & JTBD

- **Builders / Contributors**: "When I create or organize files, I need immediate confirmation that the structure updated correctly so I can keep momentum."
- **Project Leads**: "I want the project page to show accurate tags and metadata without diving into each file so I can triage work quickly."
- **Knowledge Managers**: "While curating documentation, I need folder creation and placement to be foolproof and consistent with our taxonomy."

## 5) Success Metrics

- Reduce perceived stale state bugs: < 5% of file create/move actions result in manual page refresh (survey + telemetry) within 30 days of launch.
- File card metadata parity: 100% of files with tags or front matter fields display them on the project detail page within 1 minute of update (instrumentation).
- Path selection accuracy: decrease file creation failures due to invalid paths by 90% (API error logging baseline).
- UI satisfaction: ≥ 4.5/5 in post-release survey on "Ease of creating and organizing files".
- Accessibility regression budget: 0 critical issues found in audit of new dialogs and metadata sections.

## 6) Experience Overview

### 6.1 Live File Synchronization
- File tree, project detail cards, and modal results update automatically after file/folder CRUD or tag edits without full page reloads.
- Toasts confirm actions; spinners or skeletons briefly indicate refresh when needed.
- SSE/websocket events (or request hooks) reconcile differences if responses arrive out of order.

### 6.2 Tag & Metadata Parity
- File cards show tag chips identical to modal/tag chip styles with overflow handling (`+N`).
- Additional metadata (status, owner, description snippet, custom front matter fields) rendered as compact two-column field list or badges.
- Empty states hide sections gracefully to prevent clutter.

### 6.3 Guided Path Selection
- "Path" field becomes a combobox with typeahead across existing folders plus option to "Create new folder" if typed path not found.
- Selecting existing folder auto-appends file name suggestion; creating new folder creates the directory before file submission (or as part of atomic transaction).
- Validation ensures restricted characters or disabled directories are handled with contextual messaging.

### 6.4 Native Folder Dialog
- "New Folder" buttons open Radix-based dialog matching design tokens (title, description, folder name input, optional parent selector).
- Dialog reuses the same folder picker component so folder creation experience is consistent.
- Confirmation triggers API call; success closes dialog and triggers live updates.

### 6.5 File Detail Exposure
- Clicking file cards expands metadata panel or reveals inline drawer (decide final pattern with design) showing front matter fields: `tags`, `status`, `owner`, `category`, `last_updated`, etc.
- Layout supports longer text values with truncation + tooltip; ensures readability on mobile viewports.
- Provide CTA to open full content preview/modal if deeper context is needed.

## 7) Functional Requirements

1. File add/update/delete, folder add/delete/rename, and tag edits propagate to project detail `files` query and file tree state without manual refresh.
2. File card data uses same source-of-truth as modal data, including tag arrays and front matter key/value pairs.
3. Path selection component enforces selection from existing directories or explicit creation flow; submission fails gracefully with clear errors.
4. Folder creation dialog supports specifying parent directory, validates uniqueness, and surfaces API errors inline.
5. Metadata panel renders defined front matter keys in deterministic order with human-readable labels (configurable map with sensible defaults).
6. All new dialogs/components meet accessibility standards (focus trap, keyboard navigation, aria attributes) and follow design tokens.
7. Telemetry events emitted for folder creation, path selection errors, metadata panel opens, and live-sync refresh fallback triggers.

## 8) System & Architecture Requirements

- Revisit SSE/WebSocket event types to include file creation, update, tag change events; ensure FE query invalidation occurs on event receipt.
- Standardize a file metadata transformer shared across modal and detail page (likely in `/app/frontend/lib`), reducing duplication.
- Introduce a folder tree query/cache accessible to both file creation dialog and folder dialog; support optimistic updates.
- Ensure API endpoints support returning enriched metadata (tags, parsed front matter) in detail page list responses, possibly through serializer updates or `include_metadata` flag.
- Consider debouncing fetches or batching invalidations to minimize redundant network requests after bursts of operations.

## 9) Data Model Changes

- No fundamental schema changes anticipated.
- May add computed serializer fields, e.g., `front_matter_fields` array or `metadata_map` for ease of rendering.
- Optional: persist folder hierarchy metadata for faster autocomplete (investigate if existing directory persistence covers this).

## 10) Analytics & Telemetry

- `file_sync_refresh` (auto vs manual) events including cause and duration.
- `file_metadata_viewed` when metadata drawer/panel opens, with fields present count.
- `file_path_selector_used` with mode (`existing_folder`, `new_folder_created`).
- `folder_create_dialog_submitted` success/failure counts and error codes.
- Dashboard instrumentation to capture time between mutation response and UI update.

## 11) Rollout Strategy

- Behind a short-lived feature flag for QA (`project_file_ux_refresh`).
- Dogfood with internal team, gather feedback, then enable for all customers once telemetry stable for 48 hours.
- Provide quick rollback toggle if regressions occur.

## 12) Dependencies & Coordination

- Requires coordination with backend team on SSE event coverage and serializer enrichment.
- Design partnership for new folder dialog, metadata layout, and file card expansions.
- QA for regression around file permissions, tag edits, and offline handling.

## 13) Open Questions

1. Should metadata panel display all front matter keys or only whitelisted ones? (Proposal: curated whitelist with "Show more" affordance.)
2. Do we support nested folder creation in one action (e.g., `docs/specs/new`)? (Recommendation: yes, but enforce validation.)
3. Are there performance constraints on fetching full metadata for all files? (If yes, consider lazy loading metadata on expansion.)
4. Should metadata view allow inline editing? (Out of scope now; capture as future enhancement.)

## 14) Risks & Mitigations

- **Event mismatch / double fetch**: implement idempotent cache updates and log drift to detect inconsistencies.
- **Metadata overload**: design review to cap visible fields and ensure responsive behaviour.
- **Path selection edge cases**: add unit tests for unusual directory names and concurrency collisions.
- **Folder dialog adoption**: include help text and defaults to match prior prompt workflow; provide keyboard shortcuts for power users.

## 15) Definition of Done

- Project detail page, file tree, and modal remain in sync after all supported mutations without manual refresh.
- File creation flow enforces guided path selection with accessible folder dialogs.
- File cards expose accurate tags and curated metadata with consistent styling.
- Telemetry, QA, and documentation updates completed; stakeholders sign off on UX.
- Feature flag removed after stable production monitoring period.
