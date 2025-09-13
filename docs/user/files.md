# Files Guide

Browse and manage files with the File Tree and the Editor.

- File Tree: Use the collapsible view to explore directories and files. Click a file to open it.
- Move/Rename: From the File Tree, choose “Move/Rename” on a file to change its path and/or title.
  - Dry-run shows how many files would be updated if the title changes and link rewrites are enabled.
  - Apply executes the move on disk and updates the database and search index.
- Link rewrite: When changing a file’s title, enabling “Update links” rewrites all occurrences of `[[OldTitle]]` to `[[NewTitle]]` across the project.

API reference
- `GET /projects/{id}/files/tree` → hierarchical listing.
- `GET /files/{id}/links` → outgoing links with resolution status.
- `POST /files/{id}/move` → dry-run/apply move and optional title change with link rewrite.

