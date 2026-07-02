import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import type { ReactElement } from 'react';
import { API_URL, makeUserSummary, otherUser } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import TimelineFeed from '../tweets/TimelineFeed';
import ExplorePage from './ExplorePage';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return queryClient;
}

// SearchBox debounces for 300ms with real timers — callers must `waitFor` the resulting UI.
function search(query: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /search users/i }), {
    target: { value: query },
  });
}

describe('ExplorePage', () => {
  it('shows a loading indicator while a search request is in flight', async () => {
    server.use(
      http.get(`${API_URL}/users`, async () => {
        await delay(150);
        return HttpResponse.json({ items: [] });
      }),
    );

    renderWithClient(<ExplorePage />);
    search('bob');

    await waitFor(() => expect(screen.getByTestId('explore-loading')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByTestId('explore-loading')).not.toBeInTheDocument());
  });

  it('shows an empty-state message when the search has zero matches', async () => {
    server.use(http.get(`${API_URL}/users`, () => HttpResponse.json({ items: [] })));

    renderWithClient(<ExplorePage />);
    search('nobody');

    await waitFor(() => expect(screen.getByTestId('explore-empty')).toBeInTheDocument());
  });

  it('shows an error state when the search request fails', async () => {
    server.use(http.get(`${API_URL}/users`, () => new HttpResponse(null, { status: 500 })));

    renderWithClient(<ExplorePage />);
    search('bob');

    await waitFor(() => expect(screen.getByTestId('explore-error')).toBeInTheDocument());
  });

  it('flips the follow button to "Following" optimistically', async () => {
    server.use(
      http.get(`${API_URL}/users`, () => HttpResponse.json({ items: [makeUserSummary()] })),
      http.post(`${API_URL}/users/${otherUser.username}/follow`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true });
      }),
    );

    const user = userEvent.setup();
    renderWithClient(<ExplorePage />);
    search('bob');

    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    const followButton = screen.getByRole('button', { name: /^follow$/i });
    await user.click(followButton);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^following$/i })).toBeInTheDocument(),
    );
  });

  it('flips the follow button back to "Follow" optimistically on unfollow', async () => {
    server.use(
      http.get(`${API_URL}/users`, () =>
        HttpResponse.json({ items: [makeUserSummary({ isFollowing: true })] }),
      ),
      http.delete(`${API_URL}/users/${otherUser.username}/follow`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true });
      }),
    );

    const user = userEvent.setup();
    renderWithClient(<ExplorePage />);
    search('bob');

    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    const followingButton = screen.getByRole('button', { name: /^following$/i });
    await user.click(followingButton);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^follow$/i })).toBeInTheDocument(),
    );
  });

  it('rolls back the optimistic toggle and surfaces an error on mutation failure', async () => {
    server.use(
      http.get(`${API_URL}/users`, () => HttpResponse.json({ items: [makeUserSummary()] })),
      http.post(
        `${API_URL}/users/${otherUser.username}/follow`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderWithClient(<ExplorePage />);
    search('bob');

    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^follow$/i }));

    // Optimistic flip happens immediately, then rolls back once the mutation errors.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^follow$/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('mandatory: search, follow, and the timeline reflects the newly followed user', async () => {
    // No per-test overrides — the default MSW handlers are stateful (see test/msw/handlers.ts),
    // so following bob here is reflected on the next timeline refetch via the shared fixture store.
    const user = userEvent.setup();
    renderWithClient(
      <>
        <ExplorePage />
        <TimelineFeed />
      </>,
    );

    await waitFor(() => expect(screen.getByTestId('timeline-empty')).toBeInTheDocument());

    search('bob');
    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^follow$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^following$/i })).toBeInTheDocument(),
    );
    await waitFor(() => expect(screen.getByText("bob's default tweet")).toBeInTheDocument());
  });
});
