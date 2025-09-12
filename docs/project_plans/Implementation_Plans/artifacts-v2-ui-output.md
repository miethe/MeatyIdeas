I drafted a UI implementation plan, then wired Bundles v2 and Artifacts v2 end-to-end per the PRD and our new plan. This delivers a polished wizard for bundle creation, a bundles history panel, and a full-featured artifacts panel with status/history and commit flows, all hooked to the backend we built earlier.

Plan

ExportWizard: Select → Roles → Options → Preview (shadcn Dialog).
BundlesHistory: list bundles, verify, download, PR/branch links.
ArtifactsPanel: status card (ahead/behind), history, Commit & Push dialog.
SSE toasts: show bundle branch/PR and commit results.
Frontend

Bundles wizard: app/frontend/components/bundles/export-bundle-wizard.tsx
Select files (checkbox list; All/None), tag/role assignment (simple select), options (checksums, push branch, open PR), preview manifest summary.
Calls POST /api/projects/{id}/export/bundle with selection.roles, include_checksums, push_branch, open_pr.
Bundles history: app/frontend/components/bundles/bundles-history.tsx
Lists bundles via GET /api/projects/{id}/bundles, shows status, created time, branch, PR link, Verify button, and Download.
Verify calls POST /api/bundles/{id}/verify.
Download uses GET /api/bundles/{id}/download (token in query).
Artifacts panel: app/frontend/components/artifacts-panel.tsx
Status via GET /api/projects/{id}/artifacts/status (branch, ahead/behind).
History via GET /api/projects/{id}/artifacts/history?limit=10.
Connect local repo button.
Commit dialog to enter paths, message, push toggle; calls POST /api/projects/{id}/artifacts/commit.
Project page:
Replaced simple export dialog with wizard, added BundlesHistory next to Artifacts Panel.
File: app/frontend/app/projects/[project]/page.tsx
SSE toasts:
bundle.branch_pushed, bundle.pr_opened handled in app/frontend/components/projects/project-events.tsx.
Backend Enhancements

Bundles router: app/api/routers/bundles.py
Accepts selection.roles; maps file_id → relative file path for roles.
Persists bundle row and enqueues job with options.
New endpoints:
GET /api/bundles/{id} (details)
POST /api/bundles/{id}/verify (checksum verify)
GET /api/bundles/{id}/download (zip stream)
GET /api/projects/{id}/bundles (history)
Worker job: app/worker/jobs/bundle_jobs.py
Accepts include_checksums, push_branch, open_pr, roles, bundle_id.
Marks bundle status (running → completed/failed), updates path, branch, pr_url.
Pushes bundle.branch_pushed and bundle.pr_opened SSE events.
Export bundle: app/api/bundle.py
Supports include_checksums and roles in manifest.
Git ops and Artifacts API:
Status and history wired in app/api/routers/artifacts.py using repo_status and repo_history from app/api/git_ops.py.
Commit returns commit_sha, respects push flag.
Settings: GITHUB_TOKEN support (github_token) for PR creation.
SSE already available; UI passes token via query param.
Docs

UI Plan: docs/project_plans/Implementation_Plans/bundles-artifacts-v2-ui.md
Git Setup updated for status/history and PR creation: docs/GIT_SETUP.md
Quick Smoke Checklist

Create project and files (UI or API).
Connect artifacts repo (local) from Artifacts panel.
Commit from panel (paths: “files”), see commit history render.
Export bundle via wizard (roles optional, push/PR off); see success toast; history shows queued→completed; Verify passes; Download works.
If testing push/PR: set GITHUB_TOKEN, connect remote, enable push/PR in wizard → branch pushed toast; PR link appears.
Want me to run docker-compose locally to validate end-to-end now, or wire any specific UI polish (e.g., tags filter in wizard, role presets by filename)?