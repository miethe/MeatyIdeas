---
title: "MeatyProjects — Dashboard Views & Project Cards PRD"
version: 1.0
status: Draft
date: 2025-09-19
owner: Growth & Experience Pod (PM: TBD, Design Lead: TBD)
---

## 1) Purpose & Vision

Transform the dashboard into a command center where builders can scan, sort, and prioritize work at a glance. Rich project cards, contextual views, and inline filters should reduce navigation churn, lift engagement, and set the foundation for future personalized surfaces.

## 2) Background & Problems Today

- Dashboard currently presents a uniform list with minimal metadata, forcing users to open each project to gauge relevance.
- There is no quick way to pivot between "Starred", "Recent", or "By Tag" views without manual filtering.
- Cards lack visual hierarchy and consistent information density across screen sizes.
- The UI does not track interactions, limiting our ability to tune layout and content density.

## 3) Goals & Non-Goals

In scope
- Left-rail Views (All, Starred, Recently Updated, By Tag, Archived) with persistent selection.
- Filter Bar across top of grid with tag, language, owner, and updated filters.
- Project card variants (Compact, Standard, Rich) responsive to layout density with consistent design tokens.
- Telemetry pipeline capturing card impressions, clicks, hover, and quick actions.

Out of scope
- Advanced personalization or recommendations and ML-based ordering.
- Bulk inline editing of project metadata.
- Kanban or timeline views (prepare API support but not UI).
- Mobile-only redesign (ensure responsive behavior but desktop-first).

## 4) Target Users & JTBD

- **Builder / Owner**: "Show me my most relevant projects first and let me pivot by tag or recency." Needs star view, recent view, density control.
- **Reviewer / Manager**: "I need to monitor progress across squads quickly." Needs rich cards with stats and a consistent layout.
- **New Contributor**: "I’m browsing portfolio to find onboarding candidates." Needs tag-based views and descriptive cards.

## 5) Success Metrics

- ≥ 60% of sessions use at least one view or filter within 2 weeks of launch.
- Increase project card clickthrough to ProjectDetail Modal by 25% vs baseline.
- Maintain dashboard time-to-interactive ≤ 1.5s and grid render ≤ 100 ms for 100 cards.
- User satisfaction (post-launch pulse) improvement ≥ +0.5 on 5-point Likert for "Dashboard helps me find the right project".
- Error rate for `GET /projects` view API ≤ 0.5%.

## 6) Experience Overview

### 6.1 Views Rail
- Persistent left rail showing available views; active view highlighted with icon and color token.
- "By Tag" expands accordion listing top tags (limit 10 + "View all" to open search modal).
- Selecting view updates grid immediately and records analytics event.

### 6.2 Filter Bar
- Horizontal bar above grid with chips/dropdowns for Tags (multi-select with suggestions), Language (multi), Updated (presets: 7d/30d/90d/custom), Owner (me/all/specific).
- Chips display selections and support inline removal.
- Reset button clears all filters and returns to `All` view.
- Filter state encoded in URL parameters for shareable links.

### 6.3 Project Cards
- **Compact**: restful list or grid with essential info (name, tags, updated, star). Ideal for dense view or narrow layout.
- **Standard**: default; includes 1–2 line description, tags, file count, language bar, star, updated.
- **Rich**: adds owner avatars, highlight snippet (e.g., README line), activity sparkline. Shown when screen width allows or user selects "Rich" density.
- Cards share core tokens: border radius, spacing, tag pill styles, iconography.
- Hover reveals quick actions: Star toggle, Quick peek (opens ProjectDetail Modal), Quick open (new tab).
- Support skeleton placeholders while loading or when filters change.

### 6.4 Density & Layout Controls
- Toggle between Compact/Standard/Rich via segmented control; selection persisted per user.
- Responsive behavior: column count adjusts per breakpoint; ensures readability by capping max width for text.

### 6.5 Empty & Error States
- When filters yield no results, show helpful illustration, copy, and CTA to reset or open search.
- Error retrieving cards shows toast plus inline retry button.

## 7) Functional Requirements

### 7.1 API & Data Contracts
1. Extend `GET /api/projects` to accept parameters: `view`, `tags[]`, `language[]`, `owner`, `updated_after`, `sort`, `limit`, `cursor`.
2. Response includes: `projects[]` with `id`, `name`, `slug`, `description`, `tags[]` (with color), `updated_at`, `file_count`, `language_mix`, `owners`, `starred`, `highlight` (optional), `activity_sparkline` (array), `status`.
3. Provide `meta` with totals, pagination, applied filters.
4. Honor permissions and omit archived projects unless `view=archived`.

