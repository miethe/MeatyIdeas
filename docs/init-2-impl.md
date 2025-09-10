# UI Iteration Plan — “Polished, Dark, and Interactive”

## Goals (this iteration)

1. **Design system & theming:** adopt shadcn/ui (Radix under the hood) + Tailwind with **dark mode default**, smooth animations, and accessible focus states.
2. **Information architecture:** Projects → tiled **catalog** of items (files/artifacts) → **modal** to view items with attractive Markdown render (GFM, Mermaid, KaTeX, code highlight).
3. **Core interactions:** create, edit, delete **Projects**; view and (basic) add/remove **Files**; global search & quick-open.
4. **Agent-ready polish:** clean layout, keyboard-first UX (⌘K, ⌘S, N), non-blocking network state (toasts, optimistic updates), and pleasant empty/skeleton states.
5. **Keep scope aligned with existing backend & planned editor/preview and artifacts UI.**&#x20;

---

## Design system & stack choices

* **Component library:** **shadcn/ui** (Card, Dialog, Sheet, DropdownMenu, Command, Tabs, Tooltip, Separator, Badge, Toast/sonner) + **Radix primitives** for a11y.
* **Styling:** TailwindCSS; set up tokens via CSS variables (light/dark).
* **Dark mode:** next-themes, default `dark`, toggle in header; prefers-color-scheme respected.
* **Typography & icons:** Inter (system fallback), **lucide-react** icons.
* **Animations:** **Framer Motion** for subtle page/element transitions.
* **Data layer:** **TanStack Query** for fetching/caching; **Zod** schemas for API responses.
* **Markdown renderer:** MDX pipeline consistent with PRD (GFM, Mermaid, KaTeX, syntax highlighting via Shiki/Prism). Matches planned editor/preview work.&#x20;

Why this stack? It’s popular, well-documented, themeable, and maps cleanly to the PRD/editor roadmap while keeping future extensibility (graph view, backlinks, Notion/Linear, etc.).

---

## Information architecture & flows

**A. Projects Home (catalog view)**

* Left rail: Projects, filters (tags/status), New Project button.
* Main grid: **Project Cards** (title, tags, last updated, file count). Click → Project Catalog.
* Header: global search (⌘K), dark-mode toggle, profile/token settings.

**B. Project Catalog (tiled items)**

* Sticky header: Project name, status pill, actions: **New Item**, **Import**, **Artifacts**.
* **Tiles**: Files rendered as **Cards** (front matter summary, badges: `PRD`, `Idea`, etc.).
* Sort & filter (tag, updated, type).
* Click a tile → **Modal Viewer** with full attractive Markdown render (Mermaid/KaTeX/code highlight, callouts, ToC sidebar).

**C. Modal Viewer (item detail)**

* Title + metadata (tags/status/path).
* Read mode with ToC and “Open in editor” CTA (editor itself is next phase per backend plan; for this iteration we keep read-only modal while enabling CRUD via side actions).
* Footer actions: Duplicate, Export to Bundle (stub), Delete (confirm).

**D. Create/Edit flows**

* **Project Drawer** (Sheet) for create/edit; fields: name, description, tags, status, color/emoji.
* **File Add** (for now): “New Markdown File” dialog → title + path + tags → content textarea (basic)—or paste-in to create. Editor/Preview comes in the next iteration aligned with Phase 3.&#x20;

**E. Search & Quick actions**

