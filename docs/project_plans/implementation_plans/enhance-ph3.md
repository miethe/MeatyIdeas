I’m going to implement the “Rich Editor” end-to-end: DB links + APIs for backlinks/attachments/render, then ship a full split-view editor with autosave, slash-like templates, wiki-links, attachments upload, and a backlinks sidebar. Also wire routing and docs.

What I Added

Editor Experience

Split-view editor page: app/frontend/app/projects/[project]/edit/[file]/page.tsx
Rich editor component with:
Live preview (debounced) via POST /api/render/markdown
Autosave on idle (1s) + ⌘S shortcut for manual save
Toolbar: templates (PRD, Mermaid, KaTeX), wiki-link inserter, attachments upload
Rename toggle: “Rewrite links on rename” (updates [[Old Title]] → [[New Title]])
Backlinks sidebar with linked docs
Open-in-editor link from modal viewer: app/frontend/components/item-modal-viewer.tsx
Keyboard shortcuts doc updated: docs/keyboard-shortcuts.md
Links/Backlinks (Server)

Model: Link in app/api/models.py (tracks edges src→target by title or resolved file_id)
Link extraction + upsert: app/api/links.py parses [[Wiki Links]], resolves to files by title, persists edges
Files router updates: app/api/routers/files.py
On create/update: reindex FTS + upsert links
On title change (when rewrite_links=true), rewrite wiki-link occurrences across project
Backlinks endpoint: GET /api/files/{file_id}/backlinks returns sources as FileRead
Attachments Upload (Server)

Endpoint: POST /api/projects/{project_id}/attachments/upload → saves under /data/projects/<slug>/artifacts/assets/…, returns relative path
Router: app/api/routers/attachments.py
FE integrates via toolbar button (inserts ![asset](/artifacts/assets/...) Markdown link)
Render-on-demand (Server)

Endpoint: POST /api/render/markdown → {html} (markdown-it)
Router: app/api/routers/render.py
Wired in app/api/main.py with token auth
Frontend Editor Component

app/frontend/components/editor/rich-editor.tsx
Two panes: textarea + preview (HTML)
Template inserts (PRD, Mermaid, KaTeX)
Wiki-link inserter, attachments upload (multipart), backlinks list
Autosave + ⌘S/⌘N/⌘P shortcuts
Integration & Docs

Main router includes attachments + render: app/api/main.py:1
README quickstart updated with editor route and acceptance step
Keyboard shortcuts doc updated
Key Files

Editor route: app/frontend/app/projects/[project]/edit/[file]/page.tsx:1
Editor component: app/frontend/components/editor/rich-editor.tsx:1
Item modal editor link: app/frontend/components/item-modal-viewer.tsx:1
Links model: app/api/models.py:1
Links service: app/api/links.py:1
Files router updates: app/api/routers/files.py:1
Backlinks endpoint: app/api/routers/files.py:1
Attachments router: app/api/routers/attachments.py:1
Render router: app/api/routers/render.py:1
API inclusion: app/api/main.py:1
Docs: docs/keyboard-shortcuts.md:1, README.md:1
How To Use

Open a project, click a file → “Open in Editor” (or go directly to /projects/<project_id>/edit/<file_id>).
In the editor:
Type Markdown on the left; live preview on the right.
Click “Template: PRD”, “Mermaid”, or “KaTeX” to insert snippets.
Click “Link” to insert a [[Title]] wiki-link (matches another file’s title).
Click “Upload” to attach an asset; it is saved under /artifacts/assets/... and the Markdown link is inserted.
Toggle “Rewrite links on rename” to automatically rewrite [[Old Title]] to [[New Title]] when you rename the current doc.
⌘S saves immediately (autosave also runs); ⌘N new file; ⌘P command palette.
Backlinks sidebar lists files linking to the current one.
API Overview (New/Updated)

POST /api/render/markdown → {html} for preview
POST /api/projects/{project_id}/attachments/upload → {path} for Markdown
GET /api/files/{file_id}/backlinks → [FileRead,…]
PUT /api/files/{file_id} accepts field rewrite_links (default true) for rename link rewrite
Acceptance

Editor route loads file, shows split-view with preview.
Insert templates via toolbar; [[Title]] links recorded; backlinks list shows sources.
Upload attachments works and inserts Markdown image link to /artifacts/assets/....
Saving updates FTS and links; renaming with rewrite updates [[...]] in other docs.
Notes

Math rendering: preview shows the raw $...$ unless a KaTeX integration is added later. Mermaid blocks are supported in the viewer.
Link resolution matches file titles; later we can add more robust disambiguation and a links/badges UI.
Attachments are stored regardless of git connection. Future iteration can commit/push automatically.
Want me to add inline KaTeX rendering in the preview and a wiki-link chooser with typeahead? I can extend the editor with these next.