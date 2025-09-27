---
title: "Implementation Plan — Project File UX Refresh"
status: Ready
version: 1.0
date: 2025-09-24
inputs:
  - PRD: docs/project_plans/PRDs/2025-09-24-project-file-ux-prd.md
owner: Delivery Lead: TBD (Frontend: TBD, Backend: TBD)
-----------------------------------------------------------------------------------

## 0) Summary

Upgrade the project detail experience with real-time file visibility, guided folder selection, and richer metadata surfaces. Plan coordinates backend event coverage, frontend cache orchestration, dialog redesigns, and telemetry so file operations feel instant and consistent across modal and full-page contexts.

## 1) Scope & Complexity

Complexity: Medium-High — touches event streaming, React Query caches, shared design system components, and multiple file surfaces (modal tree, detail grid, create/move flows). Requires tight sequencing between backend and frontend to guarantee fresh data without regressions.

## 2) Workstreams

1. **Backend Event & Metadata Services** — expand SSE coverage, serializers, and directory helpers.
2. **Frontend Sync & Data Layer** — reconcile caches, refactor shared transformers, and ensure parity across surfaces.
3. **Creation & Folder UX** — path combobox, folder dialog, validation, and optimistic updates.
4. **File Metadata Presentation** — detail card enhancements, metadata mapping, accessibility polish.
5. **QA, Telemetry, Rollout** — instrumentation, regression, documentation, and feature flag management.

## 3) Milestones & Timeline

- **Week 1**: Backend event/schema updates, shared metadata transformer scaffolding.
- **Week 2**: Frontend cache sync, tag parity fixes, path combobox foundation.
- **Week 3**: Folder dialog, metadata panel, telemetry, QA + rollout prep.

## 4) Backend Event & Metadata Services (Week 1)

### 4.1 SSE Event Expansion
- **Task**: Emit `file.created`, `file.updated`, `file.deleted`, `file.tagged`, `dir.created`, `dir.deleted`, `dir.renamed` events with payloads compatible with frontend tree updates.
  - Acceptance: Event schema documented; unit/integration tests assert event emission on mutations; throttling guard prevents storms.
  - Dependencies: Existing mutation endpoints.
  - Estimate: 3 points.

### 4.2 Files API Metadata Enrichment
- **Task**: Update `/projects/{id}/files` serializer to include canonical tags, parsed front matter map, and icon hints in single payload.
  - Acceptance: Response includes `tag_details`, `front_matter_fields` (ordered), `icon_hint`; performance baseline measured (<200ms for 200 files).
  - Dependencies: Front matter parser utility.
  - Estimate: 2 points.

### 4.3 Directory Lookup Endpoint
- **Task**: Provide cached directory listing endpoint (`/projects/{id}/dirs?flatten=1`) or reuse tree endpoint with slim payload for picker.
  - Acceptance: Supports nested paths, returns last modified timestamp for cache invalidation.
  - Dependencies: Directory persistence config.
  - Estimate: 2 points.

## 5) Frontend Sync & Data Layer (Week 1-2)

### 5.1 Shared Metadata Transformer
- **Task**: Create utility to normalize file DTOs for modal, tree, and cards; ensures consistent tag/metadata usage.
  - Acceptance: Unit tests covering varied front matter; replaces ad-hoc parsing in modal + detail page.
  - Dependencies: Backend enriched payloads.
  - Estimate: 2 points.

### 5.2 React Query Cache Orchestration
- **Task**: Wire SSE/WebSocket handlers to invalidate/update `['files', projectId]` and tree queries on new event types.
  - Acceptance: Manual refresh no longer required; includes stale-while-revalidate fallback; smoke tests for heavy churn.
  - Dependencies: 4.1 events.
  - Estimate: 3 points.

### 5.3 Tag Sync Bugfix
- **Task**: Ensure tag edits update detail cards by reusing normalized data and triggering cache updates after tag mutation success.
  - Acceptance: Tag chip parity between modal and detail page verified; regression test added.
  - Dependencies: 5.1 transformer.
  - Estimate: 1 point.

## 6) Creation & Folder UX (Week 2)

### 6.1 Folder Path Combobox Component
- **Task**: Build reusable combobox with async folder search, keyboard navigation, and "Create new" CTA.
  - Acceptance: Works within file create dialog; validation prevents invalid characters; storybook entry with accessibility checks.
  - Dependencies: 4.3 directory endpoint.
  - Estimate: 3 points.

### 6.2 Atomic Folder + File Creation Flow
- **Task**: When user creates new folder from combobox, ensure backend call happens before file POST (or add API support for nested path creation).
  - Acceptance: Race conditions handled; optimistic UI updates tree and cards upon success; error toasts revert state.
  - Dependencies: 6.1 component, backend folder API.
  - Estimate: 2 points.

