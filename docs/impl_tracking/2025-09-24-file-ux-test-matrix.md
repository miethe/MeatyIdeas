# Test Matrix — Project File UX Refresh (2025-09-24)

| Area | Scenario | Desktop | Mobile | Notes |
| --- | --- | --- | --- | --- |
| File creation | Create file in root using folder picker default | ✅ | ✅ | Confirm path preview `untitled.md`, list updates without refresh |
| File creation | Select existing nested folder, ensure tags & metadata render on card | ✅ | ⬜ | Metadata list shows status/owner fields |
| File creation | Create new folder from picker and then create file inside | ✅ | ⬜ | Folder dialog closes, directories list refreshes |
| File creation | Reject filename containing `/` | ✅ | ✅ | Shows inline toast, prevents submit |
| Folder dialog | Launch from tree header and create nested folder | ✅ | ⬜ | SSE refresh repaints tree |
| Folder dialog | Launch from tree row action to add child folder | ✅ | ⬜ | Parent preselected in dialog |
| Metadata parity | Update tags/front matter via API and watch modal + cards refresh | ✅ | ⬜ | Events trigger React Query invalidation |
| Metadata parity | View metadata in modal preview (text + image) | ✅ | ⬜ | Tag chips + metadata list visible |
| Sync | Create file via modal with detail page open; verify cards update automatically | ✅ | ⬜ | No manual refresh required |
| Sync | Rename/move file and observe tree updates | ✅ | ⬜ | Path preview updates, SSE refresh |

Legend: ✅ = Pass, ❌ = Fail, ⬜ = Not Run.
