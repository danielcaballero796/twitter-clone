# Web UI Polish Specification

## Purpose

Defines the structural/visual polish contract for `apps/web`: app shell navigation, icon system, loading/empty states, cross-mode contrast, and interaction standards. New domain — no prior spec exists. 9 scenarios total. This is STRUCTURAL — verified by inspection and by the existing 50 web tests staying green, not by new unit tests (per design D5).

## Requirements

### Requirement: App Shell Navigation With Active States
The app shell MUST present a persistent header with brand, primary navigation, and the theme toggle, and MUST indicate the active route.

#### Scenario: Nav links reflect current route
- GIVEN the app shell is rendered on any authenticated route
- WHEN the current route matches a nav link's target (`/` or `/explore`)
- THEN that link MUST expose `aria-current="page"` and MUST be visually distinguished from inactive links

### Requirement: No Emoji Glyphs As Icons
All iconography MUST be inline SVG, not emoji or text glyphs, while preserving existing accessible names.

#### Scenario: Icon-bearing controls use SVG, not glyphs
- GIVEN any control that previously rendered a glyph (e.g. `♥`, `♡`, `✕`) as its icon
- WHEN the control is inspected
- THEN its icon MUST be an inline `<svg aria-hidden="true">` element
- AND the control's `aria-label`, `data-testid`, and `aria-pressed` (where applicable) MUST be unchanged from before this change

### Requirement: Skeleton Loading States
Async-loading views MUST show non-shifting skeleton placeholders instead of bare loading text alone.

#### Scenario: Timeline, explore, and profile show skeletons while loading
- GIVEN the timeline, explore, or profile view is in its loading state
- WHEN the view is rendered
- THEN it MUST render skeleton placeholder elements sized to reserve the final content's layout space, using `motion-safe:animate-pulse`
- AND the existing loading `data-testid` (`timeline-loading`, `explore-loading`, `profile-loading`) MUST still be present

### Requirement: Empty States With Guidance
Views with no data MUST show explanatory copy and, where applicable, a next-action link.

#### Scenario: Empty timeline guides the user to Explore
- GIVEN the authenticated user's timeline has zero tweets
- WHEN the empty state (`data-testid="timeline-empty"`) is rendered
- THEN it MUST include text explaining there are no tweets yet and a link/action pointing to `/explore`

### Requirement: Cross-Mode Contrast And Border Visibility
Every surface MUST use the token pairs defined in design D2 so text and borders are visible in both light and dark mode.

#### Scenario: Bordered surfaces are visible in both themes
- GIVEN any card, header, or divider element styled per D2
- WHEN inspected in light mode and again with the `dark` class applied
- THEN the element's border/divider utility MUST resolve to a non-transparent, visibly-contrasting color in both modes (`border-slate-200` light / `dark:border-slate-800` dark, or the documented equivalent pair)

### Requirement: Interaction Standards On Interactive Elements
All clickable/focusable controls MUST meet baseline interaction affordances.

#### Scenario: Buttons and links expose pointer, focus, and touch affordances
- GIVEN any button or link rendered in the app
- WHEN inspected
- THEN it MUST carry `cursor-pointer`, a `focus-visible` ring utility, a `transition-colors` duration between 150ms and 300ms, and — for primary/touch targets — a minimum 44px hit area
- AND hovering it MUST NOT change its layout box (no hover-triggered reflow)

### Requirement: Auth Pages Use Card Layout
Login and Register pages MUST present their forms inside a centered, bordered card matching D2 surface tokens.

#### Scenario: Login and Register render a centered surface card
- GIVEN the `/login` or `/register` route is rendered
- WHEN the form container is inspected
- THEN it MUST be a centered, max-width, bordered, rounded surface card using the D2 light/dark surface token pair
- AND the existing `role="alert"` error element MUST remain present and unchanged in behavior

### Requirement: Existing Test Contracts Preserved
Visual polish MUST NOT alter any pre-existing behavioral contract asserted by the current test suite.

#### Scenario: All pre-existing web tests pass unmodified
- GIVEN the 50 web tests existing before this change
- WHEN the full `apps/web` test suite is run after polish is applied
- THEN all 50 MUST still pass without modification, EXCEPT tests that assert a replaced emoji glyph directly, which MAY have ONLY the glyph assertion updated (accessible name/testid must stay identical), each such edit documented in its commit body

### Requirement: Responsive Mobile-First Layout
The app shell and polished components MUST remain usable across mobile, tablet, and desktop viewport widths.

#### Scenario: Layout holds at common breakpoints
- GIVEN the app shell and its nav are rendered at viewport widths 375px, 768px, 1024px, and 1440px
- WHEN each width is inspected
- THEN no horizontal overflow, overlapping nav items, or hidden critical controls (brand, nav links, theme toggle) MUST occur at any of the four widths
