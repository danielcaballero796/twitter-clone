import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL, makeNotification, makeUserSummary } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import NotificationsPage from './NotificationsPage';

let intersectionCallback: IntersectionObserverCallback | undefined;

class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

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

describe('NotificationsPage', () => {
  it('renders the feed in the order served and links each type to its target', async () => {
    server.use(
      http.get(`${API_URL}/notifications`, () =>
        HttpResponse.json({
          items: [
            makeNotification({
              id: 'n1',
              type: 'FOLLOW',
              tweetId: null,
              actor: makeUserSummary({ username: 'bob', displayName: 'Bob' }),
            }),
            makeNotification({
              id: 'n2',
              type: 'REPLY',
              tweetId: 'reply-9',
              actor: makeUserSummary({ username: 'carol', displayName: 'Carol' }),
            }),
            makeNotification({
              id: 'n3',
              type: 'LIKE',
              tweetId: 'tweet-7',
              actor: makeUserSummary({ username: 'dave', displayName: 'Dave' }),
            }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderPage();

    const links = await screen.findAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/u/bob',
      '/t/reply-9',
      '/t/tweet-7',
    ]);
    expect(links[0]).toHaveTextContent(/followed you/i);
    expect(links[1]).toHaveTextContent(/replied to your tweet/i);
    expect(links[2]).toHaveTextContent(/liked your tweet/i);
  });

  it('fires mark-read on visit', async () => {
    let markReadCalled = false;
    server.use(
      http.patch(`${API_URL}/notifications/read`, () => {
        markReadCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    renderPage();

    await screen.findByTestId('notifications-empty');
    await waitFor(() => expect(markReadCalled).toBe(true));
  });

  it('loads the next page when the sentinel intersects', async () => {
    server.use(
      http.get(`${API_URL}/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 'n1') {
          return HttpResponse.json({
            items: [makeNotification({ id: 'n2', type: 'FOLLOW', tweetId: null })],
            nextCursor: null,
            hasMore: false,
          });
        }
        return HttpResponse.json({
          items: [makeNotification({ id: 'n1' })],
          nextCursor: 'n1',
          hasMore: true,
        });
      }),
    );

    renderPage();

    await screen.findAllByRole('link');
    intersectSentinel();

    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
  });

  it('shows the empty state when there are no notifications', async () => {
    renderPage();

    expect(await screen.findByTestId('notifications-empty')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a loading skeleton with role=status while fetching', async () => {
    server.use(
      http.get(`${API_URL}/notifications`, async () => {
        await delay(50);
        return HttpResponse.json({ items: [], nextCursor: null, hasMore: false });
      }),
    );

    renderPage();

    expect(screen.getByTestId('notifications-loading')).toHaveAttribute('role', 'status');
    await screen.findByTestId('notifications-empty');
  });

  it('shows an alert with a retry that refetches on failure', async () => {
    // Stays failing (also across the mark-read invalidation refetch) until the
    // retry click flips it, so the error state is stable when asserted.
    let shouldFail = true;
    server.use(
      http.get(`${API_URL}/notifications`, () => {
        if (shouldFail) {
          return new HttpResponse(null, { status: 500 });
        }
        return HttpResponse.json({
          items: [makeNotification({ id: 'n1' })],
          nextCursor: null,
          hasMore: false,
        });
      }),
    );

    renderPage();

    const alert = await screen.findByTestId('notifications-error');
    expect(alert).toHaveAttribute('role', 'alert');

    shouldFail = false;
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(await screen.findAllByRole('link')).toHaveLength(1);
  });

  it('marks unread items with a dot and read items without', async () => {
    server.use(
      http.get(`${API_URL}/notifications`, () =>
        HttpResponse.json({
          items: [
            makeNotification({ id: 'n1', read: false }),
            makeNotification({ id: 'n2', read: true }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderPage();

    await screen.findAllByRole('link');
    expect(screen.getAllByTestId('notification-unread-dot')).toHaveLength(1);
  });
});
