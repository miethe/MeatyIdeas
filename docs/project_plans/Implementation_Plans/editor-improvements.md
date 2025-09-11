I’ll tighten the editor layout and toolbars, add Save/Cancel ergonomics, and ensure responsive, non-overlapping panels.

What I changed

Panel boundaries and layout
Each panel is now a bordered section with padding. No overlap.
Two-column grid on md+ screens; stacks on small screens.
Uses min-w-0 to avoid spillover; preview gets its own scroll area.
Two-tier toolbar
Toolbar 1: Title, Path, Insert actions (Template PRD, Mermaid, KaTeX, Link, Upload), “Rewrite links” toggle.
Toolbar 2: Formatting dropdown (Bold/Italic/Strikethrough/Inline code, H1–H3, Quote, Code Block, Lists, HR).
Responsive behavior:
md+ shows all actions inline.
On small screens, toolbar collapses to an Insert dropdown to avoid truncation.
Both toolbars flex-wrap instead of overlapping the preview.
Save/Cancel controls
Buttons appear below the text area.
Save is disabled until changes are made and updates the last saved state when successful.
Cancel reverts to last saved Title/Path/Content.
Editor text area sizing
Defaults smaller when empty (min 12rem); user can drag vertically (resize-y).
Live preview stays aligned in its own panel (no toolbar overlay).
Routing correctness
Editor route resolves slug → project id before calling upload APIs that require project_id.
Files updated

Editor component (toolbars, responsive behavior, formatting actions, Save/Cancel, panel boundaries):
app/frontend/components/editor/rich-editor.tsx:1
Editor page (slug-to-id resolution, loads only after project id resolved):
app/frontend/app/projects/[project]/edit/[file]/page.tsx:1
Modal viewer: adds “Open in Editor” link instead of only inline edit:
app/frontend/components/item-modal-viewer.tsx:1
How it behaves now

No overlap: Toolbar stays in the left panel and wraps/collapses as needed. Preview is independent.
Fully featured toolbar:
Insert: PRD template, Mermaid, KaTeX, wiki-link, attachments upload; rewrite-links toggle.
Formatting: Bold/Italic/Strike/Code; H1–H3/Quote/Code block/Lists/HR.
Save/Cancel:
Save highlights only when changes exist; otherwise grey/disabled.
Cancel reverts to last saved state.
Text area defaults smaller when empty; can be dragged larger; preview stays visible.
Mobile/small screens: actions coalesce under an Insert dropdown with no truncation.
Notes

I kept “Rewrite links” toggle visible on md+ and included it inside the Insert dropdown on small screens to conserve space.
The toolbar still offers individual buttons on wider screens; if you prefer fewer top-level buttons, I can group more actions under dropdowns.
Want me to add a sticky toolbar, quick-format hotkeys, and a More dropdown that auto-populates based on measured overflow instead of breakpoints? I can implement a ResizeObserver-driven overflow menu next.