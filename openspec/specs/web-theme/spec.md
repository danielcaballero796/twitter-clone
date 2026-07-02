# Web Theme Specification (Light/Dark Mode)

## Purpose

Defines the theme mechanics for `apps/web`: system-aware default, explicit toggle, persistence, and FOUC prevention. New domain — no prior spec exists. 7 scenarios total. This is BEHAVIORAL and gets TDD (see design D5).

## Requirements

### Requirement: System Preference Default
The system MUST resolve to the OS `prefers-color-scheme` when no explicit theme is stored.

#### Scenario: No stored value uses system light preference
- GIVEN `localStorage` has no `theflock:theme` key and `matchMedia('(prefers-color-scheme: dark)').matches` is `false`
- WHEN the app mounts
- THEN `document.documentElement` MUST NOT have the `dark` class
- AND the `theme-toggle` button MUST have `aria-label="Switch to dark theme"`

### Requirement: Explicit Toggle Persists Choice
Toggling the theme MUST update the DOM immediately and persist the explicit choice.

#### Scenario: Toggle to dark applies class and persists
- GIVEN the resolved theme is light
- WHEN the user activates `data-testid="theme-toggle"`
- THEN `document.documentElement` MUST gain the `dark` class
- AND `localStorage.getItem('theflock:theme')` MUST equal `'dark'`

#### Scenario: Toggle back to light removes class and persists
- GIVEN the resolved theme is dark (via prior toggle or stored value)
- WHEN the user activates `data-testid="theme-toggle"` again
- THEN `document.documentElement` MUST lose the `dark` class
- AND `localStorage.getItem('theflock:theme')` MUST equal `'light'`

### Requirement: Stored Preference Restored On Mount
An explicit stored theme MUST be applied immediately on mount, overriding system preference.

#### Scenario: Stored dark theme applied on mount
- GIVEN `localStorage.getItem('theflock:theme')` equals `'dark'`
- WHEN the app mounts
- THEN `document.documentElement` MUST have the `dark` class immediately (no flash)

### Requirement: System Mode Reacts To Live Changes
While no explicit theme is stored, the resolved theme MUST track live OS preference changes.

#### Scenario: System-mode listener flips resolved theme on OS change
- GIVEN no `theflock:theme` is stored and the app has mounted in system mode
- WHEN the `matchMedia('(prefers-color-scheme: dark)')` change listener fires with `matches: true`
- THEN `document.documentElement` MUST gain the `dark` class without any explicit `localStorage` write

### Requirement: Toggle Is Accessible
The theme toggle MUST be operable via keyboard and screen readers.

#### Scenario: Toggle exposes correct accessible name and testid
- GIVEN the app is rendered in either resolved theme
- WHEN the toggle control is queried
- THEN it MUST be a `<button>` with `data-testid="theme-toggle"`, an `aria-label` of either `"Switch to light theme"` or `"Switch to dark theme"` matching the current resolved theme, and MUST be activatable via `Enter`/`Space` (native button semantics)

### Requirement: No Flash Of Unstyled Theme (FOUC)
The resolved theme class MUST be applied before the app's stylesheets paint, without waiting for React hydration.

#### Scenario: FOUC guard script present in index.html
- GIVEN `apps/web/index.html`
- WHEN the `<head>` is inspected
- THEN it MUST contain an inline `<script>` (before any module script) that reads `localStorage.getItem('theflock:theme')` and adds the `dark` class to `document.documentElement` when the stored value is `'dark'`, or when unset and `matchMedia('(prefers-color-scheme: dark)').matches` is `true`
