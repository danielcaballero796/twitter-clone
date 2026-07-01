# Auth Specification (API)

## Purpose

Defines backend authentication behavior: registration, login, logout, session retrieval, and the global route guard. New domain — no prior spec exists.

## Requirements

### Requirement: User Registration
The system MUST register a user with a unique email and username, hashing the password with argon2id before persistence.

#### Scenario: Successful registration
- GIVEN valid email, unique username, and password ≥ 8 chars
- WHEN `POST /auth/register` is called
- THEN the system creates the user with an argon2id password hash and returns 201 with the public user shape (no passwordHash)

#### Scenario: Invalid email format rejected
- GIVEN a malformed email
- WHEN `POST /auth/register` is called
- THEN the system MUST return 400 with a validation error, no user created

#### Scenario: Password too short rejected
- GIVEN a password under the minimum length
- WHEN `POST /auth/register` is called
- THEN the system MUST return 400, no user created

#### Scenario: Duplicate email rejected
- GIVEN an email already registered
- WHEN `POST /auth/register` is called with that email
- THEN the system MUST return 409 Conflict, no duplicate row persisted

#### Scenario: Duplicate username rejected
- GIVEN a username already registered
- WHEN `POST /auth/register` is called with that username
- THEN the system MUST return 409 Conflict, no duplicate row persisted

### Requirement: Avatar Placeholder Derivation
The system MUST derive a deterministic avatar placeholder URL from the username at registration time.

#### Scenario: Avatar generated on registration
- GIVEN a new user registers with username `alice`
- WHEN the user record is created
- THEN the system MUST persist/derive an avatar URL deterministic on `alice` (e.g. DiceBear/UI Avatars seed)

### Requirement: Login Issues Session Cookie
The system MUST authenticate credentials and issue a JWT in an httpOnly cookie on success.

#### Scenario: Successful login
- GIVEN a registered user with correct email and password
- WHEN `POST /auth/login` is called
- THEN the system MUST return 200 and set a cookie that is httpOnly, `SameSite=Lax`, `secure` in production, with 7-day maxAge

#### Scenario: Wrong password rejected
- GIVEN a registered user and an incorrect password
- WHEN `POST /auth/login` is called
- THEN the system MUST return 401, no cookie set

#### Scenario: Unknown email rejected
- GIVEN an email with no matching user
- WHEN `POST /auth/login` is called
- THEN the system MUST return 401 (same generic error as wrong password, no user enumeration)

### Requirement: Global Guard Protects Routes by Default
Every route MUST require a valid session unless explicitly marked `@Public()`.

#### Scenario: Protected route without cookie rejected
- GIVEN no session cookie is sent
- WHEN a protected route is requested
- THEN the system MUST return 401

#### Scenario: Protected route with tampered token rejected
- GIVEN a cookie containing an invalid/tampered JWT signature
- WHEN a protected route is requested
- THEN the system MUST return 401

#### Scenario: Protected route with expired token rejected
- GIVEN a cookie containing an expired JWT
- WHEN a protected route is requested
- THEN the system MUST return 401

#### Scenario: Public route bypasses guard
- GIVEN a route decorated with `@Public()` (e.g. health, register, login)
- WHEN requested without a session cookie
- THEN the system MUST NOT return 401 for lack of auth

### Requirement: Current Session Retrieval
The system MUST expose `GET /auth/me` returning the authenticated user's public profile.

#### Scenario: Me with valid session
- GIVEN a valid session cookie
- WHEN `GET /auth/me` is called
- THEN the system MUST return 200 with id, email, username, displayName, bio, avatarUrl (no passwordHash)

#### Scenario: Me without session
- GIVEN no valid session cookie
- WHEN `GET /auth/me` is called
- THEN the system MUST return 401

### Requirement: Logout Clears Session
The system MUST invalidate the client-side session on logout.

#### Scenario: Logout clears cookie
- GIVEN a valid session cookie
- WHEN `POST /auth/logout` is called
- THEN the system MUST return 200 and clear the cookie (expired/empty)

#### Scenario: Access rejected after logout
- GIVEN a client that just logged out
- WHEN a protected route is requested with the cleared cookie
- THEN the system MUST return 401

### Requirement: Full Auth Flow (Mandatory E2E)
The system MUST support the complete flow as a single continuous session.

#### Scenario: Register → login → protected → logout → rejected
- GIVEN a fresh client
- WHEN it registers, then logs in, then calls a protected route, then logs out, then calls the protected route again
- THEN each step MUST succeed in order and the final call MUST return 401
