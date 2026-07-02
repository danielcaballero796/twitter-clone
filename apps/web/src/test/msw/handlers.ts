import { http, HttpResponse } from 'msw';
import type { CreateTweetRequest, PublicTweet, TweetAuthor } from '@twitterclone/shared';

export const API_URL = 'http://localhost:3000';

export const mockAuthor: TweetAuthor = {
  id: '1',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=alice',
};

export function makeTweet(overrides: Partial<PublicTweet> = {}): PublicTweet {
  return {
    id: 'tweet-1',
    content: 'A default tweet',
    createdAt: new Date().toISOString(),
    author: mockAuthor,
    ...overrides,
  };
}

/** Default handlers — unauthenticated session and an empty timeline unless a test overrides them. */
export const handlers = [
  http.get(`${API_URL}/auth/me`, () => new HttpResponse(null, { status: 401 })),
  http.get(`${API_URL}/tweets/timeline`, () =>
    HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
  ),
  http.post(`${API_URL}/tweets`, async ({ request }) => {
    const body = (await request.json()) as CreateTweetRequest;
    return HttpResponse.json(makeTweet({ id: `tweet-${Date.now()}`, content: body.content }), {
      status: 201,
    });
  }),
  http.delete(`${API_URL}/tweets/:id`, () => HttpResponse.json({ success: true })),
];
