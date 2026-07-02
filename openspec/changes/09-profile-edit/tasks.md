# Tasks: 09-profile-edit

Blocks (4 commits). Strict TDD: each block lands RED tests and their GREEN implementation in the same commit.

## Block 0 — Selectable avatar styles (API plumbing)

Commit: `feat(api): derive avatars from a selectable per-user style`

- [ ] 0.1 `packages/shared`: `AVATAR_STYLES` const tuple + `AvatarStyle`; `avatarStyle` on `PublicUser` and `UserProfile`; `UpdateProfileRequest` type
- [ ] 0.2 Prisma: `User.avatarStyle String @default("identicon")` + migration `add_user_avatar_style`
- [ ] 0.3 `avatar.ts`: `avatarUrlFor(username, style = 'identicon')` builds `9.x/${style}/svg`
- [ ] 0.4 Services pass the stored style: users (`toPublicUser`, `search`, `profile`), tweets (`AUTHOR_SELECT` + mapper), follows (summary select + mapper) — no single-arg `avatarUrlFor` call site remains (grep gate)
- [ ] 0.5 Unit specs updated/added: style flows through each mapper; default keeps identicon URL byte-identical

## Block 1 — PATCH /users/me

Commit: `feat(api): add profile editing via PATCH /users/me`

- [ ] 1.1 `UpdateProfileDto`: `displayName?` (1–50), `bio?` (max 160), `avatarStyle?` (`@IsIn(AVATAR_STYLES)`)
- [ ] 1.2 `UsersService.updateProfile(userId, input)` — defined-fields-only patch, `'' → null` bio normalization, returns `PublicUser`
- [ ] 1.3 `PATCH /users/me` on `UsersController`
- [ ] 1.4 Unit specs: partial update, bio clear, no-op patch
- [ ] 1.5 e2e (`profile.e2e-spec.ts`): update happy path visible on `GET /users/:username`; 400 invalid style/bounds; 401; changed style propagates to profile + search + timeline author

## Block 2 — Web edit profile UI

Commit: `feat(web): add profile editing with avatar style picker`

- [ ] 2.1 `api.ts`: `updateProfile(input)` → `PATCH /users/me`
- [ ] 2.2 `useUpdateProfile`: on success seed `SESSION_QUERY_KEY`, invalidate `PROFILE_QUERY_PREFIX` + `TIMELINE_QUERY_KEY` + `USER_TWEETS_QUERY_PREFIX`
- [ ] 2.3 `EditProfileForm`: prefilled name/bio/style picker (fieldset radios, one DiceBear preview per style), save/cancel, pending + error states
- [ ] 2.4 `ProfilePage`: "Edit profile" button in the Follow slot when `isOwnProfile`, toggles the inline panel
- [ ] 2.5 MSW: `PATCH /users/me` handler mutating the fixture store (recompute `avatarUrl` from style)
- [ ] 2.6 Tests: affordance visibility (own vs other), prefill, picker renders all `AVATAR_STYLES`, save success updates header + closes, failure keeps form open with alert, cancel discards

## Block 3 — Verification gate + archive

Commit: `chore(openspec): archive 09-profile-edit`

- [ ] 3.1 `pnpm lint`, `pnpm typecheck`, `pnpm test` (api coverage ≥ 85%), `pnpm build` all green
- [ ] 3.2 Sync delta specs to `openspec/specs/`, move change to archive, update `state.yaml`