### 7.2 Views Logic
1. `All`: default sort by `-updated_at`.
2. `Starred`: filter `starred=true` and maintain user-specific ordering/sticky.
3. `Recently Updated`: projects updated within last 30 days; default sort by `-updated_at`.
4. `By Tag`: selecting tag from rail sets filter plus view state.
5. `Archived`: lists archived projects with subdued styling; hide quick actions except unarchive.

### 7.3 UI Behavior
1. View change or filter update triggers optimistic UI state (skeleton) while fetching.
2. Cards animate smoothly when resorting; maintain focus order for keyboard navigation.
3. Tag pills clickable to add filter; `Cmd+Click` opens Search Modal seeded with tag.
4. Density toggle changes card component variant and ensures accessible hit targets.
5. Star/Unstar updates state optimistically and reconciles on API response.

### 7.4 Telemetry & Analytics
1. Events: `dashboard_view_changed`, `dashboard_filter_applied`, `project_card_impression`, `project_card_hover`, `project_card_clicked`, `project_card_starred`.
2. Include metadata: view, filters, card variant, screen size bucket, position index.
3. Collect performance metrics: grid render time, API latency.

### 7.5 Accessibility
1. Views rail accessible via keyboard with `Tab` and arrow navigation.
2. Cards expose accessible names describing key metadata (title, tags, updated) for screen readers.
3. Ensure color contrast for tags and view indicators meets WCAG AA.

## 8) System & Architecture Requirements

- Extend project service to aggregate stats (language distribution, file count, highlight snippet) in a single query.
- Introduce caching or denormalized view to avoid N+1 queries for tags and owners.
- Provide telemetry pipeline (OpenTelemetry) instrumentation capturing API and UI events.
- Persist user preferences (density) in profile settings or local storage with fallback.
- Support pagination/infinite scroll for large project lists; maintain consistent card height per variant.

## 9) Data Model Considerations

- Leverage normalized tags (from search project) and ensure `project_tags` sync.
- Add optional `project_highlights` materialized view or computed field containing README snippet or notable callout.
- Track project star relationships per user (existing or new table) to feed starred view.
- Ensure archived status persists and surfaces in API payload.

## 10) Dependencies & Integration Points

- Depends on Search & Filtering PRD for normalized tags and filter APIs.
- Requires ProjectDetail Modal for "Quick peek" action to work seamlessly.
- Design system updates for cards, rail, filter bar, density toggle.
- Backend coordination for new aggregated API payload.
- QA for regression testing across breakpoints and dataset sizes.

## 11) Rollout Plan

1. Ship backend API with `DASHBOARD_V2` flag returning new payload while old UI still consumes minimal fields.
2. Incrementally release UI behind same flag; start with internal cohorts (design/product team) and collect feedback.
3. Enable telemetry dashboards to monitor engagement and performance before broad rollout.
4. Provide fallback link to legacy list view for one release cycle.
5. Post-launch, evaluate additional views (Pinned, Shared with me) and personalization experiments.

## 12) Acceptance Criteria

- Views rail updates grid and URL parameters correctly; deep links restore state.
- Filter bar interactions feel responsive (≤ 150 ms perceived update) and reflect on cards.
- Cards render correct variant per density toggle; hover quick actions function with optimistic updates.
- API returns aggregated data without N+1; load tests confirm p95 latency ≤ 250 ms for 100 card response.
- Telemetry events captured and visible in monitoring dashboard.

## 13) Open Questions

1. Do we allow users to reorder views or customize the rail? (Future; not in MVP.)
2. Should density preference sync across devices (server-side) or remain local? (Recommendation: store in user profile when available.)
3. How aggressively do we cache card data vs. fetch fresh on each filter change? (Evaluate stale-while-revalidate approach.)
4. Should archived projects be hidden from global search by default? (Coordinate with Search PRD to decide.)

## 14) Risks & Mitigations

- **Performance degradation** from rich payloads: mitigate with selective fields and caching.
- **Visual clutter**: adhere to design tokens, maintain spacing, and ensure default Standard density remains balanced.
- **Mismatch between filters and cards**: centralize state management via React Query/Zustand store and ensure single source of truth.
- **Telemetry noise**: sample events if necessary and aggregate to avoid overwhelming pipeline.

## 15) Definition of Done

- Dashboard views and cards released to all users with feature flag on, meeting performance targets.
- Updated user onboarding and help center content explaining new views and filters.
- Telemetry dashboards in place; support runbook updated.
- Positive feedback from pilot cohort and no critical accessibility issues outstanding.
