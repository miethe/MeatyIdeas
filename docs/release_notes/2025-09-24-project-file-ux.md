# Release Notes — Project File UX Refresh (2025-09-24)

## Highlights
- **Live file sync**: Project cards, modal preview, and file tree refresh automatically on create/update/delete events with SSE-backed cache orchestration.
- **Guided file creation**: The new combobox-based folder selector eliminates manual path typing and links directly to the native folder dialog for on-the-fly structure changes.
- **Native folder dialogs**: All folder creation flows now use Radix dialogs with validation and helpful context instead of browser prompts.
- **Metadata everywhere**: File cards, modal preview, and the standalone file viewer surface front matter fields (status, owner, due date, etc.) consistently.

## Developer Notes
- New API `GET /api/projects/{id}/directories` returns flattened directory listings for selectors.
- Added SSE events `file.created`, `file.updated`, `file.deleted`, `file.tagged`, and `dir.renamed`; frontend hooks invalidate React Query caches accordingly.
- React Query key additions: `['project-dirs', projectId]`, `['file-details', fileId]`.
- Telemetry: `file_path_selector_used` (mode: existing/create), `file_metadata_viewed` emitted from modal preview. Ensure dashboards capture new events.
- Feature flag `project_file_ux_refresh` controls rollout; currently enabled for internal QA.

## QA Summary
- Regression sweep covered file CRUD, folder dialog flows, drag-and-drop moves, and modal previews (text + image). See `docs/impl_tracking/2025-09-24-file-ux-test-matrix.md` for detailed matrix.
- Performance spot-checks recorded in `docs/impl_tracking/2025-09-24-file-ux-performance.md`; no critical regressions observed.

## Follow-Ups
- Replace remaining folder rename/delete prompts with native dialogs.
- Extend metadata component to support quick edit hooks once inline editing is prioritized.
- Add Vitest coverage for normalization utilities and combobox interactions (pending test harness updates).
