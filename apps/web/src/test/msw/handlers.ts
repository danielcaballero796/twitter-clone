import { http, HttpResponse } from 'msw';
import type {
  AvatarStyle,
  CreateTweetRequest,
  PublicNotification,
  PublicTweet,
  PublicUser,
  TweetAuthor,
  UpdateProfileRequest,
  UserListResponse,
  UserProfile,
  UserSummary,
} from '@twitterclone/shared';

export const API_URL = 'http://localhost:3000';

export const mockAuthor: TweetAuthor = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=alice',
};

/** A second user distinct from the default session user — target for search/follow fixtures. */
export const otherUser: TweetAuthor = {
  id: '2',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=bob',
};

export function makeTweet(overrides: Partial<PublicTweet> = {}): PublicTweet {
  return {
    id: 'tweet-1',
    content: 'A default tweet',
    createdAt: new Date().toISOString(),
    author: mockAuthor,
    likesCount: 0,
    likedByMe: false,
    replyCount: 0,
    inReplyTo: null,
    ...overrides,
  };
}

export function makeUserSummary(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: otherUser.id,
    username: otherUser.username,
    displayName: otherUser.displayName,
    avatarUrl: otherUser.avatarUrl,
    isFollowing: false,
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<PublicNotification> = {}): PublicNotification {
  return {
    id: 'notification-1',
    type: 'LIKE',
    read: false,
    createdAt: new Date().toISOString(),
    actor: makeUserSummary(),
    tweetId: 'tweet-1',
    ...overrides,
  };
}

/**
 * In-memory fixture store backing the DEFAULT handlers below (users, follow edges, tweets).
 * Per-test `server.use(...)` overrides bypass this store entirely — it only exists so the
 * default handlers behave like a tiny consistent backend (e.g. a follow mutation is reflected
 * on a profile/timeline refetch without every test having to hand-roll that plumbing).
 *
 * `ACTING_USERNAME` is the implicit "current session user" for store-driven mutations
 * (follow/unfollow, timeline). Real auth (`/auth/me`) is unrelated and still defaults to 401 —
 * plenty of existing tests rely on that to represent "unauthenticated".
 */
const ACTING_USERNAME = mockAuthor.username;

interface FixtureUser {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarStyle: AvatarStyle;
  avatarUrl: string;
}

interface FixtureTweet {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string;
  /** Base like count, excludes the acting session user's own like state (see `likedTweetIds`). */
  likesCount: number;
  /** Non-null when this tweet is a reply to another fixture tweet. */
  parentId: string | null;
}

function initialUsers(): FixtureUser[] {
  return [
    {
      id: mockAuthor.id,
      username: mockAuthor.username,
      displayName: mockAuthor.displayName,
      bio: null,
      avatarStyle: 'identicon',
      avatarUrl: mockAuthor.avatarUrl,
    },
    {
      id: otherUser.id,
      username: otherUser.username,
      displayName: otherUser.displayName,
      bio: 'Just here for the memes.',
      avatarStyle: 'identicon',
      avatarUrl: otherUser.avatarUrl,
    },
  ];
}

function initialTweets(): FixtureTweet[] {
  return [
    {
      id: 'bob-tweet-1',
      content: "bob's default tweet",
      createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
      authorUsername: otherUser.username,
      likesCount: 0,
      parentId: null,
    },
  ];
}

let users: FixtureUser[] = initialUsers();
let follows: Set<string> = new Set();
let tweets: FixtureTweet[] = initialTweets();
/** Tweet ids liked by `ACTING_USERNAME` — the only session user the fixture store tracks. */
let likedTweetIds: Set<string> = new Set();

function edgeKey(follower: string, followee: string): string {
  return `${follower}->${followee}`;
}

/** Resets the fixture store to its initial state — called between tests alongside `server.resetHandlers()`. */
export function resetStore(): void {
  users = initialUsers();
  follows = new Set();
  tweets = initialTweets();
  likedTweetIds = new Set();
}

function findUser(username: string): FixtureUser | undefined {
  return users.find((user) => user.username === username);
}

function findTweet(id: string): FixtureTweet | undefined {
  return tweets.find((tweet) => tweet.id === id);
}

function replyCountOf(id: string): number {
  return tweets.filter((tweet) => tweet.parentId === id).length;
}

function isFollowing(follower: string, followee: string): boolean {
  return follows.has(edgeKey(follower, followee));
}

function toUserSummary(user: FixtureUser): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isFollowing: isFollowing(ACTING_USERNAME, user.username),
  };
}

function toUserProfile(user: FixtureUser): UserProfile {
  const followersCount = [...follows].filter((edge) => edge.endsWith(`->${user.username}`)).length;
  const followingCount = [...follows].filter((edge) =>
    edge.startsWith(`${user.username}->`),
  ).length;
  const tweetsCount = tweets.filter((tweet) => tweet.authorUsername === user.username).length;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarStyle: user.avatarStyle,
    avatarUrl: user.avatarUrl,
    followersCount,
    followingCount,
    tweetsCount,
    isFollowing:
      user.username === ACTING_USERNAME ? false : isFollowing(ACTING_USERNAME, user.username),
  };
}

function toPublicUser(user: FixtureUser): PublicUser {
  return {
    id: user.id,
    email: `${user.username}@example.com`,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarStyle: user.avatarStyle,
    avatarUrl: user.avatarUrl,
  };
}

