# Performance Spot-Checks — Project File UX Refresh (2025-09-24)

| Metric | Baseline | Post-change | Notes |
| --- | --- | --- | --- |
| `/api/projects/{id}/files` (200 files) | 165 ms p95 | 172 ms p95 | Serializer now returns metadata fields; caching still acceptable |
| SSE reconnect latency | ~150 ms | ~150 ms | No regression; debounce keeps refresh coalesced |
| File card render (React profiler) | 6.2 ms avg | 7.1 ms avg | Metadata list adds ~0.9 ms; within budget |
| New file dialog open time | 14 ms | 16 ms | Folder query cached (30s); combobox render stable |

Actions: continue monitoring `file_sync_refresh` telemetry for burst invalidations. No hot paths exceeded thresholds.
