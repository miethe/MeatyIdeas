---
title: "MeatyProjects — Project Metadata & Groups PRD"
version: 1.0
status: Draft
date: 2025-09-21
owner: Product: TBD, Tech Lead: TBD
---

## 1) Purpose & Vision

Empower teams to keep projects current and contextual without friction. Builders must be able to edit metadata on demand, see group affiliation everywhere, and access contextual actions through intuitive menus. The experience should feel modern, responsive, and consistent from dashboard grid to detail modal.

## 2) Background & Problems Today

- Project metadata (name, description, tags) is difficult to update post-creation; teams rely on ad-hoc notes.
- Group membership is hidden behind a dedicated tab, fragmenting navigation and obscuring ownership.
- Action affordances (edit, delete, grouping) lack a single entry point, leading to inconsistent flows.
- Dashboard cards provide minimal context, causing scanning fatigue and misclassification.

## 3) Goals & Non-Goals

In scope
- Editable project metadata from dashboard cards, project modal, and full-screen page.
- Unified action entry via meatballs menu (with Edit, Manage Groups, Duplicate, Delete, etc.).
- Visual group indicator on dashboard cards (color token + label) and consistent group surfacing across app surfaces.
- Responsive layout adjustments (collapse into menu on narrow screens).

Out of scope
- Deep group management (creating/editing groups) beyond existing admin flows.
- Role-based permissions overhaul; respect current authorization model.
- Bulk editing multiple projects simultaneously (future enhancement).

## 4) Target Users & JTBD

- **Founder / PM**: “Rename and retag projects quickly as priorities shift without digging through settings.”
- **Team Member**: “Immediately see which group owns a project from the dashboard to know who to contact.”
- **Operations Lead**: “Maintain hygiene by editing metadata in-context and removing stale projects safely.”

## 5) Success Metrics

- Metadata edit adoption: ≥ 50% of active projects updated via new flows within first 60 days.
- Dashboard comprehension: 30% reduction in support tickets related to “Which group owns this project?”
- Action discoverability: meatballs menu click-through rate ≥ 65% of project actions (vs scattered buttons).
- No increase in accidental deletes (maintain <0.5% delete rollback requests).

## 6) Experience Overview

### 6.1 Dashboard Card Enhancements
- Add meatballs button adjacent to star icon; displays dropdown with `Edit`, `Manage Groups`, `Duplicate`, `Archive`, `Delete` (red, separated).
- Introduce group pill: color-coded dot + group name positioned under card title; supports multiple groups via stacked chips with overflow.
- Card hover reveals subtle shadow and highlights actions; mobile view collapses actions into bottom sheet triggered by tap.

### 6.2 Project Modal & Full Detail
- Primary action bar includes `Edit Project` button (desktop) or menu (mobile).
- Edit form slides over in side panel/modal: fields for name, description, tags, groups, key dates, custom metadata sections (if enabled).
- Real-time validations (duplicate names, required fields). Save triggers optimistic update across open clients.
- Action menu replicates dashboard options with context-specific items (e.g., `Open in new tab`, `Export summary`).

### 6.3 Groups Everywhere
- Groups surfaced in breadcrumbs, project header, and list views; clicking group filters dashboard to same group.
- Group colors come from existing palette; ensure high contrast and consistent semantics across features.

### 6.4 Responsive & Accessibility
- On small screens, star and meatballs collapse into combined actions menu; ensure 44px touch targets.
- Keyboard navigation: `Shift+E` opens edit form when project focused; menus accessible via arrow keys.
- Screen reader announces group affiliations and action menus clearly (`aria-haspopup`, `aria-expanded`).

## 7) Functional Requirements

1. Meatballs menu accessible on dashboard cards, modal headers, and detail headers; options respect permissions.
2. Edit form supports updating name, description, tags, groups, and custom metadata fields; validations run client + server side.
3. Group indicator shows primary group color dot + label; multiple groups displayed with overflow `+N` and tooltip.
4. All surfaces update in real time after edits (dashboard card, modal, breadcrumbs) via shared data store or subscription.
5. Delete action requires confirmation modal with consequence summary; archival alternative available.
6. Support analytics events for `project_edit_opened`, `project_edit_saved`, `project_group_chip_clicked`, `project_menu_opened`.
7. Guard small viewports (<768 px): collapse actions into overflow menu; ensure no overlap with star button.
8. Respect authorization: hide Edit/Delete options for read-only users; show disabled state with tooltip if limited.

## 8) System & Architecture Requirements

- Backend endpoints for updating project metadata must accept partial updates and return enriched DTO for optimistic UI.
- Introduce groups metadata into standard project response payloads (name, color, slug).
- Update event stream/WebSocket to broadcast project metadata changes for live synchronization.
- UI state should leverage shared React Query cache or websocket subscription to avoid stale data.
- Logging for destructive actions (Delete/Archive) to audit trail.

## 9) Data Model Changes

- Ensure `projects` table supports description length (consider TEXT) and metadata JSON column (if adding custom fields).
- Confirm join table `project_groups` exposes color token; may need addition if not present.

## 10) Analytics & Telemetry

- Track edit frequency per project, group filter usage, menu interactions.
- Monitor errors/save failures; alert if >2% of edit submissions fail per day.
- Report on delete confirmations vs cancellations to validate UX safety.

## 11) Rollout Strategy

1. Immediate rollout, as app is still in active development.

## 12) Dependencies & Coordination

- None; you have the full-stack expertise and design prowess for end-to-end ownership of this feature.

## 13) Open Questions

1. Do we allow inline rename on card title? A: Not currently.
2. Should group colors be user-customizable per group or locked to preset palette? A: Yes, all colors should be customizable. But start with preset palette. Groups should be an editable entity which has a name, description, and color.
3. How do we expose audit log entries to end users after edits? A: The "Activity" tab in the project detail modal can show a summary of changes for the Project and its associated entities. There should be a similar tab added to the full page view as well.
4. Do we support drag/drop reordering of groups on the edit form? A: Projects should be able to be assigned to multiple groups, but there is no concept of a "primary" group. Therefore, drag/drop reordering is not necessary.

## 14) Risks & Mitigations

- **Action overload**: maintain clean visual hierarchy; hide rarely used options behind secondary menu.
- **Conflicting edits**: implement optimistic concurrency with last-write-wins messaging and conflict toasts.
- **Permission leaks**: thorough authorization tests; hide/manage actions based on role.
- **Group color misinterpretations**: supply legend in group management screen; ensure color-blind safe patterns.

## 15) Definition of Done

- Metadata editing available across surfaces with successful telemetry and zero critical QA issues.
- Group indicators render consistently and pass accessibility checks.
- Support documentation + release communications delivered.
- Feature flag decommissioned after adoption and stability review.
