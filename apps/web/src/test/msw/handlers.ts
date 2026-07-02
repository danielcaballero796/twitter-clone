import { http, HttpResponse } from 'msw';
import type {
  CreateTweetRequest,
  PublicTweet,
  TweetAuthor,
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
  avatarUrl: string;
}

interface FixtureTweet {
  id: string;
  content: string;
  createdAt: string;
  authorUsername: string;
}

function initialUsers(): FixtureUser[] {
  return [
    {
      id: mockAuthor.id,
      username: mockAuthor.username,
      displayName: mockAuthor.displayName,
      bio: null,
      avatarUrl: mockAuthor.avatarUrl,
    },
    {
      id: otherUser.id,
      username: otherUser.username,
      displayName: otherUser.displayName,
      bio: 'Just here for the memes.',
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
    },
  ];
}

let users: FixtureUser[] = initialUsers();
let follows: Set<string> = new Set();
let tweets: FixtureTweet[] = initialTweets();

function edgeKey(follower: string, followee: string): string {
  return `${follower}->${followee}`;
}

/** Resets the fixture store to its initial state — called between tests alongside `server.resetHandlers()`. */
export function resetStore(): void {
  users = initialUsers();
  follows = new Set();
  tweets = initialTweets();
}

function findUser(username: string): FixtureUser | undefined {
  return users.find((user) => user.username === username);
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
    avatarUrl: user.avatarUrl,
    followersCount,
    followingCount,
    tweetsCount,
    isFollowing:
      user.username === ACTING_USERNAME ? false : isFollowing(ACTING_USERNAME, user.username),
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

  return {
    id: tweet.id,
    content: tweet.content,
    createdAt: tweet.createdAt,
    author: tweetAuthor,
    likesCount: 0,
    likedByMe: false,
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

/** Default handlers — read/mutate the fixture store above unless a test overrides them. */
export const handlers = [
  http.get(`${API_URL}/auth/me`, () => new HttpResponse(null, { status: 401 })),
  http.get(`${API_URL}/tweets/timeline`, () => {
    const items = tweets
      .filter((tweet) => isFollowing(ACTING_USERNAME, tweet.authorUsername))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublicTweet);
    return HttpResponse.json({ items, nextCursor: null, hasMore: false });
  }),
  http.post(`${API_URL}/tweets`, async ({ request }) => {
    const body = (await request.json()) as CreateTweetRequest;
    return HttpResponse.json(makeTweet({ id: `tweet-${Date.now()}`, content: body.content }), {
      status: 201,
    });
  }),
  http.delete(`${API_URL}/tweets/:id`, () => HttpResponse.json({ success: true })),
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
