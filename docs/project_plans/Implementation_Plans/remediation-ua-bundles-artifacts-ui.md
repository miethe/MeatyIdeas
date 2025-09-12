# Remediation Plan — Bundles/Artifacts UI Wiring (2025-09-11)

Problems observed

- DialogFooter import error in `artifacts-panel.tsx` causes runtime failure; our `ui/dialog.tsx` does not export `DialogFooter`.
- CommitDialog renders undefined component due to the bad import, producing React "type is invalid" warning.
- "Connect repo" just fires a local connect POST; it should open a modal to choose provider and (optionally) a remote repo URL before submitting.
- No path validation hints for commit; UX needs paths/message/push controls.

Fix approach

1) Dialog component: either add `DialogFooter` export or avoid it. Chosen: avoid extra export to keep `ui/dialog.tsx` minimal; use a styled div footer in CommitDialog.
2) Connect modal: add `ConnectRepoDialog` with provider select (local/github) and optional `repo_url`. Wire to `POST /projects/{id}/artifacts/connect` and surface errors.
3) ArtifactsPanel: replace bare button with ConnectRepoDialog; keep status/history and CommitDialog intact.
4) Smoke checks: navigate project page, open connect modal, connect local/remote, commit & push, export bundle, confirm no React warnings.

Out of scope

- OAuth for providers; GitHub PAT-only remains.
- Deep validation of repo URLs beyond basic required when provider != local.

Deliverables

- UI fixes and modal component; import error resolved.
- Update ArtifactsPanel to use modal and remove failing import.

