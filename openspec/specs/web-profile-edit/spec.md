# Web Profile Edit Specification

## Purpose

Defines the edit-profile surface on the own profile page (`/u/:username`): affordance visibility, form behavior, avatar style picker, and cache consistency after a save. 8 scenarios total.

## Requirements

### Requirement: Edit Affordance Only on Own Profile

The profile header MUST show an "Edit profile" button on the session user's own profile and MUST NOT show it on anyone else's (where the Follow button renders instead).

#### Scenario: Own profile shows Edit, not Follow
- GIVEN a session user viewing their own profile
- WHEN the header renders
- THEN an "Edit profile" button MUST be visible and no Follow button MUST render

#### Scenario: Other profiles show Follow, not Edit
- GIVEN a session user viewing another user's profile
- WHEN the header renders
- THEN the Follow button MUST be visible and no "Edit profile" button MUST render

### Requirement: Edit Form Behavior

Activating the edit affordance MUST reveal a form with a display-name input, a bio textarea, and an avatar style picker, prefilled from the current profile.

#### Scenario: Form prefills current values
- GIVEN a session user with a display name, bio, and avatar style
- WHEN they open the edit form
- THEN the name input, bio textarea, and selected style radio MUST reflect the current values

#### Scenario: Picker previews every whitelisted style
- GIVEN the edit form is open
- WHEN the avatar picker renders
- THEN it MUST render exactly one selectable preview per entry of the shared `AVATAR_STYLES` whitelist, each an image seeded with the session username

#### Scenario: Save updates the header without reload
- GIVEN the edit form is open with changed name, bio, and style
- WHEN the user saves and the request succeeds
- THEN the form MUST close and the profile header MUST show the new name, bio, and avatar image

#### Scenario: Save failure keeps the form open
- GIVEN the edit form is open with changes
- WHEN the save request fails
- THEN an error message MUST be announced (`role="alert"`) and the form MUST remain open with the user's input intact

#### Scenario: Cancel discards changes
- GIVEN the edit form is open with unsaved changes
- WHEN the user cancels
- THEN the form MUST close and the header MUST keep the original values

### Requirement: Cache Consistency After Save

A successful save MUST refresh the session user and every cached surface that renders the edited identity (profile query, home timeline, user-tweets feeds) so stale name/avatar never lingers.

#### Scenario: Session-driven UI reflects the save
- GIVEN a successful profile save that changed the avatar style
- WHEN previously fetched queries settle
- THEN the session cache MUST hold the updated `PublicUser` and profile/timeline/user-tweets queries MUST be invalidated
