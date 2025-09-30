# QA Checklist — 2025-09-27 Creation & Dashboard UX Refresh

## Navigation & Entry Points
- Trigger `New` menu (click) and verify options: `New Project`, `New File → Quick Create`, `New File → Create…`.
- Use keyboard shortcuts: `n` opens Quick Create (when flag enabled), `shift+n` routes to full editor.
- Context awareness: invoke menu/shortcut from within a project and confirm project pre-selected in dialogs.

## Quick Create Dialog
- Opening via nav, via project page button, and via editor hotkey.
- Project selector required when opened globally; defaults when invoked in project scope.
- Path builder validation: disallow forward slash in filename, blank filename error.
- Folder combobox disabled until project selected; create folder flow from combobox.
- Expand toggle loads full form without losing inputs; collapse restores quick layout.
- Inline project creation entry launches mini dialog, auto-selects new project on success.
- Type picker reads `/config` options and allows inline creation; new type appears immediately.
- Tag pill input supports auto-complete and freeform entries; removing tags updates front-matter.
- Markdown toolbar buttons apply formatting; backlink picker lists project files, inserting `[[Title]]` at cursor.
- Save file: toasts, file appears in project list, recent files rail updates, router navigates to the new file.

## Full-Screen Create Flow
- Landing page loads with project selector, template dropdown (Blank), description field, preview pane.
- `Save` persists without leaving page; subsequent saves call update endpoint.
- `Save & Close` returns to project page and opens file modal.
- Dirty tracking: Save & Close disabled when no changes pending, re-enabled after edits.
- Preview updates within ~300ms when typing; handles large content gracefully.
- Inline project creation available from project select; new project auto-selected after creation.
- Type dropdown mirrors config options and supports inline creation via prompt.
- Tag pill input mirrors Quick Create behavior; markdown toolbar/backlinks available in full editor.

## Dashboard Sort & Quick Filters
- Sort dropdown reflects current selection, persists in URL, and re-orders list accordingly.
- Status chips: single-select behavior, toggling off clears filter, persists in URL `status` param.
- Group chips: multi-select, toggling updates URL `group` params, `Clear` removes all quick filters.
- Reset filters clears status, group, sort, density overrides.

## Recent Files Rail
- Appears on dashboard when feature flag enabled; shows up to 5 most recent files with project attribution.
- `Peek` opens file modal in same tab, `Open` launches new tab.
- Handles empty state and API failure gracefully.

## Visual & Accessibility Checks
- Group badges show color chip + pill on project cards and project detail header.
- Keyboard focus on quick filter chips and sort dropdown.
- Screen-reader labels for New Project card and dropdown items.
- Dark/light mode visual parity for new surfaces.

## Regression Pass
- Legacy behavior with feature flag disabled: old `New Project` button present; quick filters, recent rail hidden.
- Project creation, file listing, and group dialogs still operate as before.
