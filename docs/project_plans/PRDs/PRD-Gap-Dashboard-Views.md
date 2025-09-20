# PRD Gap Review (2025‑09‑19 Dashboard Views & Project Cards)

- Telemetry coverage absent – no client events for view/filter changes, card impressions, or quick actions. Recommendation: instrument the React handlers (views rail, filter bar, card hover/click/star) to emit the dashboard_* events defined in the PRD and wire them to the existing telemetry pipeline.
- Tag interactions incomplete – project card tag pills aren’t clickable, and the filter bar still relies on a prompt instead of inline suggestions/typeahead. Recommendation: make tag badges add filters on click (with Cmd+Click opening search) and replace the prompt with the same suggestion list used in the sidebar.
- Owner filter limited – only All and Me are available; the PRD calls for selecting specific owners. Recommendation: extend the API/UI to surface owner identities and allow multi-owner selection (even if seeded with demo data for now).
- Updated filter lacks custom ranges – presets cover 7/30/90 days, but custom date ranges aren’t available. Recommendation: add a popover with calendar inputs when “Custom” is chosen, and pass updated_after/before through the existing API fields.
- No view-level icons or analytics – the views rail renders plain text and doesn’t emit the required dashboard_view_changed event. Recommendation: add the designed iconography and fire an analytics hook whenever handleViewChange runs.