function toPublicTweet(tweet: FixtureTweet): PublicTweet {
  const author = findUser(tweet.authorUsername);
  const tweetAuthor: TweetAuthor = author
    ? {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
      }
    : mockAuthor;

  const parent = tweet.parentId ? findTweet(tweet.parentId) : undefined;
  const parentAuthor = parent ? findUser(parent.authorUsername) : undefined;

  return {
    id: tweet.id,
    content: tweet.content,
    createdAt: tweet.createdAt,
    author: tweetAuthor,
    likesCount: tweet.likesCount + (likedTweetIds.has(tweet.id) ? 1 : 0),
    likedByMe: likedTweetIds.has(tweet.id),
    replyCount: replyCountOf(tweet.id),
    inReplyTo: parent && parentAuthor ? { id: parent.id, username: parentAuthor.username } : null,
  };
}

function tweetsByAuthor(username: string): PublicTweet[] {
  return tweets
    .filter((tweet) => tweet.authorUsername === username)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicTweet);
}

function notFound() {
  return HttpResponse.json({ message: 'User not found' }, { status: 404 });
}

function tweetNotFound() {
  return HttpResponse.json({ message: 'Tweet not found' }, { status: 404 });
}

/** Default handlers — read/mutate the fixture store above unless a test overrides them. */
export const handlers = [
  http.get(`${API_URL}/auth/me`, () => new HttpResponse(null, { status: 401 })),
  http.get(`${API_URL}/notifications/unread-count`, () => HttpResponse.json({ count: 0 })),
  http.get(`${API_URL}/notifications`, () =>
    HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
  ),
  http.patch(`${API_URL}/notifications/read`, () => HttpResponse.json({ success: true })),
  http.post(`${API_URL}/ai/tweet-assist`, () =>
    HttpResponse.json({ suggestion: 'A default AI suggestion' }),
  ),
  http.get(`${API_URL}/tweets/timeline`, () => {
    const items = tweets
      .filter((tweet) => isFollowing(ACTING_USERNAME, tweet.authorUsername))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublicTweet);
    return HttpResponse.json({ items, nextCursor: null, hasMore: false });
  }),
  http.post(`${API_URL}/tweets`, async ({ request }) => {
    const body = (await request.json()) as CreateTweetRequest;
    if (body.parentId && !findTweet(body.parentId)) {
      return tweetNotFound();
    }
    return HttpResponse.json(
      makeTweet({
        id: `tweet-${Date.now()}`,
        content: body.content,
        inReplyTo: body.parentId
          ? { id: body.parentId, username: findTweet(body.parentId)?.authorUsername ?? '' }
          : null,
      }),
      { status: 201 },
    );
  }),
  http.get(`${API_URL}/tweets/:id/replies`, ({ params, request }) => {
    const id = params.id as string;
    if (!findTweet(id)) {
      return tweetNotFound();
    }
    const cursor = new URL(request.url).searchParams.get('cursor');
    const items = tweets
      .filter((tweet) => tweet.parentId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(toPublicTweet);
    if (!cursor) {
      return HttpResponse.json({ items, nextCursor: null, hasMore: false });
    }
    const index = items.findIndex((tweet) => tweet.id === cursor);
    return HttpResponse.json({ items: items.slice(index + 1), nextCursor: null, hasMore: false });
  }),
  http.get(`${API_URL}/tweets/:id`, ({ params }) => {
    const tweet = findTweet(params.id as string);
    if (!tweet) {
      return tweetNotFound();
    }
    return HttpResponse.json(toPublicTweet(tweet));
  }),
  http.delete(`${API_URL}/tweets/:id`, () => HttpResponse.json({ success: true })),
  http.post(`${API_URL}/tweets/:tweetId/like`, ({ params }) => {
    likedTweetIds.add(params.tweetId as string);
    return HttpResponse.json({ success: true });
  }),
  http.delete(`${API_URL}/tweets/:tweetId/like`, ({ params }) => {
    likedTweetIds.delete(params.tweetId as string);
    return HttpResponse.json({ success: true });
  }),
  http.patch(`${API_URL}/users/me`, async ({ request }) => {
    const body = (await request.json()) as UpdateProfileRequest;
    const user = findUser(ACTING_USERNAME);
    if (!user) {
      return notFound();
    }
    if (body.displayName !== undefined) {
      user.displayName = body.displayName;
    }
    if (body.bio !== undefined) {
      user.bio = body.bio === '' ? null : body.bio;
    }
    if (body.avatarStyle !== undefined) {
      user.avatarStyle = body.avatarStyle;
      user.avatarUrl = `https://api.dicebear.com/9.x/${body.avatarStyle}/svg?seed=${user.username}`;
    }
    return HttpResponse.json(toPublicUser(user));
  }),
  http.get(`${API_URL}/users`, ({ request }) => {
    const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
    const items: UserListResponse['items'] = users
      .filter((user) => user.username !== ACTING_USERNAME)
      .filter(
        (user) =>
          user.username.toLowerCase().includes(q) || user.displayName.toLowerCase().includes(q),
      )
      .map(toUserSummary);
    return HttpResponse.json({ items });
  }),
  http.post(`${API_URL}/users/:username/follow`, ({ params }) => {
    follows.add(edgeKey(ACTING_USERNAME, params.username as string));
    return HttpResponse.json({ success: true });
  }),
  http.delete(`${API_URL}/users/:username/follow`, ({ params }) => {
    follows.delete(edgeKey(ACTING_USERNAME, params.username as string));
    return HttpResponse.json({ success: true });
  }),
  http.get(`${API_URL}/users/:username/tweets`, ({ params }) => {
    const user = findUser(params.username as string);
    if (!user) {
      return notFound();
    }
    return HttpResponse.json({
      items: tweetsByAuthor(user.username),
      nextCursor: null,
      hasMore: false,
    });
  }),
  http.get(`${API_URL}/users/:username`, ({ params }) => {
    const user = findUser(params.username as string);
    if (!user) {
      return notFound();
    }
    return HttpResponse.json(toUserProfile(user));
  }),
];
