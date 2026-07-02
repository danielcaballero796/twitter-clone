import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL, makeTweet, mockAuthor } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import ThreadPage from './ThreadPage';

let intersectionCallback: IntersectionObserverCallback | undefined;

class IntersectionObserverStub {
  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

function renderThread(id: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/t/${id}`]}>
        <Routes>
          <Route path="/t/:id" element={<ThreadPage />} />
        </Routes>
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

describe('ThreadPage', () => {
  it('renders the root tweet then replies in oldest-first order', async () => {
    server.use(
      http.get(`${API_URL}/tweets/root`, () =>
        HttpResponse.json(makeTweet({ id: 'root', content: 'the root tweet', replyCount: 3 })),
      ),
      http.get(`${API_URL}/tweets/root/replies`, () =>
        HttpResponse.json({
          items: [
            makeTweet({ id: 'r1', content: 'first reply' }),
            makeTweet({ id: 'r2', content: 'second reply' }),
            makeTweet({ id: 'r3', content: 'third reply' }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderThread('root');

    await waitFor(() => expect(screen.getByText('the root tweet')).toBeInTheDocument());
    const contents = screen.getAllByTestId('tweet-content').map((node) => node.textContent);
    expect(contents).toEqual(['the root tweet', 'first reply', 'second reply', 'third reply']);
  });

  it('loads the next page of replies on scroll', async () => {
    server.use(
      http.get(`${API_URL}/tweets/root`, () =>
        HttpResponse.json(makeTweet({ id: 'root', content: 'the root tweet' })),
      ),
      http.get(`${API_URL}/tweets/root/replies`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (cursor === 'r1') {
          return HttpResponse.json({
            items: [makeTweet({ id: 'r2', content: 'page two reply' })],
            nextCursor: null,
            hasMore: false,
          });
        }
        return HttpResponse.json({
          items: [makeTweet({ id: 'r1', content: 'page one reply' })],
          nextCursor: 'r1',
          hasMore: true,
        });
      }),
    );

    renderThread('root');
    await waitFor(() => expect(screen.getByText('page one reply')).toBeInTheDocument());

    intersectSentinel();

    await waitFor(() => expect(screen.getByText('page two reply')).toBeInTheDocument());
    expect(screen.getByText('page one reply')).toBeInTheDocument();
  });

  it('shows only the root tweet with no error state when there are zero replies', async () => {
    server.use(
      http.get(`${API_URL}/tweets/root`, () =>
        HttpResponse.json(makeTweet({ id: 'root', content: 'the lonely root', replyCount: 0 })),
      ),
      http.get(`${API_URL}/tweets/root/replies`, () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
    );

    renderThread('root');

    await waitFor(() => expect(screen.getByText('the lonely root')).toBeInTheDocument());
    expect(screen.getAllByTestId('tweet-content')).toHaveLength(1);
    expect(screen.queryByTestId('thread-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a not-found state for an unknown thread id', async () => {
    server.use(
      http.get(
        `${API_URL}/tweets/ghost`,
        () => new HttpResponse(JSON.stringify({ message: 'Tweet not found' }), { status: 404 }),
      ),
    );

    renderThread('ghost');

    await waitFor(() => expect(screen.getByTestId('thread-not-found')).toBeInTheDocument());
  });

  it('shows a loading status while the root tweet is in flight', async () => {
    server.use(
      http.get(`${API_URL}/tweets/root`, async () => {
        await delay(150);
        return HttpResponse.json(makeTweet({ id: 'root' }));
      }),
      http.get(`${API_URL}/tweets/root/replies`, () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
    );

    renderThread('root');

    expect(screen.getByRole('status')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('shows an alert error state when the root request fails with a non-404 error', async () => {
    server.use(http.get(`${API_URL}/tweets/root`, () => new HttpResponse(null, { status: 500 })));

    renderThread('root');

    await waitFor(() => expect(screen.getByTestId('thread-error')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('posting a reply appears in the list and bumps the parent displayed count', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(sessionUser)),
      http.get(`${API_URL}/tweets/root`, () =>
        HttpResponse.json(makeTweet({ id: 'root', content: 'the root tweet', replyCount: 0 })),
      ),
      http.get(`${API_URL}/tweets/root/replies`, () =>
        HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
      ),
      http.post(`${API_URL}/tweets`, async ({ request }) => {
        const body = (await request.json()) as { content: string; parentId?: string };
        await delay(20);
        return HttpResponse.json(
          makeTweet({
            id: 'new-reply',
            content: body.content,
            inReplyTo: { id: 'root', username: mockAuthor.username },
          }),
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderThread('root');
    await waitFor(() => expect(screen.getByText('the root tweet')).toBeInTheDocument());

    const textbox = screen.getByRole('textbox');
    await user.type(textbox, 'my new reply');
    await user.click(screen.getByRole('button', { name: /reply/i }));

    await waitFor(() => expect(screen.getByText('my new reply')).toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /1 replies, open thread/i })).toBeInTheDocument(),
    );
  });
});
