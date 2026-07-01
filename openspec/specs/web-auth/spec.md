# Web Auth Specification (Frontend)

## Purpose

Defines frontend authentication UX: register/login pages, session state, protected-route redirection, and logout. New domain — no prior spec exists.

## Requirements

### Requirement: Register Page
The system MUST provide a mobile-first register page that submits to the backend and surfaces validation/conflict errors inline.

#### Scenario: Successful registration navigates to app
- GIVEN valid registration inputs
- WHEN the user submits the register form
- THEN the system MUST create the session and navigate to the authenticated app

#### Scenario: Duplicate email/username shows inline error
- GIVEN the backend returns 409 for email or username
- WHEN the register form is submitted
- THEN the system MUST display a field-level error without navigating away

### Requirement: Login Page
The system MUST provide a mobile-first login page that authenticates and establishes session state.

#### Scenario: Successful login navigates to app
- GIVEN correct credentials
- WHEN the user submits the login form
- THEN the system MUST navigate to the authenticated app and the session hook MUST reflect the logged-in user

#### Scenario: Wrong credentials show inline error
- GIVEN incorrect credentials
- WHEN the user submits the login form
- THEN the system MUST display a generic invalid-credentials error, no navigation

### Requirement: Session Hook
The system MUST expose a `useSession` hook backed by `GET /auth/me` via TanStack Query reflecting authenticated state.

#### Scenario: Session hook resolves authenticated user
- GIVEN a valid session cookie exists
- WHEN the app loads
- THEN `useSession` MUST resolve with the current user (id, username, displayName, avatarUrl)

#### Scenario: Session hook resolves unauthenticated
- GIVEN no valid session cookie
- WHEN the app loads
- THEN `useSession` MUST resolve to an unauthenticated state without throwing an unhandled error

### Requirement: Protected Route Redirect
The system MUST redirect unauthenticated users away from protected routes to `/login`.

#### Scenario: Unauthenticated access redirected
- GIVEN no active session
- WHEN the user navigates to a protected route
- THEN the system MUST redirect to `/login`

#### Scenario: Authenticated access allowed
- GIVEN an active session
- WHEN the user navigates to a protected route
- THEN the system MUST render the protected content without redirecting

### Requirement: Logout Flow
The system MUST let an authenticated user log out, clearing session state and returning to a public page.

#### Scenario: Logout clears client session
- GIVEN an authenticated user
- WHEN they trigger logout
- THEN the system MUST call the logout endpoint, invalidate cached session state, and redirect to `/login`

### Requirement: Login Integration Test Coverage
The frontend test suite MUST include an integration test for the login flow.

#### Scenario: Integration test covers login success and failure
- GIVEN the login page rendered with mocked API responses (MSW if needed)
- WHEN a Vitest + Testing Library test submits valid and invalid credentials
- THEN both the success navigation path and the inline error path MUST be asserted
