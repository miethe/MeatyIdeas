# Runbook — UX Creation Dashboard Refresh

## Overview
Feature flag: `UX_CREATION_DASHBOARD_REFRESH`
Supporting config: optional `PROJECT_STATUSES` JSON array describing status chips.

## Enabling
1. Set `UX_CREATION_DASHBOARD_REFRESH=1` in environment (API + web).
2. Optionally override `PROJECT_STATUSES` (e.g. `[{"key":"draft","label":"Draft","color":"#2563EB"}]`).
3. Deploy backend and frontend.
4. Smoke tests:
   - Global `New` menu exposes project/file options.
   - Quick Create dialog enforces project selection and saves file.
   - `/files/create` full editor reachable via menu (`Create…`).
   - Dashboard displays sort dropdown, quick filters, recent files rail.
5. Monitor telemetry (`nav_new_select`, `dashboard_sort_change`, `recent_file_open`) and error logs for 15 minutes.

## Disabling / Rollback
1. Set `UX_CREATION_DASHBOARD_REFRESH=0` and redeploy.
2. UI reverts to legacy: single `New Project` button, no quick filters/rail.
3. Remove custom `PROJECT_STATUSES` if set.
4. Verify quick create modal still reachable from project pages.

## Notes
- Quick create + full editor POST to new `/files` endpoint; ensure API deployed before enabling flag.
- `PROJECT_STATUSES` accepts objects with `key`, `label`, optional `color` hex.
- Recent files rail queries `/files/recent`; ensure dataset non-empty or expect empty state.
