# Design: 09-profile-edit

Decisions D1–D7 are binding for tasks/apply.

## D1 — Avatar style is a plain string column with an app-level whitelist

`User.avatarStyle String @default("identicon")` (NOT NULL). No DB enum: the whitelist is enforced at the DTO boundary and adding a style later is a one-line shared-package change, not a migration. Existing rows get `identicon` via the default, so every current avatar is byte-identical after the migration.

## D2 — Single source of truth for the whitelist in `packages/shared`

```ts
export const AVATAR_STYLES = [
  'identicon', 'bottts', 'shapes', 'thumbs', 'pixel-art', 'fun-emoji',
] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
```

All six are valid DiceBear 9.x collections. The API DTO uses `@IsIn(AVATAR_STYLES)`; the web picker maps over the same array. Client and server cannot disagree.

## D3 — `avatarUrlFor(username, style)` and callers pass the stored style

`avatarUrlFor(username: string, style: string = 'identicon')` → `https://api.dicebear.com/9.x/${style}/svg?seed=<username>`. The username stays the seed — changing style never changes identity. Every select that feeds an avatar (`AUTHOR_SELECT` in tweets, summary selects in users/follows) gains `avatarStyle: true` and the mappers pass it. No call site may keep the single-arg form (grep gate in tasks).

## D4 — `PATCH /users/me` on `UsersController`, returns `PublicUser`

Same response shape as `/auth/me` so the web can `setQueryData` the session cache with the response. `me` cannot collide with `:username` GET routes (different verb; only PATCH in the controller). `UsersService.updateProfile(userId, input)` builds a partial `data` object from defined fields only — `PATCH {}` is a valid no-op returning the current user.

## D5 — `avatarStyle` exposed on `PublicUser` and `UserProfile` only

The edit form needs the current selection to prefill; session (`/auth/me`) and profile payloads carry it. `TweetAuthor`/`UserSummary` keep only `avatarUrl` — consumers there never need the raw style.

## D6 — Validation mirrors registration; empty bio clears

`displayName`: optional, 1–50 (same bounds as `RegisterDto`). `bio`: optional, max 160 (Twitter's limit), `''` normalized to `null` in the service so "clear my bio" needs no sentinel. `avatarStyle`: optional, `@IsIn(AVATAR_STYLES)`.

## D7 — Web: inline edit panel on the own profile header; pinned cache surface

No modal/portal — an inline panel toggled by an "Edit profile" button rendered exactly where the Follow button renders for others (single-column app style, keyboard-reachable, no focus-trap machinery). `useUpdateProfile` on success: `setQueryData(SESSION_QUERY_KEY, updated)` then invalidate `PROFILE_QUERY_PREFIX`, `TIMELINE_QUERY_KEY`, `USER_TWEETS_QUERY_PREFIX` — name/avatar changes reach the profile header, composer avatar, and every rendered tweet card without a reload. Picker previews are plain `<img>` DiceBear URLs seeded with the session username; radio-group semantics (`fieldset` + labeled radios) for a11y.