### 6.3 Replace Browser Prompts
- **Task**: Implement Radix dialog for "New Folder" actions (root + nested) using combobox component; remove `prompt` usage.
  - Acceptance: Dialog matches design system, includes success/error states, integrated with SSE refresh.
  - Dependencies: 6.1 component.
  - Estimate: 2 points.

## 7) File Metadata Presentation (Week 3)

### 7.1 Metadata Mapping & Labels
- **Task**: Define whitelist + label map for front matter keys (e.g., owner, status, due_date) with formatting helpers.
  - Acceptance: Configurable map stored in shared constants; tests for formatting date/status; fallback to generic display.
  - Dependencies: 5.1 transformer.
  - Estimate: 1 point.

### 7.2 Card Layout Enhancements
- **Task**: Extend file cards to display metadata grid/badges, ensure responsive layout, and include toggle/expansion if needed.
  - Acceptance: Desktop and mobile views verified; metadata hidden when empty; accessibility (aria-expanded) for toggles.
  - Dependencies: 7.1 mapping.
  - Estimate: 3 points.

### 7.3 Modal/Detail Parity Audit
- **Task**: Align modal preview sections to use same metadata component to avoid drift; update ItemModalViewer accordingly.
  - Acceptance: Shared component installed; regression tests for both surfaces.
  - Dependencies: 7.2 component.
  - Estimate: 2 points.

## 8) QA, Telemetry, Rollout (Week 3)

- **Task**: Instrument telemetry (`file_sync_refresh`, `file_path_selector_used`, etc.) and document payload schemas.
  - Acceptance: Events visible in staging analytics; sampling validated.
  - Dependencies: Workstreams 5-7.
  - Estimate: 1 point.

- **Task**: Regression + accessibility sweep covering file CRUD, folder flows, tag edits, and metadata viewing (desktop + mobile).
  - Acceptance: Test matrix complete; no critical blockers; AXE/assistive tech spot-check.
  - Dependencies: Feature complete build.
  - Estimate: 2 points.

- **Task**: Feature flag management, launch checklist, runbook for rollback, stakeholder enablement.
  - Acceptance: `project_file_ux_refresh` flag toggled in staging/prod; release notes prepared; support brief created.
  - Dependencies: All streams.
  - Estimate: 1 point.

## 9) Risks & Mitigations

- **Event Storming**: Debounce redundant SSE triggers and batch cache invalidations; monitor logs for high-frequency events.
- **Combobox Complexity**: Pair with design early, build Storybook scenarios, and add keyboard-only QA run.
- **Metadata Payload Size**: Use lazy expansion if payload exceeds threshold; add telemetry to track response sizes.
- **Regression in Legacy Browsers**: Include fallback for browsers lacking `EventSource` reliability (retry logic already in place, verify post-changes).

## 10) Exit Criteria

- Real-time sync verified: no manual refresh required for file/folder/tag updates across tree, modal, and detail page.
- File creation and folder dialogs use consistent, accessible UI with validated path selection.
- File cards and modal display consistent metadata; UX sign-off received.
- Telemetry dashboards operational; QA/accessibility sign-offs archived.
- Feature flag removed following stable production monitoring window.

## 11) Dev-Ready Breakdown (Repo Specific)

### Backend
- **Event Stream Coverage**
  - Files: `app/api/events_pub.py`, `app/api/routers/files.py`, `app/api/routers/dirs.py`, `app/api/routers/projects.py`, `app/api/routers/tags.py` (new), `app/api/tests/test_events.py` (new).
  - Implementation: add helper to publish new events (`file.created`, `file.updated`, `file.deleted`, `file.tagged`, `dir.created`, `dir.moved`, `dir.deleted`). Emit from create/update/delete routes plus tag mutation handlers. Document schema in `docs/architecture/events.md`.
  - Validation: run `pytest app/api/tests/test_phase3_dirs_and_batch.py app/api/tests/test_events.py` and verify Redis channel emits expected payloads via `redis-cli monitor` during manual smoke.

- **Files API Enrichment**
  - Files: `app/api/routers/projects.py`, `app/api/schemas.py`, `app/api/tests/test_project_files.py` (new).
  - Implementation: extend `FileRead` schema with `tag_details`, `front_matter_fields`, `icon_hint`, `metadata_signature`. Normalize front matter into ordered list with human-readable labels and include tag color data. Add serializer helper in `app/api/services/files.py` (new module) to share logic with modal endpoints.
  - Validation: `pytest app/api/tests/test_project_files.py -k metadata` and manual curl `curl -H 'X-Token: devtoken' localhost:8000/api/projects/<id>/files` to inspect payload structure.

- **Directory Lookup Endpoint**
  - Files: `app/api/routers/dirs.py`, `app/api/schemas.py`, `app/api/tests/test_phase3_dirs_and_batch.py` (extend), `docs/api/directories.md`.
  - Implementation: add `GET /api/projects/{id}/dirs` returning flattened list with `path`, `depth`, `last_modified`. Integrate caching via Redis key `project:{id}:dirs` with 30s TTL. Respect `settings.dirs_persist` guard.
  - Validation: `pytest app/api/tests/test_phase3_dirs_and_batch.py::test_list_dirs_endpoint` and ensure SSE `dir.created` invalidates cache.

