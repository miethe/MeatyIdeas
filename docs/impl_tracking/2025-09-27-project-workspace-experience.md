# Tracking — 2025-09-27 Project Workspace Experience Enhancements (Set 2)

## Task Checklist
- [x] Extend `/config` endpoint for statuses/types/templates
- [x] Provide recent files query and payload updates
- [ ] Ensure file create response enables immediate access
- [x] Refactor frontend filter bar to chip-based multi-select (includes `Sort By` move)
- [x] Implement global `Clear All` and chip clear UX + telemetry
- [x] Replace sidebar tags with synced chip interactions
- [x] Add project template selection to New Project modal
- [x] Implement recent files rail on dashboard/project view
- [x] Add blank new file card within project file lists
- [x] Update sidebar navigation interactions (modal open, hit area)
- [x] Link modal ↔ editor title interactions
- [ ] Enhance Quick Create with expand-to-full form
- [ ] Support inline project creation from Create form
- [ ] Add markdown toolbar + backlinks in Create content field
- [ ] Allow tag creation inline within Create flow
- [ ] Add type field with config + inline creation
- [ ] QA automated + manual coverage updates
- [ ] Documentation & release readiness (notes, Loom)

## Notes
- Feature flag: `workspace_filters_v2`
- Saved filter presets deferred; revisit post-beta.
- Recent files rail ships workspace-wide for launch.
- Templates ship metadata + empty directories only for now.
