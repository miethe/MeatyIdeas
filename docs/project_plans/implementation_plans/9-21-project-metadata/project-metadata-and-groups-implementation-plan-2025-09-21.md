---
title: "Implementation Plan — Project Metadata & Groups"
status: Draft
version: 0.1
date: 2025-09-21
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-21-project-metadata-and-groups-prd.md
owner: Delivery Lead: TBD (Frontend: TBD, Backend: TBD)
-----------------------------------------------------------------------------------

## 0) Summary

Deliver continuous project metadata editing, cohesive action menus, and universal group indicators. Plan orchestrates backend patch capabilities, frontend UX updates, and rollout enablement to ensure world-class polish while preserving safety around destructive actions.

## 1) Scope & Complexity

Complexity: Medium-High — touches dashboard, modal, full-page views, plus backend mutations and real-time sync. Requires close alignment with design and product for responsive behavior, hence your involvement as lead for both.

## 2) Workstreams

1. **Backend Metadata Services** — PATCH endpoint, group data hydration, audit logs.
2. **Action Menu & Card Enhancements** — meatballs menu, group pill visuals, responsive adjustments.
3. **Edit Experience** — modal/panel, form validation, optimistic updates.
4. **Synchronization & Analytics** — cache updates, websocket events, telemetry.
5. **QA, Documentation, Rollout** — regression, accessibility, support enablement.

## 3) Milestones & Timeline

- **Week 1**: Backend endpoint readiness, design sign-off, card/menu prototypes.
- **Week 2**: Implement dashboard/card UI, group indicators, action menu interactions.
- **Week 3**: Build edit form across surfaces, integrate with backend, telemetry + QA; prepare rollout.

## 4) Backend Metadata Services (Week 1)

### 4.1 PATCH Endpoint
- **Task**: Enhance `/api/projects/{id}` to accept partial updates (name, description, tags, groups, metadata JSON).
  - Acceptance: Validations (name uniqueness, tag existence), returns enriched DTO; unit/integration tests.
  - Dependencies: Tag/group services.
  - Estimate: 3 points.

### 4.2 Group Hydration
- **Task**: Include group info (id, name, color) in standard project responses (dashboard list, detail view).
  - Acceptance: Serializer updates, ensures no N+1; caching strategy defined.
  - Dependencies: Data availability.
  - Estimate: 2 points.

### 4.3 Audit Logging
- **Task**: Record edits/deletes in `project_audit` log.
  - Acceptance: Log entries for field changes, user ID, timestamp; accessible via admin tools.
  - Dependencies: Endpoint updates.
  - Estimate: 1 point.

## 5) Action Menu & Card Enhancements (Week 1-2)

### 5.1 Meatballs Menu Component
- **Task**: Create accessible menu component with keyboard/touch support, red destructive section.
  - Acceptance: Shareable across dashboard, modal, detail; Storybook entry, tests for focus management.
  - Dependencies: Design tokens.
  - Estimate: 2 points.

### 5.2 Dashboard Card Integration
- **Task**: Place meatballs next to star, add group pill(s), update layout for responsive breakpoints.
  - Acceptance: Desktop hover states, mobile bottom sheet fallback, ensures card height stability.
  - Dependencies: Menu component.
  - Estimate: 3 points.

### 5.3 Group Indicator System
- **Task**: Render colored dot + label, handle multiple groups with overflow tooltip.
  - Acceptance: Color tokens validated for contrast; clicking chip filters dashboard by group; analytics event emitted.
  - Dependencies: Group data.
  - Estimate: 2 points.

## 6) Edit Experience (Week 2-3)

### 6.1 Modal/Edit Panel
- **Task**: Build `ProjectEditPanel` with fields for name, description, tags, groups, metadata.
  - Acceptance: Works in modal & full view; autosave draft? (optional, confirm); validations inline.
  - Dependencies: Backend PATCH.
  - Estimate: 3 points.

### 6.2 Responsive Handling
- **Task**: Move actions into overflow menu on small screens; ensure `Edit` accessible via keyboard + gestures.
  - Acceptance: Tests for <768 px; includes bottom sheet variant.
  - Dependencies: Menu integration.
  - Estimate: 2 points.

### 6.3 Delete/Archive Flow
- **Task**: Confirmation modal with impact summary; allow archive alternative.
  - Acceptance: Confirmations logged, analytics event, ensures double-confirm for delete.
  - Dependencies: Menu action wiring.
  - Estimate: 2 points.

## 7) Synchronization & Analytics (Week 3)

### 7.1 Client Cache Updates
- **Task**: Update React Query caches when edits succeed; subscribe to websocket events for remote edits.
  - Acceptance: Dashboard cards, modal, and full view stay in sync without refresh; tests for stale data prevention.
  - Dependencies: Backend events.
  - Estimate: 2 points.

### 7.2 Telemetry
- **Task**: Emit `project_edit_opened`, `project_edit_saved`, `project_menu_opened`, `project_group_chip_clicked` with metadata.
  - Acceptance: Documented schema, analytics QA.
  - Dependencies: UI interactions.
  - Estimate: 1 point.

### 7.3 Permissions Gatekeeping
- **Task**: Ensure menu items respect user roles; fetch permission map.
  - Acceptance: Read-only users see disabled/hide states; tests covering each role.
  - Dependencies: Auth context.
  - Estimate: 2 points.

## 8) QA, Documentation, Rollout

- **Task**: Regression sweep covering project create/edit/delete flows across surfaces.
  - Acceptance: QA sign-off; create test matrix for desktop/mobile.
  - Dependencies: Week 2-3 deliverables.
  - Estimate: 2 points.

- **Task**: Accessibility review (focus order, ARIA for menus, group chips, edit panel).
  - Acceptance: No critical issues; remediation tracked.
  - Dependencies: UI complete.
  - Estimate: 1 point.

- **Task**: Documentation + enablement (support guides, release notes, updates to onboarding).
  - Acceptance: Material published; CS team briefed.
  - Dependencies: Feature readiness.
  - Estimate: 1 point.

- **Task**: Immediate rollout, as app is still in active development.
  - Acceptance: Monitor errors/latency.
  - Dependencies: All workstreams complete.
  - Estimate: 1 point.

## 9) Risks & Mitigations

- **UI complexity on mobile**: early mobile QA, dedicate design review for responsive states.
- **Permission leakage**: rigorous role-based testing, pair with security review.
- **Data conflicts**: implement optimistic concurrency; show toast when remote change detected during edit.
- **Menu discoverability**: add zero-state tooltip and short Loom for release.

## 10) Exit Criteria

- Edit flows stable across surfaces with telemetry and audit logging operational.
- Dashboard cards show group indicators consistently; filters triggered via chips.
- QA, accessibility, and product sign-off complete; support materials live.
- Rollout complete; change log captured.