- **Tag Mutation Hook**
  - Files: `app/api/routers/files.py`, `app/api/search/index.py` (if tag indexing impacted), `app/api/tests/test_file_tags.py` (new).
  - Implementation: after tag updates, recompute tag associations, emit `file.tagged` event with delta list, and refresh search index summary.
  - Validation: `pytest app/api/tests/test_file_tags.py` covering add/remove scenarios.

### Frontend
- **Event Handler & Cache Sync**
  - Files: `app/frontend/components/files/file-tree.tsx`, `app/frontend/app/projects/[project]/page.tsx`, `app/frontend/components/projects/project-detail-modal/file-tree/useFileTreeState.ts`, `app/frontend/lib/react-query.ts` (new hook), `app/frontend/lib/types.ts`.
  - Implementation: centralize SSE subscription in shared hook, push updates into React Query caches via `setQueryData` when events arrive, and fallback to `invalidateQueries` when payload insufficient. Ensure tree + cards reuse same normalized response.
  - Validation: `pnpm test --filter "file tree"` (new Vitest suite) and manual run: create file, see card update without refresh.

- **Metadata Normalization**
  - Files: `app/frontend/lib/files/normalizeFile.ts` (new), update imports in `ItemModalViewer`, `project-detail-modal/sections`, `app/frontend/app/projects/[project]/page.tsx`.
  - Implementation: convert API payload into `FileItem` with `metadataFields` array for display; ensure default ordering matches PRD.
  - Validation: unit tests for transformer (`pnpm test --filter "normalizeFile"`).

- **Path Combobox Component**
  - Files: `app/frontend/components/files/folder-path-combobox.tsx` (new), `app/frontend/components/files/file-create-dialog.tsx`, `app/frontend/components/files/file-move-dialog.tsx` (opt-in reuse), `app/frontend/components/ui/command.tsx` (if needed for typeahead).
  - Implementation: build controlled Combobox with async directory fetch (`useQuery(['project-dirs', projectId], ...)`) and inline "Create new folder" flow invoking new dialog.
  - Validation: story in `app/frontend/components/files/folder-path-combobox.stories.tsx`, keyboard navigation QA, snapshot test for suggestions.

- **Folder Dialog**
  - Files: `app/frontend/components/files/folder-create-dialog.tsx` (new), `app/frontend/components/files/file-tree.tsx`, `app/frontend/app/projects/[project]/page.tsx`.
  - Implementation: replace `prompt` usage with Radix dialog, share combobox for parent path, show validation errors from API, trigger SSE refresh on success.
  - Validation: `pnpm test --filter "folder dialog"` (component tests) and manual create/rename flows.

- **Metadata Presentation**
  - Files: `app/frontend/components/files/file-metadata-panel.tsx` (new), integrate with `Card` layout and `ItemModalViewer`, update CSS to support responsive grid.
  - Implementation: present whitelisted fields with label/value pairing, include `TagChip` reuse, add toggle state for compact mode.
  - Validation: visual regression via Chromatic (if enabled) or Percy; manual mobile viewport check.

### QA, Telemetry, Rollout
- **Telemetry Wiring**
  - Files: `app/frontend/lib/telemetry.ts`, add new spans in `file-create-dialog`, `folder-create-dialog`, metadata panel toggle. Backend: extend `app/api/telemetry.py` if sampling required.
  - Validation: confirm events in staging console; add automated check in `qa/telemetry-smoke.md`.

- **Test Matrix & Automation**
  - Files: `docs/impl_tracking/2025-09-24-file-ux-test-matrix.md` (new), `package.json` scripts for targeted FE tests.
  - Implementation: document scenarios (file create, folder create, tag edit, metadata view) across desktop/mobile, include assistive tech notes.

- **Rollout Checklist**
  - Files: `docs/release_notes/2025-09-24-project-file-ux.md` (new), update `docs/ops/feature-flags.md` with `project_file_ux_refresh` flag semantics.
  - Implementation: capture enable/disable steps, monitoring dashboards, and rollback command to remove SSE listeners.

## 12) Testing Strategy

- **Unit Tests**: expand FastAPI suites for events, files metadata, directory listings; add Vitest coverage for transformers and combobox logic.
- **Integration Tests**: end-to-end script in Playwright (or Cypress) validating create file → metadata updates without refresh; ensure coverage for folder dialog and tag sync.
- **Accessibility Testing**: run AXE on file create workflow and metadata panel; include keyboard-only pass for combobox and dialog.
- **Performance Monitoring**: benchmark `/api/projects/{id}/files` response size/time pre vs post change; record in `docs/impl_tracking/2025-09-24-file-ux-performance.md`.
- **Release Validation**: smoke test in staging with feature flag toggled off/on; verify telemetry and logs show no error spikes.
