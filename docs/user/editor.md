# Editor Guide

The Editor supports split view editing with live preview, attachments, wiki-links, and backlinks.

- Open the editor: `/projects/{project}/edit/{fileId}`
- Shortcuts: Cmd/Ctrl+S to save, Cmd/Ctrl+N to open new file dialog (if provided), Cmd/Ctrl+P to open the command palette.
- Insert menu: templates (PRD, Mermaid, KaTeX), wiki-link, and attachment upload.
- Attachments: Uploads go to `/artifacts/assets/` within your project; the editor inserts `![alt](/artifacts/assets/...)` automatically.
- Outgoing links panel: shows links detected in this file and whether they resolve to an existing file; create missing targets inline.
- Backlinks panel: lists files that reference this file; click to open in the editor.

Saving updates link indexes and preview. If you change the title and keep “Rewrite links” enabled, other files containing `[[OldTitle]]` will be rewritten to `[[NewTitle]]`.

