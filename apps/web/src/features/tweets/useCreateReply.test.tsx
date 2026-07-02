import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode } from 'react';
import type { CursorPage, PublicTweet, PublicUser } from '@twitterclone/shared';
import {
  repliesQueryKey,
  SESSION_QUERY_KEY,
  TIMELINE_QUERY_KEY,
  tweetQueryKey,
  userTweetsQueryKey,
} from '../../lib/queryKeys';
import { API_URL, makeTweet, mockAuthor } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { useCreateReply } from './useCreateReply';

const sessionUser: PublicUser = {
  id: mockAuthor.id,
  email: 'alice@example.com',
  username: mockAuthor.username,
  displayName: mockAuthor.displayName,
  bio: null,
  avatarStyle: 'identicon',
  avatarUrl: mockAuthor.avatarUrl,
};

function seedQueryClient(queryClient: QueryClient, parentId: string) {
  queryClient.setQueryData(SESSION_QUERY_KEY, sessionUser);
  queryClient.setQueryData(tweetQueryKey(parentId), makeTweet({ id: parentId, replyCount: 0 }));
  queryClient.setQueryData(TIMELINE_QUERY_KEY, {
    pages: [
      { items: [makeTweet({ id: parentId, replyCount: 0 })], nextCursor: null, hasMore: false },
    ],
    pageParams: [undefined],
  });
  queryClient.setQueryData(userTweetsQueryKey(mockAuthor.username), {
    pages: [
      { items: [makeTweet({ id: parentId, replyCount: 0 })], nextCursor: null, hasMore: false },
    ],
    pageParams: [undefined],
  });
  queryClient.setQueryData(repliesQueryKey(parentId), {
    pages: [{ items: [], nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

type PagedTweets = { pages: CursorPage<PublicTweet>[] };

describe('useCreateReply', () => {
  it('appends an optimistic reply to the end of the last replies page', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedQueryClient(queryClient, 'root');
    server.use(
      http.post(`${API_URL}/tweets`, async () => {
        await delay(50);
        return HttpResponse.json(makeTweet({ id: 'server-reply', content: 'a reply' }), {
          status: 201,
        });
      }),
    );

    const { result } = renderHook(() => useCreateReply('root'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate('a reply');

    await waitFor(() => {
      const data = queryClient.getQueryData<PagedTweets>(repliesQueryKey('root'));
      const lastPage = data?.pages[data.pages.length - 1];
      expect(lastPage?.items.at(-1)?.content).toBe('a reply');
    });
  });

  it('bumps replyCount by 1 on the parent tweet wherever it is cached', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedQueryClient(queryClient, 'root');
    server.use(
      http.post(`${API_URL}/tweets`, async () => {
        await delay(50);
        return HttpResponse.json(makeTweet({ id: 'server-reply', content: 'a reply' }), {
          status: 201,
        });
      }),
    );

    const { result } = renderHook(() => useCreateReply('root'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate('a reply');

    await waitFor(() => {
      expect(queryClient.getQueryData<PublicTweet>(tweetQueryKey('root'))?.replyCount).toBe(1);
    });
    const timeline = queryClient.getQueryData<PagedTweets>(TIMELINE_QUERY_KEY);
    expect(timeline?.pages[0]?.items[0]?.replyCount).toBe(1);
    const userTweets = queryClient.getQueryData<PagedTweets>(
      userTweetsQueryKey(mockAuthor.username),
    );
    expect(userTweets?.pages[0]?.items[0]?.replyCount).toBe(1);
  });

  it('rolls back the optimistic append and the replyCount bump on error', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    seedQueryClient(queryClient, 'root');
    server.use(http.post(`${API_URL}/tweets`, () => new HttpResponse(null, { status: 500 })));

    const { result } = renderHook(() => useCreateReply('root'), {
      wrapper: createWrapper(queryClient),
    });

    result.current.mutate('a reply');

    await waitFor(() => expect(result.current.isError).toBe(true));
    const replies = queryClient.getQueryData<PagedTweets>(repliesQueryKey('root'));
    expect(replies?.pages[0]?.items).toHaveLength(0);
    expect(queryClient.getQueryData<PublicTweet>(tweetQueryKey('root'))?.replyCount).toBe(0);
  });
});
