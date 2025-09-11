# ADR-001: PRD Source of Truth

- Status: Accepted
- Date: 2025-09-11

## Context

The execution plan references `./docs/PRD.md` as the single PRD path. The repository does not contain that file, but includes:

- `docs/project_plans/PRDs/init-prd.md` (MVP PRD)
- `docs/project_plans/PRDs/enhancement-9-11.md` (iteration scope)

## Decision

Use `docs/project_plans/PRDs/init-prd.md` as the primary PRD and include `docs/project_plans/PRDs/enhancement-9-11.md` as the current iteration addendum. Create an aggregator at `docs/PRD.md` that references both.

## Consequences

- Planning artifacts (roadmap, traceability) will be generated from these sources.
- Where details are silent, apply the canonical architecture and defaults provided in the project prompt.

