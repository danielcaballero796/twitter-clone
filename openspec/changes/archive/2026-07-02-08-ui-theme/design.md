# Design: 08-ui-theme — UI/UX Polish + Light/Dark Mode

Design direction generated with ui-ux-pro-max (style: modern minimalism + dark mode; typography: Inter; UX rules: accessibility CRITICAL, touch CRITICAL, loading/empty states HIGH). Anti-patterns explicitly banned: emoji-as-icons, layout-shifting hovers, invisible borders in light mode, pure-black dark surfaces with neon glow.

## Binding decisions

### D1 — Theme mechanics (Tailwind v4, class strategy)

- `apps/web/src/index.css`:
  ```css
  @import 'tailwindcss';
  @custom-variant dark (&:where(.dark, .dark *));
  @theme {
    --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  }
  ```
  plus base layer: `html { color-scheme: light }`, `html.dark { color-scheme: dark }`, body background/text pair.
- Theme state model: `'light' | 'dark' | 'system'`. localStorage key `theflock:theme` stores ONLY explicit `'light'`/`'dark'`; absence means system. Applying = toggle `dark` class on `document.documentElement`.
- `apps/web/src/features/theme/useTheme.ts`: returns `{ theme, resolvedTheme, toggle }`. `toggle` flips resolved light↔dark and persists. In system mode, subscribes to `matchMedia('(prefers-color-scheme: dark)')` changes.
- `apps/web/src/features/theme/ThemeToggle.tsx`: icon button in header — sun SVG shown in dark mode, moon in light; `aria-label="Switch to light theme"` / `"Switch to dark theme"`; `data-testid="theme-toggle"`; min 44px hit area.
- FOUC guard in `apps/web/index.html` `<head>`, before the module script:
  ```html
  <script>
    (function () {
      var t = localStorage.getItem('theflock:theme');
      if (t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches))
        document.documentElement.classList.add('dark');
    })();
  </script>
  ```
- Test setup: stub `window.matchMedia` in `apps/web/src/test/setup.ts` (jsdom lacks it); reset localStorage + html class between tests.

### D2 — Design tokens (used as utility pairs, defined once here)

| Role | Light | Dark |
|------|-------|------|
| Page background | `bg-slate-50` | `dark:bg-slate-950` |
| Surface (cards, header) | `bg-white` | `dark:bg-slate-900` |
| Border/divider | `border-slate-200` | `dark:border-slate-800` |
| Text primary | `text-slate-900` | `dark:text-slate-100` |
| Text muted | `text-slate-600` | `dark:text-slate-400` (never lighter than 600 in light mode) |
| Primary accent (links, active nav, primary buttons) | `indigo-600` (hover 700) | `dark:indigo-400` (hover 300) |
| Like accent | `rose-600` | `dark:rose-400` |
| Danger | `red-600` | `dark:red-400` |
| Focus ring | `focus-visible:ring-2 ring-indigo-500 ring-offset-2` | `dark:ring-offset-slate-950` |

- Typography: Inter via Google Fonts `<link>` in index.html (weights 400/500/600/700, `display=swap`) + `--font-sans` fallback stack. Body text 15–16px (`text-[15px]` tweets), line-height ≥1.5.
- Header: sticky top-0, `bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b` (80% opacity minimum per checklist — never /10 glass in light mode).
- Transitions: `transition-colors duration-200` standard; `motion-safe:animate-pulse` for skeletons; no scale-on-hover that shifts layout.

### D3 — App shell (`App.tsx`)

- Header content, `max-w-2xl mx-auto` aligned with main: brand link "TheFlock" (font-bold, indigo accent) → `/`; nav `NavLink`s Home + Explore with active state (`aria-current="page"` styling: text-indigo + font-medium; inactive: muted with hover); `ThemeToggle` at the right.
- `<title>` in index.html → "TheFlock". Keep `APP_NAME` import as brand text source.
- Main stays `max-w-2xl px-4 py-6`. Mobile-first; nav labels visible at all breakpoints (2 links fit fine at 375px).

### D4 — Component polish (visual-only; PRESERVE all data-testid, roles, aria-* names, user-facing strings that tests assert)

- **Icons**: inline SVG components in `apps/web/src/components/icons.tsx` (single file, Heroicons-outline 24×24 paths, `w-5 h-5`, `aria-hidden`, `fill`/`stroke` currentColor): Heart, HeartSolid, Trash, Sun, Moon, MagnifyingGlass, ArrowPath (spinner). Replaces ♥/♡/✕ glyphs. Like button keeps `aria-pressed`, `aria-label`, `data-testid="tweet-like-button"`, visible count.
- **TweetCard**: article gets `px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors`; avatar `ring-1 ring-slate-200 dark:ring-slate-800`; delete button Trash icon with 44px hit area, `text-slate-400 hover:text-red-600 dark:hover:text-red-400`; like button heart SVG (solid+rose when liked), count `tabular-nums`.
- **TimelineFeed**: list container becomes a bordered surface card (`divide-y` tokens); loading → 3 skeleton rows (`motion-safe:animate-pulse` avatar circle + two text bars — reserve space, no jump); empty → icon + "No tweets yet" + hint to follow people (link to /explore); load-more → secondary button style.
- **Composer**: textarea with surface tokens + focus ring, char counter `{n}/280` (muted, turns red-600 past limit), submit = primary button (`bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50`, spinner icon while pending).
- **Login/Register**: centered card (`max-w-sm mx-auto bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-sm`), inputs with visible labels + focus rings, primary submit button, error text `role="alert"` styling kept.
- **Explore/SearchBox/UserCard**: search input with MagnifyingGlass icon, results as surface cards; follow button primary variant / following = secondary outline; loading + "no users found" states.
- **ProfilePage**: profile header block (larger avatar with ring, displayName, @username, bio, counts row `font-semibold` numbers + muted labels), follow button as in UserCard, tweets in same surface-card list, skeleton while loading.
- Buttons everywhere: `cursor-pointer`, focus-visible ring pair, min `h-9`+ desktop / comfortable ≥44px touch on primary actions.

### D5 — Testing (strict TDD scope: new BEHAVIOR only)

- RED-first: `features/theme/useTheme.test.tsx` + `ThemeToggle.test.tsx` — (1) no stored value + system light → html lacks `dark`, toggle aria-label says "Switch to dark theme"; (2) toggle click → html gains `dark`, localStorage `theflock:theme='dark'`; (3) stored `dark` on mount → class applied immediately; (4) toggle back → class removed, stored `light`; (5) system mode reacts to matchMedia change event.
- Class-only component changes get NO new tests (visual, not behavioral) — the gate is the existing 50 tests staying green unchanged.
- If any existing test asserts a replaced glyph (♥/✕), keep the accessible name identical and update ONLY the glyph assertion — document each such edit in the commit body.

## Non-goals

- No dropdown for 3-way theme select (toggle flips light/dark; system remains the default until first explicit choice).
- No new npm dependencies. No icon library package — inline SVGs.
- No E2E/visual-regression tooling in this change.

## Verification extras (Block final)

- ui-ux-pro-max pre-delivery checklist walked item by item against both modes (documented in tasks.md as checkboxes).
- Manual: `pnpm --filter @twitterclone/web dev` + seeded API — check both themes on /, /explore, /u/ada, login, register; reload persistence; no FOUC.
