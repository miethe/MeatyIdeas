# Design Tokens

Defined via CSS variables in `app/frontend/app/globals.css` and mapped in `tailwind.config.ts`.

- Colors: `--background`, `--foreground`, `--muted`, `--accent`, `--primary`, `--secondary`, `--destructive` with `-foreground` variants.
- Border/Input/Ring: `--border`, `--input`, `--ring`.
- Radius: `--radius` controls `rounded-*` scale.
- Dark mode: default `dark` via `next-themes` using `class` strategy.

Usage examples
- Background: `bg-background` / `text-foreground`
- Card: `bg-card` / `text-card-foreground`
- Button variants: `bg-primary`, `bg-secondary`, `bg-destructive`
- Focus ring: use the `focus-ring` utility class

