# Implementation Plan — UI for Bundles v2 & Artifacts v2 (2025-09-11)

Goals

- Bundles Wizard: file/tag selection, roles, options (checksums, push, PR), manifest preview, launch export.
- Bundles History: list bundles with status, created_at, branch/pr links, verify + download.
- Artifacts Panel: status card (provider/branch/ahead-behind), commit dialog (paths, message, push), recent history.
- SSE toasts already present; add handling for branch pushed and PR.

Scope & Components

- `ExportBundleWizard` (Dialog) with steps: Select → Roles → Options → Preview.
- `BundlesHistory` (Card + list) with actions: Verify, Download, Open PR.
- Enhance `ArtifactsPanel`: fetch status/history; `CommitDialog` to commit paths.

API Wiring

- Use existing endpoints from backend v2: bundles create/list/get/verify/download; artifacts status/history/commit/connect.

UX Notes

- Favor shadcn components; keep wizard uncluttered; defaults sensible (include checksums on, push/PR off by default).
- Show inline hints and confirmation toasts.

Validation

- Manual flow: connect artifacts (local), commit a file, export bundle with roles (no push), verify passes; optionally set GITHUB_TOKEN and connect remote to test push/PR.

