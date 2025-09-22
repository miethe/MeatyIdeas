---
title: "MeatyProjects — File Ingest & Organization PRD"
version: 1.0
status: Draft
date: 2025-09-21
owner: Product: TBD, Tech Lead: TBD
---

## 1) Purpose & Vision

Deliver a frictionless, trustworthy file management experience that lets builders add and organize project assets without leaving the workspace. Uploads must feel effortless (button or drag-and-drop), respect folder context, and support reorganizing existing files with the same delightful polish expected from native desktop tooling.

## 2) Background & Problems Today

- Uploading requires leaving the modal for a separate flow, breaking focus and causing abandonment.
- Drag-and-drop is absent; users cannot leverage muscle memory from Finder/Explorer workflows.
- File placement is imprecise—assets land in root folders even when a nested directory is open.
- Reorganizing files requires workarounds (download, delete, re-upload), wasting time and risking data loss.

## 3) Goals & Non-Goals

In scope
- Dual upload entry points (Upload button, drag-and-drop) in Project Detail Modal and full-screen detail view.
- Folder-aware drop zones that respect the active folder context and allow dropping directly onto a folder in the tree.
- Drag-and-drop reorganization of existing files and folders within the project tree.
- Graceful handling for duplicate names, large files (size guardrails), and upload failures.

Out of scope
- Version history or file diffing; ensure architecture leaves room for future revisions.
- External storage integrations (Drive, Dropbox) beyond existing local uploads.
- Bulk permission controls or per-file ACLs.
- Offline upload queueing.

## 4) Target Users & JTBD

- **Builder / Lead Contributor**: “When I discover new assets, let me toss them into the right folder immediately so progress never stalls.”
- **Designer / Researcher**: “I need to drag screenshots, PDFs, and notes straight into project folders without fiddly dialogs.”
- **Ops Coordinator**: “I must keep project file trees tidy; moving misplaced files should be a simple drag instead of a delete/reupload cycle.”

## 5) Success Metrics

- Upload task completion rate ≥ 95% (uploads that finish without user abandoning flow).
- Median time-to-upload (from initiation to visible in tree) ≤ 4 seconds for ≤ 25 MB assets.
- Dragged reorganization adoption: ≥ 60% of file moves happen via drag-and-drop within 30 days post launch.
- Upload error rate < 2% (excluding network failures) over trailing 14 days.
- NPS verbatims referencing “file management” shift from negative to net-neutral within one release cycle.

## 6) Experience Overview

### 6.1 Upload Button Flow
- Prominent `Upload` button visible near file list header (modal and full view). Dropdown offers `Upload File`, `Upload Folder` (if browser support), and `Create Folder` quick links.
- Selecting upload opens native file picker; chosen files show inline staging row with status, filetype icon, and target folder path.
- Allow folder selection via tree picker if user wants to override current folder before confirm.

### 6.2 Drag-and-Drop Upload
- Entire file content area becomes an elevated drop zone when user drags file(s); active folder name surfaces in helper text.
- Tree view highlights drop target folder with accent outline; hovering over collapsed folder auto-expands after short delay (350 ms).
- Upload queue appears as lightweight toast stack with real-time progress bars; tapping toast jumps to file location once completed.

### 6.3 Reorganization Drag
- Existing files/folders draggable via handle or row; hovered destination folder shows “Move to…” tooltip and drop indicator.
- Support drag between tree nodes and list area; ensure accessible alternative via context menu (`Move to…`).
- Moves execute instantly with optimistic UI and rollback if API fails (with toast + retry).

### 6.4 Error & Edge Cases
- Duplicate filenames prompt modal to “Replace, Keep Both, Cancel” with preview metadata.
- Large files show pre-flight guard if exceeding project limits; provide CTA to contact admin for override.
- Offline detection disables uploads with inline banner; queue resumes when connection restored.
- Accessibility: keyboard equivalent (`Shift+M` to open move dialog), focus management for drop zone.

## 7) Functional Requirements

1. Upload button present in modal and full view, respecting responsive layouts.
2. Dragging files into list uploads into active folder; dropping onto tree node uploads there.
3. Support multi-file uploads up to existing backend limit (configurable per environment); surface progress per item.
4. Preserve folder hierarchy when uploading folders or multi-select directories (where browser supports) with fallback to zipped instructions.
5. Allow cancelling individual uploads; ensure partial successes do not roll back completed items.
6. Reordering: allow dragging files/folders across tree; enforce restrictions (no moving folder into its descendant).
7. API validations return descriptive errors (size, type restrictions); UI renders inline messaging.
8. Emit analytics events (`file_upload_started`, `file_upload_completed`, `file_move_completed`, `file_upload_failed`) with metadata (size, duration, target path).
9. All upload and move actions respect project permissions and lock states; disable UI when user lacks write access.

## 8) System & Architecture Requirements

- Introduce resumable upload endpoint (chunked) or confirm existing API can handle parallel multi-file uploads; document throughput expectations.
- Backend to accept target folder parameter and enforce path normalization; ensure transactional writes to avoid orphaned metadata.
- Real-time progress via SSE/WebSocket channel or polling fallback; prefer shared upload service used by future bulk operations.
- Update file index/cache after upload/move to keep tree in sync; propagate via pub/sub to all open sessions.
- Rate limiting and antivirus scanning (if applicable) must run asynchronously without blocking UI, but prevent downloads of quarantined files.

## 9) Data Model Changes

- No new tables expected; may add columns to `files` table for upload session tracking (`upload_id`, `status`).
- Introduce `file_activity` audit log entries for move events if not already captured.

## 10) Analytics & Telemetry

- Track upload duration (client + server), file size bands, move frequency, failure codes.
- Dashboard chart: uploads per day, average files per upload, most-moved folders.
- Alert when failure rate > 5% in 15-minute window or when queue backlog > 50 items.

## 11) Rollout Strategy

1. Ship behind `FILE_UPLOAD_V2` flag; enable internal tenants first.
2. Run stress test with synthetic 500-file upload to validate concurrency.
3. Collect usability feedback from design partners; adjust hover states / discoverability.
4. Gradually roll out to 25%, 50%, 100% of orgs while monitoring failure metrics.
5. Publish release notes and updated onboarding video.

## 12) Dependencies & Coordination

- Requires design system updates for drop zones, progress toasts, and draggable list rows.
- Coordinate with infra for storage quota enforcement and antivirus integration.
- QA needs multi-browser matrix (Chrome, Safari, Edge) for drag-and-drop behaviour.
- Support team requires updated troubleshooting scripts for stuck uploads.

## 13) Open Questions

1. Do we enforce per-project storage quotas at upload time or allow overflow with warning?
2. Should uploads default to current folder even if tree focus differs from list selection? (Proposed: follow primary list context.)
3. Do we surface checksum validation for files? (Optional; consider for future reliability improvements.)

## 14) Risks & Mitigations

- **Large payload spikes**: apply rate limits, chunked upload, and CDN pre-signed URLs to protect backend.
- **Drag-and-drop discoverability**: add subtle onboarding tooltip, highlight drop zone when user hovers `Upload` button.
- **Move conflicts**: enforce optimistic locking with backend validation to prevent race conditions.
- **Cross-browser inconsistency**: invest in component-level QA and fallback to button flow when drag unsupported.

## 15) Definition of Done

- Upload and move flows meet success metrics and pass cross-browser QA.
- Accessibility audit signed off (keyboard, screen reader, contrast states for indicators).
- Telemetry dashboards live with alerts configured; support documentation updated.
- Feature flag removed after stable release and post-launch review.
