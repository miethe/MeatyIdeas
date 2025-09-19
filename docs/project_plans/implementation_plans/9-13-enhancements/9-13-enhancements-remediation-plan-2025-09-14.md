---
title: "Remediation Plan — MeatyProjects 9/13 Enhancements"
status: Draft
version: 0.1
date: 2025-09-14
author: Lead Architect
inputs:
  - Implementation Plan: docs/project_plans/implementation_plans/9-13-enhancements/9-13-enhancements-implementation-plan-2025-09-13.md
  - PRD: docs/project_plans/PRDs/2025-09-13-enhancements-prd.md
  - Validation Notes: 2025-09-14 internal review
-----------------------------------------------------------------------------------

## 1) Context & Validation Summary

A full review of the shipped codebase against the 9/13 Enhancements PRD and implementation plan uncovered critical gaps. Foundational migration tooling was skipped, feature flags are inconsistently enforced, several Phase 1 UX requirements (sidebar collapsibility, results modal usability) are incomplete, Phase 2 Git workflows are pared down, and Phase 3–4 functionality (drag/drop, share view, import progress) does not satisfy acceptance criteria. Cross-cutting requirements around pagination, ETags, telemetry, accessibility, and logging were also not delivered. The remediation work below is prioritized to restore alignment with the PRD before further rollout.

## 2) Remediation Workstreams

### A. Foundational Fixes (Blocker)

1. **Ship Alembic Baseline + Migrations**  
   - Scope: Introduce Alembic configuration, baseline existing schema, add migrations for User/Directory/Repo/ShareLink/ProjectGroup tables and ArtifactRepo→Repo data copy.  
   - Owner: Backend Platform  
   - Dependencies: none  
   - Target: 2025-09-16

2. **Enforce Feature Flags End-to-End**  
   - Scope: Wrap directories, results modal, and groups endpoints/UI behind `DIRS_PERSIST`, `RESULTS_MODAL`, `GROUPS_UI`; FE should lazy-load modal only when enabled.  
   - Owner: Fullstack  
   - Dependencies: Config endpoint  
   - Target: 2025-09-16

3. **Structured Logs & Telemetry**  
   - Scope: Instrument repo/import/export/dir/share flows with `get_logger`, emit repo_id/project_id/action/duration/error_code; wire optional OTEL exporter behind env flag.  
   - Owner: Backend  
   - Target: 2025-09-20

### B. Phase 1 Remediations (High)

1. **Sidebar UX Compliance**  
   - Implement collapsible sections for Tags/Filters with persisted state, keyboard navigation, announce state for a11y.  
   - Owner: Frontend  
   - Target: 2025-09-18

2. **Results Modal Completion**  
   - Add virtualization (react-virtual), keyboard nav, project name/last updated metadata, bulk copy/open actions, empty states. Honour `RESULTS_MODAL` flag.  
   - Owner: Frontend  
   - Target: 2025-09-20

3. **PROFILE API Tests**  
   - Add API tests for `/api/me` GET/PATCH/logout + validation cases.  
   - Owner: Backend QA  
   - Target: 2025-09-17

### C. Phase 2 Git Panel (Blocker/High)

1. **Repo UX Parity**  
   - Build connect dialog with provider selection + token hints, expose branch list/create/checkout, show commit history, surface typed errors.  
   - Owner: Frontend Git Squad  
   - Target: 2025-09-23

2. **Repo Service Hardening**  
   - Add adapter abstraction, map errors to taxonomy (`GIT_AUTH`, `GIT_PULL_FAIL`, etc.), implement repo delete cleanup, unit tests.  
   - Owner: Backend Git  
   - Target: 2025-09-22

3. **Project Slug Collision Handling**  
   - On duplicate slug generate `-shortid` suffix; add tests.  
   - Owner: Backend  
   - Target: 2025-09-17

### D. Phase 3 Files & Directories (High)

1. **File Tree Interaction Enhancements**  
   - Persist expansion per dir, add keyboard controls, support multi-select range, drag/drop across projects via sidebar, toasts on failures.  
   - Owner: Frontend Files  
   - Target: 2025-09-24

2. **Directory API Flag Guard**  
   - Return 404 when `DIRS_PERSIST` disabled; ensure migrations seed directories only when flag on.  
   - Owner: Backend  
   - Target: 2025-09-16

3. **Batch Move Validation**  
   - Add dry-run coverage for cross-project dir moves, ensure atomic rollback, emit detailed SSE events.  
   - Owner: Backend QA  
   - Target: 2025-09-21

### E. Phase 4 Import/Export & Sharing (High)

1. **Share Link Model + UI Completion**  
   - Add `allow_export` field (DB + schema + FE), surface expiry/revoke in UI, replace alert view with markdown renderer (read-only), ensure safe HTML.  
   - Owner: Fullstack Share  
   - Target: 2025-09-22

2. **Import/Export Progress UX**  
   - Show per-job progress/toasts using SSE, display job status & download link in UI, add cancel/backoff handling.  
   - Owner: Frontend Ops  
   - Target: 2025-09-23

3. **Public Rate Limit & Error Handling Tests**  
   - Add automated tests covering rate limiting, expiry, revoke, and binary rejection.  
   - Owner: Backend QA  
   - Target: 2025-09-21

### F. Phase 5 Groups (Medium)

1. **API Flag Enforcement**  
   - 404 group endpoints when `GROUPS_UI` disabled; ensure migrations add defaults under flag.  
   - Owner: Backend  
   - Target: 2025-09-18

2. **Accessibility & Keyboard Support**  
   - Add focus states, keyboard reordering, ARIA labels for drag/drop columns.  
   - Owner: Frontend Groups  
   - Target: 2025-09-24

### G. Cross-Cutting Requirements (High)

1. **Pagination + ETags**  
   - Introduce standard envelope (`{items, next_cursor}`) for list endpoints, compute ETag/If-None-Match for GETs.  
   - Owner: Backend Platform  
   - Target: 2025-09-25

2. **Accessibility & Perf Audit**  
   - Run axe CI, fix contrast/focus issues, add Lighthouse perf budgets for modal/tree/git panel.  
   - Owner: QA + Frontend  
   - Target: 2025-09-26

3. **Regression Test Suite Expansion**  
   - Add unit/integration/e2e coverage for new flows (profile, directories, repos, import/export, share, groups).  
   - Owner: QA  
   - Target: 2025-09-27

## 3) Execution Plan & Reporting

- Daily stand-up checkpoint while blockers outstanding.  
- Update `impl_tracking/` with per-workstream burndown.  
- Re-run full validation on completion; do not flip feature flags beyond Phase 1 prior to sign-off.  
- Attach remediation PRs to this plan for traceability; include risk assessment for each flag enablement.

## 4) Risks & Mitigations

- **Scope creep**: keep non-PRD enhancements out of scope; use change control.  
- **Migration safety**: rehearse migrations in staging backups; provide rollback scripts.  
- **Timeline pressure**: prioritize blockers (foundational + Git + modal) before medium items.

