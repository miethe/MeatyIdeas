---
title: "MeatyProjects — File Visibility & Tag Display PRD"
version: 1.0
status: Draft
date: 2025-09-21
owner: Product: TBD, Tech Lead: TBD
---

## 1) Purpose & Vision

Create a unified file viewing experience where context is immediate: every file should communicate its type, tags, and relevance at a glance. Borrowing from the clarity of IDEs like VSCode, we will surface iconography and tag chips that keep builders oriented even in dense trees.

## 2) Background & Problems Today

- File names alone force users to open assets to confirm purpose or category.
- Tags exist in backend metadata but are invisible in primary file viewers, reducing discoverability.
- Lack of filetype cues causes confusion when mixed asset types share similar naming conventions.
- Visual clutter risk: earlier attempts to add metadata to file lists degraded readability.

## 3) Goals & Non-Goals

In scope
- Display filetype iconography consistent across tree, list, and search results.
- Present file tags inline with filename while preserving readability and spacing across devices.
- Provide hover affordances for tag explanations and quick filtering (where applicable).
- Ensure accessibility (screen reader labels, high contrast) and responsive behaviour.

Out of scope
- Modifying underlying tag model (handled by tag normalization roadmap).
- Tag editing within file row (covered by project metadata editing initiative).
- Bulk tag management or analytics on tag usage.

## 4) Target Users & JTBD

- **Builder**: “When scanning the file tree, show me the purpose (tags) without opening each file.”
- **Designer / Researcher**: “I want to confirm design assets via visual tag chips and icons quickly.”
- **Reviewer / Stakeholder**: “I need clarity on which documents are finalized or in review to avoid mistakes.”

## 5) Success Metrics

- Tag visibility adoption: ≥ 80% of file views include at least one tagged file with chips rendered correctly (tracked via telemetry).
- Reduction in file-open churn: decrease redundant open/close actions by 25% within 30 days of launch.
- Accessibility compliance: 0 critical accessibility issues in audit; screen reader transcripts expose tag lists accurately.
- Qualitative: ≥ 4.5/5 satisfaction in post-launch survey question on “clarity of file context.”

## 6) Experience Overview

### 6.1 File List & Tree
- Each file row begins with icon (language or type-specific) sized 16 px, aligned with tree indentation.
- Filename remains primary text; tag chips follow with subtle separator (`•` or spacing) to avoid misreading.
- Tag chips: pill shape, muted background, bold label; support up to 3 visible tags with `+N` overflow indicator.

### 6.2 Hover & Overflow
- Hovering `+N` opens popover listing remaining tags with scroll if >10.
- Hovering a tag reveals tooltip with optional description/color meaning.
- On small screens, tags collapse into single compact pill showing first tag + `+N`; tapping reveals bottom sheet.

### 6.3 Icon System
- Leverage existing filetype inference (extension mapping). Provide fallback generic icon.
- Align icon set with VSCode-like palette (monochrome accent) adhering to design tokens.
- Icons respond to theme changes (light/dark), maintain contrast ratio.

### 6.4 Interactivity
- Tag click triggers filter in current context (file tree or search) if user has necessary permissions; otherwise shows info tooltip.
- Provide keyboard navigation: `Tab` to move into chip list, `Enter` to activate filter/tooltip.

## 7) Functional Requirements

1. File viewers (tree, list, modal preview related lists, search results) show icons and tag chips consistently.
2. Tag truncation logic ensures row height remains single line until responsive breakpoint forces wrap.
3. Support custom tag colors; ensure text contrast meets WCAG AA with fallback to neutral palette if custom color fails contrast check.
4. Provide accessible markup (`aria-label` listing tags) and maintain correct reading order.
5. Implementation must handle files without tags gracefully (no extra spacing).
6. Filtering triggered by tag chip must integrate with global search/tag filtering when available (emit event, update state).
7. Provide analytics events for `file_tag_clicked`, `file_tag_hovered`, `file_icon_rendered` (for instrumentation sampling).

## 8) System & Architecture Requirements

- FE: Extend `FileNode` model to include tags (slug, label, color) and icon descriptor.
- BE: Ensure file list endpoints return associated tags and filetype metadata in single payload to avoid N+1 requests.
- Introduce caching/serialization updates to preserve performance (target render < 16 ms per list row).
- Shared UI components: `FileIcon`, `TagChip`, with theme tokens stored in design system.

## 9) Data Model Changes

- None; reuse existing tag associations. May add computed field in serializers for `primary_color` fallback.

## 10) Analytics & Telemetry

- Track tag visibility coverage (percentage of files in viewport with chips rendered).
- Monitor performance: log list render duration before/after release.
- Capture tag filter engagement ratio (chip clicks / total tag impressions).
- Alert on missing metadata rates (files lacking icon mapping > 10%).

## 11) Rollout Strategy

1. Immediate rollout, as app is still in active development.

## 12) Dependencies & Coordination

- None; you have the full-stack expertise and design prowess for end-to-end ownership of this feature.

## 13) Open Questions

1. Should tag chips display emoji/iconography if provided in tag metadata? A: Yes, if it fits within design constraints.
2. Do we allow inline edit (rename tag) in tooltip? (Recommendation: defer to tag management project.) A: No, out of scope for now.
3. How do we handle extremely long tag labels? (Proposal: max width + ellipsis with tooltip.) A: Yes, truncate with tooltip.

## 14) Risks & Mitigations

- **UI clutter**: design review and A/B testing to ensure readability; apply limit on visible tags.
- **Performance regression**: virtualization for large file trees; memoize icon + chip components.
- **Data mismatch**: ensure backend returns tags for all contexts; add monitoring to catch missing associations.

## 15) Definition of Done

- Icons and tags render in all targeted contexts with consistent styling.
- Accessibility and performance benchmarks met.
- Telemetry dashboards updated; support documentation published.
- Feature flag sunset after stable release review.
