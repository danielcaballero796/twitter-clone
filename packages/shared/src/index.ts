/**
 * Shared contract types consumed by both apps/api and apps/web.
 * This package is consumed as TypeScript source (no build step).
 */

/** Application display name — single source of truth for both apps. */
export const APP_NAME = 'Twitter Clone';

/** Payload returned by `GET /health`. */
export interface HealthStatus {
  status: 'ok';
}

/** Authenticated user shape returned by the API — never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string;
}

/** Body accepted by `POST /auth/register`. */
export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  displayName: string;
}

/** Body accepted by `POST /auth/login`. */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Author summary embedded in every tweet returned by the API. */
export interface TweetAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

/** Tweet shape returned by the API. */
export interface PublicTweet {
  id: string;
  content: string;
  createdAt: string;
  author: TweetAuthor;
  /** Total likes on the tweet. */
  likesCount: number;
  /** Session-relative: true only if the requesting session user has liked this tweet. */
  likedByMe: boolean;
}

/** Body accepted by `POST /tweets`. */
export interface CreateTweetRequest {
  content: string;
}

/** Cursor-paginated page returned by list endpoints (e.g. `GET /tweets/timeline`). */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** User shape returned by follow/search/list endpoints, with session-relative follow state. */
export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isFollowing: boolean;
}

/** Response shape for capped, non-paginated user list endpoints. */
export interface UserListResponse {
  items: UserSummary[];
}

/** Profile payload returned by `GET /users/:username`, with session-relative follow state. */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
  isFollowing: boolean;
}
