# Proposal: 08-ui-theme — UI/UX Polish + Light/Dark Mode

## Intent

Take the web app from "functional skeleton" to a polished, cohesive product: a real app shell with navigation, a design language (modern minimalism, Inter, indigo accent), light/dark mode with a toggle (system-aware, persisted, no flash), and component-level UX upgrades — SVG icons instead of emoji glyphs, skeleton loading states, empty states, proper focus/hover/touch affordances. All existing behavior, tests, and accessibility contracts preserved.

## Rubric mapping

Calidad (20): design system + a11y checklist (contrast 4.5:1 both modes, focus-visible, 44px touch targets). Funcionalidad (25): theme toggle is a new user-facing feature. Testing (25): TDD on theme behavior; all 50 existing web tests stay green. Proceso (15): granular commits, ui-ux-pro-max checklist as verification gate.

## Scope

### In Scope
- **Theme infrastructure** (Tailwind v4 CSS-first): class-based `dark` variant via `@custom-variant`, brand tokens in `@theme`, `color-scheme` property; `features/theme/` with `useTheme` hook + `ThemeToggle` (sun/moon SVG, aria-labelled); persisted to localStorage, defaults to `prefers-color-scheme`, reacts to system changes in system mode; FOUC guard inline script in `index.html`.
- **App shell**: sticky translucent header (backdrop-blur) with brand, nav (Home / Explore) with active states via `NavLink`, theme toggle; consistent page container.
- **Design language**: Inter (Google Fonts + system fallback), indigo primary accent, slate surfaces (light: white/slate-50; dark: slate-950/900 — not pure black), rose like-accent, consistent border/muted-text tokens in both modes.
- **Component polish** (visual only — DOM contracts preserved): TweetCard (heart/trash SVG icons, avatar fallback ring, hover surface, spacing), Composer (char counter, primary button, focus rings), TimelineFeed (skeleton loaders, empty state with CTA, load-more button), Login/Register (card layout, labeled inputs, error styling), Explore/SearchBox/UserCard (input polish, follow button variants, empty/loading states), ProfilePage (profile header block, counts, skeletons).
- **Interaction standards** everywhere: `cursor-pointer`, `focus-visible` rings, `transition-colors` 150–300ms, ≥44px touch targets on mobile, `motion-safe` animations, no layout-shifting hovers.
- **Tests**: TDD for theme behavior (default/system, toggle flips class on `<html>`, persistence, restore); keep all existing suites green.

### Out of Scope
- Component libraries or new runtime deps (no shadcn/MUI; SVGs inline, Heroicons-style paths).
- Rebranding/logo work, marketing/landing pages.
- New product features (replies, notifications) — visual layer only, plus the theme toggle.
- API/backend — this change is 100% `apps/web` + `index.html`.

## Approach

Tailwind v4 CSS-first theming: one `@custom-variant dark` line makes `dark:` class-driven; tokens live in `@theme`; components use semantic utility pairs (`bg-white dark:bg-slate-900`). Theme state is a tiny hook (no context needed app-wide — the class on `<html>` IS the global state; hook only owns toggle/persistence). Every component edit is class-level: `data-testid`, roles, aria attributes and text content stay byte-identical where tests depend on them. ui-ux-pro-max pre-delivery checklist runs as an explicit verification task.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/index.css` | Modified | dark variant, @theme tokens, Inter stack, base styles |
| `apps/web/index.html` | Modified | FOUC guard script, Inter link, title "TheFlock" |
| `apps/web/src/features/theme/**` | New | useTheme + ThemeToggle + tests |
| `apps/web/src/App.tsx` | Modified | app shell: header, nav, toggle, containers |
| `apps/web/src/features/{auth,tweets,users}/*.tsx` | Modified | class-level polish, SVG icons, skeletons, empty states |
| `apps/web/src/test/**` | Modified | only if fixtures/harness need theme plumbing |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Class churn breaks existing tests that assert markup | Med | Tests assert roles/labels/testids, not classes; run full suite per block; never rename testids/aria |
| Dark-mode contrast failures (invisible borders, dim text) | Med | Token pairs defined once in design; checklist verifies 4.5:1 + border visibility in both modes |
| FOUC / theme flash on load | Med | Inline pre-hydration script in index.html; manual verify in Block final |
| jsdom lacks matchMedia for theme tests | High (known) | Stub matchMedia in test setup (standard pattern) |

## Rollback Plan

Pure frontend change, no schema/API. Revert the web commits; app returns to current look with zero data impact.

## Dependencies

- Changes 02–07 shipped (all UI surfaces exist; seed makes polish visible in demo).
- Tailwind v4 already wired via `@tailwindcss/vite`.

## Success Criteria

- [ ] Theme toggle: defaults to system preference, persists across reloads, no flash, `color-scheme` correct, works on every page.
- [ ] Both modes pass the ui-ux-pro-max checklist: contrast ≥4.5:1, visible borders/focus rings, no emoji icons, cursor-pointer on interactives, 44px touch targets, motion-safe.
- [ ] Skeleton loading + empty states on timeline, explore and profile.
- [ ] All web tests green (existing 50 + new theme tests); typecheck/lint/format/build clean; CI green.
