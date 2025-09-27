# Creation & Dashboard UX Telemetry

## nav_new_select
- **When**: User chooses an option from the global `New` menu or triggers the `n` / `shift+n` hotkeys.
- **Payload**:
  - `item`: `project` | `file_quick` | `file_full`
  - `method`: `menu` | `hotkey`
  - `context_project_id`: project id in scope when invoked or `null`

## dashboard_sort_change
- **When**: Sort order changed from the dashboard sort control.
- **Payload**: `{ sort_key: string }` (`-updated`, `+updated`, `+name`, `-name`, `-created`, `+created`).

## dashboard_filter_chip
- **When**: Status or group quick-filter chips toggled, or quick filters cleared.
- **Payload**:
  - `type`: `status` | `group` | `clear`
  - `value`: status key, group id, or `'all'` when clearing
  - `active`: `true` when chip becomes active, `false` when deactivated/cleared

## dashboard_filters_reset
- **When**: "Reset filters" CTA used on the dashboard.
- **Payload**: `{}`

## recent_file_open
- **When**: User activates Peek or Open from the recent files rail.
- **Payload**: `{ file_id: string, project_id: string, action: 'peek' | 'open' }`

## ui.create.file
- **When**: File created via quick create or full editor.
- **Payload Additions**: `mode: 'quick' | 'full'` plus existing metadata.

## ui.update.file
- **When**: Full editor saves an existing draft after initial creation.
- **Payload**: `{ file_id: string, project_id: string }`
