import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { API_URL, makeTweet, mockAuthor } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import TimelineFeed from './TimelineFeed';

let intersectionCallback: IntersectionObserverCallback | undefined;

class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderFeed() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TimelineFeed />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

const sessionUser = {
  id: mockAuthor.id,
  email: 'alice@example.com',
  username: mockAuthor.username,
  displayName: mockAuthor.displayName,
  bio: null,
  avatarUrl: mockAuthor.avatarUrl,
};

const otherAuthor = {
  id: '2',
  username: 'bob',
  displayName: 'Bob',
  avatarUrl: 'https://api.dicebear.com/9.x/identicon/svg?seed=bob',
};

beforeEach(() => {
  intersectionCallback = undefined;
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const intersectSentinel = () =>
  act(() => {
    intersectionCallback?.(
      [{ isIntersecting: true }] as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
  });

describe('TimelineFeed', () => {
  it('fetches and renders the first page on mount', async () => {
    server.use(
      http.get(`${API_URL}/tweets/timeline`, () =>
        HttpResponse.json({
          items: [
            makeTweet({ id: 't1', content: 'first tweet' }),
            makeTweet({ id: 't2', content: 'second tweet' }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderFeed();

    await waitFor(() => expect(screen.getByText('first tweet')).toBeInTheDocument());
    expect(screen.getByText('second tweet')).toBeInTheDocument();
  });

  it('loads the next page when the sentinel intersects', async () => {
    server.use(
      http.get(`${API_URL}/tweets/timeline`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 't1') {
          return HttpResponse.json({
            items: [makeTweet({ id: 't2', content: 'page two tweet' })],
            nextCursor: null,
            hasMore: false,
          });
        }
        return HttpResponse.json({
          items: [makeTweet({ id: 't1', content: 'page one tweet' })],
          nextCursor: 't1',
          hasMore: true,
        });
      }),
    );

    renderFeed();
    await waitFor(() => expect(screen.getByText('page one tweet')).toBeInTheDocument());

    intersectSentinel();

    await waitFor(() => expect(screen.getByText('page two tweet')).toBeInTheDocument());
    expect(screen.getByText('page one tweet')).toBeInTheDocument();
  });

  it('shows a loading indicator while the first page is in flight', async () => {
    server.use(
      http.get(`${API_URL}/tweets/timeline`, async () => {
        await delay(150);
        return HttpResponse.json({ items: [], nextCursor: null, hasMore: false });
      }),
    );

    renderFeed();

    expect(screen.getByTestId('timeline-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('timeline-loading')).not.toBeInTheDocument());
  });

  it('shows an error state when the timeline request fails', async () => {
    server.use(
      http.get(`${API_URL}/tweets/timeline`, () => new HttpResponse(null, { status: 500 })),
    );

    renderFeed();

    await waitFor(() => expect(screen.getByTestId('timeline-error')).toBeInTheDocument());
  });

  it('shows an empty-state CTA when the timeline has no tweets', async () => {
    renderFeed();

    await waitFor(() => expect(screen.getByTestId('timeline-empty')).toBeInTheDocument());
    expect(screen.getByText(/first tweet/i)).toBeInTheDocument();
  });

  it('shows the delete button only on the session user own tweets', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(sessionUser)),
      http.get(`${API_URL}/tweets/timeline`, () =>
        HttpResponse.json({
          items: [
            makeTweet({ id: 'mine', content: 'my tweet' }),
            makeTweet({ id: 'theirs', content: 'their tweet', author: otherAuthor }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderFeed();
    await waitFor(() => expect(screen.getByText('my tweet')).toBeInTheDocument());

    const deleteButtons = screen.getAllByRole('button', { name: /delete tweet/i });
    expect(deleteButtons).toHaveLength(1);
  });

  it('removes the tweet optimistically after a confirmed delete', async () => {
    let deleteCalled = false;
    // Stateful mock — the deleted tweet must stay gone after the post-mutation refetch.
    let tweets = [makeTweet({ id: 'mine', content: 'delete me please' })];
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(sessionUser)),
      http.get(`${API_URL}/tweets/timeline`, () =>
        HttpResponse.json({ items: tweets, nextCursor: null, hasMore: false }),
      ),
      http.delete(`${API_URL}/tweets/mine`, () => {
        deleteCalled = true;
        tweets = tweets.filter((tweet) => tweet.id !== 'mine');
        return HttpResponse.json({ success: true });
      }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderFeed();
    await waitFor(() => expect(screen.getByText('delete me please')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete tweet/i }));

    await waitFor(() => expect(screen.queryByText('delete me please')).not.toBeInTheDocument());
    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => expect(deleteCalled).toBe(true));

    confirmSpy.mockRestore();
  });
});
