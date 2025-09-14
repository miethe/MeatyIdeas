# Import/Export & Sharing

- Import: Project page → Import. Supports Zip, individual files, JSON schema, or Git repository URL. Optionally specify target path within project.
- Export: Use the Results modal to select rows and click “Export selected” to enqueue a Zip export. Download links appear when jobs complete.
- Share: Project page → Share. Create a share link (optionally with expiry). Copy and share the URL to provide read-only access at `/share/{token}`. Revoke to disable.

Progress and status are visible via toasts and background job polling. Server publishes SSE events (`import.*`, `export.*`) on the project channel for integrations.
