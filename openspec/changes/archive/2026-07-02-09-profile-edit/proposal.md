# Proposal: 09-profile-edit — Edit Profile (name, bio, avatar style)

## Intent

Let a user edit their own profile: display name, bio, and avatar. Avatars today are deterministic DiceBear identicons seeded by username with nothing stored in the DB, so "editable avatar" is delivered as a **selectable style from a fixed whitelist** (same username seed, different DiceBear collection) — no upload flow, no binary storage, coherent with the existing design.

## Rubric mapping

Funcionalidad (25): closes the last obvious product gap — a profile you can actually edit. Testing (25): TDD, unit + e2e + FE flow tests in the same commits. Calidad (20): additive on existing modules, whitelist validated at the DTO boundary, single source of truth for styles in `packages/shared`. Proceso (15): granular conventional commits.

## Scope

### In Scope
- `packages/shared`: `AVATAR_STYLES` const tuple + `AvatarStyle` type; `avatarStyle` added to `PublicUser` and `UserProfile`.
- **Prisma**: `User.avatarStyle String @default("identicon")` + migration (existing rows keep today's avatar).
- **Backend** `apps/api/src/users`: `avatarUrlFor(username, style)`; users/tweets/follows services read the stored style; `PATCH /users/me` with `UpdateProfileDto` (`displayName?`, `bio?`, `avatarStyle?`) returning `PublicUser`.
- **Frontend** `apps/web/src/features/users`: edit panel on own profile (name input, bio textarea, avatar style picker with live DiceBear previews), `useUpdateProfile` mutation, cache refresh (session + profile + tweet feeds), MSW handler + tests.

### Out of Scope
- Avatar image upload / arbitrary seeds (deliberate: no binary storage in this product).
- Username or email change (identity fields; auth implications out of challenge scope).
- Password change.

## Approach

Fully additive except one tiny migration (nullable-free column with default — zero backfill risk). The style whitelist lives in `packages/shared` and is imported by both the DTO (`@IsIn`) and the web picker, so client and server can never disagree on the allowed set. `PATCH /users/me` returns the same `PublicUser` shape as `/auth/me`, letting the web seed the session cache directly and invalidate the rest.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/shared/src/index.ts` | Modified | `AVATAR_STYLES`, `AvatarStyle`, `avatarStyle` on `PublicUser`/`UserProfile`, `UpdateProfileRequest` |
| `apps/api/prisma/schema.prisma` + migration | Modified/New | `User.avatarStyle` default `identicon` |
| `apps/api/src/users/**` | Modified | `avatar.ts` style param, `updateProfile` service + DTO + `PATCH /users/me`, specs |
| `apps/api/src/tweets/tweets.service.ts` | Modified | author select + mapper pass `avatarStyle` |
| `apps/api/src/follows/follows.service.ts` | Modified | summary select + mapper pass `avatarStyle` |
| `apps/api/test/profile.e2e-spec.ts` | Modified | edit flow e2e (update, validation, 401, avatar propagation) |
| `apps/web/src/features/users/**` | Modified/New | `EditProfileForm`, `useUpdateProfile`, `ProfilePage` wiring + tests |
| `apps/web/src/test/msw/handlers.ts` | Modified | `PATCH /users/me` handler over the fixture store |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A service keeps calling `avatarUrlFor` without the stored style → stale identicon in one payload | Med | single-arg call sites removed in the same commit; e2e asserts style propagates to profile, timeline author, and search results |
| `PATCH /users/me` intercepted by `:username` routes | Low | only PATCH route in the controller; e2e route-coexistence test extended |
| Web caches show stale name/avatar after save | Med | design pins the exact query keys refreshed on success; FE test asserts header + session-driven UI update |

## Rollback Plan

Revert the feature commits. The migration is additive with a default — rolling back code without rolling back the column is harmless (column simply unused).

## Dependencies

- Change 05 profile page (edit affordance mounts there). No new packages.

## Success Criteria

- [ ] `PATCH /users/me` updates any subset of `displayName`/`bio`/`avatarStyle`, validates lengths and whitelist, 401 unauthenticated.
- [ ] Empty-string bio clears to `null`.
- [ ] Changed style is reflected in `avatarUrl` everywhere (profile, session, tweet authors, search summaries).
- [ ] Own profile shows an Edit affordance (never on others'); form prefills, saves, updates header without reload; errors keep the form open.
- [ ] Backend coverage ≥ 85%; granular conventional commits; CI green.
