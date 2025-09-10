# UI Dev Guide

This frontend lives in `app/frontend` using Next.js App Router, Tailwind, Radix/shadcn-style components, and TanStack Query.

- Entry: `app/frontend/app` (`layout.tsx`, page routes)
- Providers: `components/providers.tsx` wraps `next-themes`, React Query, and `sonner` toasts.
- Design tokens: Tailwind CSS variables are defined in `app/frontend/app/globals.css` and wired in `tailwind.config.ts`.
- UI components: `components/ui/*` contains Button, Card, Dialog, Sheet, DropdownMenu, Command, Tabs, Tooltip, Badge, Separator, Toaster.
- App shell: `components/app-shell.tsx` provides header (theme toggle, search) and left rail.
- Search: `components/search-command.tsx` opens via ⌘K or `/` and queries `/api/search`.
- Projects: `app/page.tsx` shows a grid of projects; create via `ProjectCreateSheet`.
- Project catalog: `app/projects/[id]/page.tsx` lists files; open item modal; create files.
- Markdown: `components/markdown-viewer.tsx` renders server HTML and enhances Mermaid client-side.

Add a page
- Create a file in `app/.../page.tsx` and wrap contents with `<AppShell>`.
- Use UI components from `components/ui/*`.

Make a card
- Use `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`.

Add a modal
- Use `Dialog`, `DialogTrigger`, `DialogContent`, and place your form inside.