* ⌘K palette (shadcn **Command**): search projects/files via `/search` API; open items or **“New Project”**/**“New File”** actions.
* Inline filters and recent items.

---

## Screens & components

**Top-level pages**

* `/` Projects Home (grid + create)
* `/projects/[slug]` Project Catalog (tiles + filters + modal)
* Modal routes for item view (Next.js App Router parallel routes)

**Key components**

* `AppShell` (header, rail, content, toasts)
* `ProjectCard`, `ProjectCreateSheet`, `ProjectActionsDropdown`
* `ItemTile` (file/artifact card), `ItemModalViewer` (MDX renderer + ToC + actions)
* `MarkdownViewer` (MDX + Mermaid + KaTeX + code highlight)
* `SearchCommand` (⌘K palette with debounce + TanStack Query)
* `EmptyState`, `SkeletonGrid`, `ConfirmDialog`, `Toast` hooks
* `TagBadge`, `StatusPill`, `UserTokenMenu` (X-Token management)

---

## API wiring (MVP UI scope)

Use existing endpoints from MVP: Projects, Files, Search, Artifacts, Bundles. We’ll focus this iteration on **Projects+Files+Search**; show Artifacts status as a read-only card with a CTA for next phase. Current API coverage & auth are in place.&#x20;

* List Projects: `GET /api/projects`
* Create/Update/Delete Project: `POST/PUT/DELETE /api/projects/:id`
* List Files in Project: `GET /api/projects/:id/files`
* Create Basic File: `POST /api/projects/:id/files` (content optional for now)
* Delete File: `DELETE /api/files/:id`
* Search: `GET /api/search?q=...&project_id=...` (hooks up to ⌘K).&#x20;

---

## Accessibility & performance

* Radix + shadcn guarantees baseline a11y; verify focus order, ARIA roles, color contrast.
* Skeletons for grid and modal; optimistic create/delete with rollback.
* Lazy load Mermaid/KaTeX; cache rendered HTML (already modeled server-side).

---

## Telemetry & UX feedback

* Emit frontend spans: `ui.load.projects`, `ui.click.project`, `ui.open.item_modal`, `ui.create.project`, `ui.create.file`, `ui.delete.file`.
* Hook into OTel stub so your Grafana stack sees user-perceived latency.

---

## Third-party integrations in UI (thin, pragmatic)

* **shadcn/ui** scaffold (generator) + theme tokens for dark.
* **react-hotkeys-hook** for ⌘K, ⌘S, N.
* **sonner** for toasts (shadcn compatible).
* **react-use-measure** for layout stability during animations.

These keep footprint small and are easy to extend.

---

## Work breakdown (stories & acceptance)

### Sprint 1 — **Design System & Shell**

1. **DS-01**: Install shadcn/ui, Tailwind, next-themes; add dark theme tokens.
   **Done when**: app defaults to dark; toggle persists; base typography set.
2. **DS-02**: App shell (Header, Left Rail, Content), lucide icons, framer motion page transitions.
   **Done when**: nav animates; focus states visible; responsive at 1280/1024/768.
3. **DS-03**: ⌘K Command palette wired to `/search`.
   **Done when**: typing shows results; Enter opens item/project; **N** creates new.

### Sprint 2 — **Projects Catalog**

4. **PRJ-UI-01**: Projects grid with **ProjectCard** (tags/status/updated).
   **Done when**: grid loads via TanStack Query; empty state & skeletons implemented.
   Grounding: current list exists but unstyled—this applies layout, cards, and affordances.&#x20;
5. **PRJ-UI-02**: **ProjectCreateSheet** (name, description, tags, status).
   **Done when**: POST succeeds; optimistic add with toast; validation errors inline.
6. **PRJ-UI-03**: Project actions (edit, archive/delete) via dropdown.
   **Done when**: PUT/DELETE; confirmation modal; rollback on failure.

### Sprint 3 — **Project Catalog Items & Modal**

7. **ITEM-UI-01**: Project Catalog page with **ItemTile** grid (files).
   **Done when**: GET files renders cards with badges; filters by tag; search within project.
8. **ITEM-UI-02**: **ItemModalViewer** with **MarkdownViewer** (MDX + Mermaid + KaTeX + Shiki).
   **Done when**: clicking a tile opens modal; ToC visible; long docs scroll smoothly; malformed Mermaid falls back to code block (no crash).
   Grounding: renderer/preview is planned; this provides read-only viewer now, paving the way for Editor next.&#x20;
9. **ITEM-UI-03**: **File Create/Delete** UX.
   **Done when**: New File dialog creates minimal Markdown doc; Delete prompts confirm; list updates optimistically.

### Sprint 4 — **Polish & Integrations (UI-side)**

10. **UX-01**: Toasts, skeletons, and empty states across flows; error boundaries with retry.
11. **UX-02**: Keyboard shortcuts (⌘S save draft for future editor, N new file, / focus search).
12. **INT-01**: Artifacts panel (read-only) card with provider/branch/status from existing endpoint; CTA “Connect repo” routes to stub. (Write flows come with Phase 4 in the backend plan.)&#x20;
13. **EXP-01**: Export button in Project header opens a placeholder modal describing bundle export; hits the bundle endpoint with a fixed selection for now, to prove the path (optional toggle).

---

## Acceptance criteria matrix (UI scope)

| Capability                 | Criteria                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Dark mode                  | Default dark; toggle in header; persists; WCAG AA contrast verified on Cards, Dialogs, Badges.                                             |
| Projects grid              | Cards show title, tags, status, last updated; 3 breakpoints; skeleton while loading; empty state.                                          |
| Create/Edit/Delete Project | Sheet form validates; success toast; list updates optimistically; delete confirm.                                                          |
| Project Catalog (tiles)    | Files appear as cards with badges; filter chip bar; search field; paging infinite or “Load more.”                                          |
| Item modal render          | Markdown shows headings, tables, code with highlighting; Mermaid and KaTeX render; fallback on error; ToC anchors; close with Esc/overlay. |
| New/Delete File            | Dialog creates file; toast + grid update; delete confirm + optimistic removal with rollback on failure.                                    |
| Search (⌘K)                | Fuzzy results across projects/files; keyboard navigation; open with Enter; no-results state.                                               |
| Performance                | First catalog render ≤ 200 ms after data arrives; modal open ≤ 100 ms to first paint; Mermaid/KaTeX lazy.                                  |
| A11y                       | Keyboard reachable, focus-visible, ARIA labels for dialogs/cards; screen reader announcements on open/close.                               |

---

## Risks & mitigations

* **Render plugin weight** (Mermaid/KaTeX): lazy-load modules; precompute `rendered_html` server-side (already modeled) to reduce client work.
* **Modal overflow & long docs**: virtualized ToC, content max-width, sticky header, smooth scroll.
* **Optimistic updates vs server truth**: use TanStack Query invalidations; surface conflicts via toast + inline.

---

## Definition of Done (for this iteration)

* New shadcn-based theme with dark mode default; shell complete.
* Projects grid and Project Catalog with interactive tiles & modal viewer.
* CRUD for Projects + basic File add/delete.
* Markdown modal renderer (GFM/Mermaid/KaTeX/Code highlight) with graceful degradation.
* Command palette search wired to `/search`.&#x20;
* Telemetry hooks for key UI actions; toasts, skeletons, error boundaries.
* Docs: short **UI Dev Guide** (how to add a page, make a card, add a modal), **Design Tokens** reference, and **Keyboard Shortcuts**.

---

## Implementation notes (concrete)

* **Install shadcn/ui** and generate: `Button, Card, Dialog, Sheet, DropdownMenu, Command, Tabs, Tooltip, Badge, Separator, Toast`.
* **Tailwind config**: extend color palette, container max widths, motion-safe transitions.
* **next-themes**: `class` strategy; `<html className={cn("dark", ...)}>` fallback.
* **TanStack Query**: central `apiClient` with `X-Token` header; retry policy off for `4xx`.
* **MarkdownViewer**: MDX + remark/rehype set; dynamic import of Mermaid/KaTeX; Shiki for code.
* **Routes**: modal routes in App Router (intercepting routes) to enable deep links to items.

---

## Suggested sequencing (2–3 weeks)

* **Week 1:** DS-01..03, PRJ-UI-01..02
* **Week 2:** PRJ-UI-03, ITEM-UI-01..02
* **Week 3:** ITEM-UI-03, UX-01..02, INT-01, EXP-01, harden a11y/perf

---

## What this unlocks next

This establishes the visual + interaction baseline so the upcoming **Editor & Preview** and **Artifacts Panel & Export** can drop in seamlessly, per the original phased plan.  It also sets the stage for graph/backlinks, vector search, and richer imports without reworking the shell.

---

**Grounding references from the current implementation report:** MVP frontend is basic (Projects list + file stub) with Editor/Preview and Artifacts/Export planned next; API, search, bundles, and auth are implemented.&#x20;
