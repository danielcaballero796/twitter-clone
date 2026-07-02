# Tasks: 08-ui-theme — UI/UX Polish + Light/Dark Mode

## 0. Theme infra (D1, D5 TDD) — commit: `feat(web): add theme infrastructure with useTheme hook and toggle`
- [x] 0.1 RED: stub `window.matchMedia` in `apps/web/src/test/setup.ts`; reset `localStorage` + `document.documentElement.className` in `afterEach`
- [x] 0.2 RED: `apps/web/src/features/theme/useTheme.test.tsx` — 4 cases: system-default light, toggle→dark+persist, toggle→light+persist, stored dark applied on mount. Run → failing (module doesn't exist)
- [x] 0.3 RED: `apps/web/src/features/theme/ThemeToggle.test.tsx` — aria-label matches resolved theme, `data-testid="theme-toggle"`, keyboard-operable button. Run → failing
- [x] 0.4 RED: system-mode matchMedia change-event test (dispatch `change` on the stubbed media query list, assert `dark` class toggles without a `localStorage` write). Run → failing
- [x] 0.5 GREEN: `apps/web/src/index.css` — `@custom-variant dark (&:where(.dark, .dark *));`, `@theme { --font-sans }`, base layer `color-scheme` pair per D1
- [x] 0.6 GREEN: `apps/web/src/features/theme/useTheme.ts` — `'light'|'dark'|'system'` model, localStorage key `theflock:theme`, `{ theme, resolvedTheme, toggle }`, matchMedia subscription in system mode
- [x] 0.7 GREEN: `apps/web/src/features/theme/ThemeToggle.tsx` — Sun/Moon icon button, aria-label pair, `data-testid="theme-toggle"`, 44px hit area. Run all 3 test files → green
- [x] 0.8 GREEN: `apps/web/index.html` — FOUC guard inline script (before module script, D1 exact snippet), Inter Google Fonts `<link>`, `<title>TheFlock</title>`
- [x] 0.9 REFACTOR: rerun theme tests + full web suite green

## 1. App shell (D3) — commit: `feat(web): rebuild app shell with nav, theme toggle, and icon system`
- [ ] 1.1 `apps/web/src/components/icons.tsx` — Heart, HeartSolid, Trash, Sun, Moon, MagnifyingGlass, ArrowPath SVGs (24x24, `aria-hidden`, currentColor)
- [ ] 1.2 `apps/web/src/App.tsx` — sticky translucent header (`bg-white/80 dark:bg-slate-950/80 backdrop-blur border-b`), brand link, `NavLink` Home/Explore with `aria-current="page"` active state, `<ThemeToggle />`; page container `max-w-2xl` per D2/D3
- [ ] 1.3 Verify: web suite green (App-level tests unaffected — no testid/route changes)

## 2. Tweets feature polish (D4) — commit: `feat(web): polish tweet components with icons, skeletons, and empty states`
- [ ] 2.1 `TweetCard.tsx` — replace glyphs with Heart/HeartSolid/Trash icons; preserve `data-testid="tweet-like-button"`, `aria-pressed`, `aria-label`, `data-testid="tweet-content"`; hover/ring/spacing per D4
- [ ] 2.2 `TimelineFeed.tsx` — skeleton rows replacing/augmenting `timeline-loading` (testid preserved); empty state (`timeline-empty`) adds guidance text + link to `/explore`; load-more secondary button style
- [ ] 2.3 `Composer.tsx` — surface/focus tokens, counter styling (`composer-counter` preserved, red past 280), primary submit button with spinner icon
- [ ] 2.4 If any existing test asserts a replaced glyph directly, update ONLY that assertion; document in commit body
- [ ] 2.5 Verify: `TweetCard.test.tsx`, `TimelineFeed.test.tsx`, `Composer.test.tsx` green unmodified (except documented glyph edits)

## 3. Users + auth polish (D4) — commit: `feat(web): polish auth and user discovery pages with card layouts`
- [ ] 3.1 `LoginPage.tsx`, `RegisterPage.tsx` — centered surface card (`max-w-sm mx-auto bg-white dark:bg-slate-900 border rounded-xl p-6 shadow-sm`), labeled inputs, focus rings; `role="alert"` error preserved
- [ ] 3.2 `ExplorePage.tsx`, `SearchBox.tsx` — MagnifyingGlass icon input, skeleton loading (`explore-loading` preserved), empty state (`explore-empty` preserved) with copy
- [ ] 3.3 `UserCard.tsx` — surface card, follow/following button variants, `role="alert"` preserved
- [ ] 3.4 `ProfilePage.tsx` — profile header block (avatar ring, counts row), skeleton (`profile-loading` preserved), all `profile-*` testids unchanged
- [ ] 3.5 Verify: `LoginPage`, `RegisterPage`, `ExplorePage`, `SearchBox`, `UserCard`, `ProfilePage` tests green unmodified

## 4. Final verification — commit: `chore(web): verify theme and polish against ui-ux-pro-max checklist`
- [ ] 4.1 Full `pnpm --filter @twitterclone/web test` green (50 pre-existing + theme tests)
- [ ] 4.2 ui-ux-pro-max pre-delivery checklist, both modes:
  - [ ] No emoji icons anywhere
  - [ ] `cursor-pointer` on all interactives
  - [ ] No layout-shifting hover
  - [ ] Light-mode text contrast ≥4.5:1
  - [ ] Borders visible in both modes
  - [ ] `focus-visible` states on all controls
  - [ ] `motion-safe` on animations
  - [ ] Responsive at 375/768/1024/1440px
  - [ ] No FOUC on reload in either stored mode
- [ ] 4.3 `pnpm -r typecheck`, `pnpm lint`, `pnpm format`, `pnpm build` clean
- [ ] 4.4 Confirm commit granularity matches the 5 commits above
- [ ] 4.5 Push; confirm CI green

## Scenario Coverage Checklist (16/16)
- **web-theme (7)** [B0]: system default; toggle→dark persist; toggle→light persist; stored-dark on mount; system matchMedia reactivity; toggle accessibility; FOUC guard in index.html
- **web-ui-polish (9)** [B1-B4]: nav active states [B1]; no emoji glyphs [B2/B3]; skeleton loading [B2/B3]; empty states [B2/B3]; cross-mode contrast/borders [B1-B3, verified B4]; interaction standards [B1-B3, verified B4]; auth card layout [B3]; existing tests preserved [B2/B3, verified B4.1]; responsive breakpoints [verified B4.2]

Counts: 16 scenarios across web-theme + web-ui-polish, verified by direct count against both spec files = **16**.
