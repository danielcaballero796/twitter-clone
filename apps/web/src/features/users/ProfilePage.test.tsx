import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import type { UserProfile } from '@twitterclone/shared';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL, makeTweet, mockAuthor, otherUser } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import { renderAuthApp } from '../../test/render-auth-app';
import ProfilePage from './ProfilePage';

function renderProfile(username: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/u/${username}`]}>
        <Routes>
          <Route path="/u/:username" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: otherUser.id,
    username: otherUser.username,
    displayName: otherUser.displayName,
    bio: 'Just here for the memes.',
    avatarUrl: otherUser.avatarUrl,
    followersCount: 10,
    followingCount: 5,
    tweetsCount: 2,
    isFollowing: false,
    ...overrides,
  };
}

function mockEmptyTweets(username: string) {
  server.use(
    http.get(`${API_URL}/users/${username}/tweets`, () =>
      HttpResponse.json({ items: [], nextCursor: null, hasMore: false }),
    ),
  );
}

describe('ProfilePage', () => {
  it('renders the header identity and counts with bio present', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () => HttpResponse.json(makeProfile())),
    );
    mockEmptyTweets(otherUser.username);

    renderProfile(otherUser.username);

    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByTestId('profile-bio')).toHaveTextContent('Just here for the memes.');
    expect(screen.getByTestId('profile-followers-count')).toHaveTextContent('10');
    expect(screen.getByTestId('profile-following-count')).toHaveTextContent('5');
    expect(screen.getByTestId('profile-tweets-count')).toHaveTextContent('2');
  });

  it('renders the header without a bio element when bio is absent', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () =>
        HttpResponse.json(makeProfile({ bio: null })),
      ),
    );
    mockEmptyTweets(otherUser.username);

    renderProfile(otherUser.username);

    await waitFor(() => expect(screen.getByText('Bob')).toBeInTheDocument());
    expect(screen.queryByTestId('profile-bio')).not.toBeInTheDocument();
  });

  it("renders the user's tweets via TweetCard in API order", async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () => HttpResponse.json(makeProfile())),
      http.get(`${API_URL}/users/${otherUser.username}/tweets`, () =>
        HttpResponse.json({
          items: [
            makeTweet({ id: 't1', content: 'first tweet', author: otherUser }),
            makeTweet({ id: 't2', content: 'second tweet', author: otherUser }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
    );

    renderProfile(otherUser.username);

    await waitFor(() => expect(screen.getByText('first tweet')).toBeInTheDocument());
    const contents = screen.getAllByTestId('tweet-content').map((node) => node.textContent);
    expect(contents).toEqual(['first tweet', 'second tweet']);
  });

  it('shows a loading indicator while the profile request is in flight', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, async () => {
        await delay(150);
        return HttpResponse.json(makeProfile());
      }),
    );
    mockEmptyTweets(otherUser.username);

    renderProfile(otherUser.username);

    expect(screen.getByTestId('profile-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('profile-loading')).not.toBeInTheDocument());
  });

  it('shows an error state when the profile request fails with a non-404 error', async () => {
    server.use(
      http.get(
        `${API_URL}/users/${otherUser.username}`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    mockEmptyTweets(otherUser.username);

    renderProfile(otherUser.username);

    await waitFor(() => expect(screen.getByTestId('profile-error')).toBeInTheDocument());
    expect(screen.queryByTestId('profile-not-found')).not.toBeInTheDocument();
  });

  it('shows a distinct not-found state when the profile request 404s', async () => {
    server.use(
      http.get(
        `${API_URL}/users/ghost`,
        () => new HttpResponse(JSON.stringify({ message: 'User not found' }), { status: 404 }),
      ),
    );
    mockEmptyTweets('ghost');

    renderProfile('ghost');

    await waitFor(() => expect(screen.getByTestId('profile-not-found')).toBeInTheDocument());
    expect(screen.queryByTestId('profile-error')).not.toBeInTheDocument();
  });

  it('flips the follow button optimistically and increments followersCount', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () =>
        HttpResponse.json(makeProfile({ isFollowing: false, followersCount: 10 })),
      ),
      http.post(`${API_URL}/users/${otherUser.username}/follow`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true });
      }),
    );
    mockEmptyTweets(otherUser.username);

    const user = userEvent.setup();
    renderProfile(otherUser.username);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^follow$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-followers-count')).toHaveTextContent('10');

    await user.click(screen.getByRole('button', { name: /^follow$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^following$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-followers-count')).toHaveTextContent('11');
  });

  it('flips the unfollow button optimistically and decrements followersCount', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () =>
        HttpResponse.json(makeProfile({ isFollowing: true, followersCount: 10 })),
      ),
      http.delete(`${API_URL}/users/${otherUser.username}/follow`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true });
      }),
    );
    mockEmptyTweets(otherUser.username);

    const user = userEvent.setup();
    renderProfile(otherUser.username);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^following$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-followers-count')).toHaveTextContent('10');

    await user.click(screen.getByRole('button', { name: /^following$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^follow$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-followers-count')).toHaveTextContent('9');
  });

  it('rolls back both the button and followersCount and surfaces an error on mutation failure', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () =>
        HttpResponse.json(makeProfile({ isFollowing: false, followersCount: 10 })),
      ),
      http.post(
        `${API_URL}/users/${otherUser.username}/follow`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    mockEmptyTweets(otherUser.username);

    const user = userEvent.setup();
    renderProfile(otherUser.username);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^follow$/i })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: /^follow$/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^follow$/i })).toBeInTheDocument(),
    );
    expect(screen.getByTestId('profile-followers-count')).toHaveTextContent('10');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders no follow/unfollow button on the session user own profile', async () => {
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({
          id: mockAuthor.id,
          email: 'alice@example.com',
          username: mockAuthor.username,
          displayName: mockAuthor.displayName,
          bio: null,
          avatarUrl: mockAuthor.avatarUrl,
        }),
      ),
      http.get(`${API_URL}/users/${mockAuthor.username}`, () =>
        HttpResponse.json(
          makeProfile({
            id: mockAuthor.id,
            username: mockAuthor.username,
            displayName: mockAuthor.displayName,
            avatarUrl: mockAuthor.avatarUrl,
            isFollowing: false,
          }),
        ),
      ),
    );
    mockEmptyTweets(mockAuthor.username);

    renderProfile(mockAuthor.username);

    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^follow$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^following$/i })).not.toBeInTheDocument();
  });

  it('flips a like optimistically on a TweetCard from the user-tweets cache, with rollback on failure', async () => {
    server.use(
      http.get(`${API_URL}/users/${otherUser.username}`, () => HttpResponse.json(makeProfile())),
      http.get(`${API_URL}/users/${otherUser.username}/tweets`, () =>
        HttpResponse.json({
          items: [
            makeTweet({ id: 't1', content: 'first tweet', author: otherUser, likesCount: 2 }),
          ],
          nextCursor: null,
          hasMore: false,
        }),
      ),
      http.post(`${API_URL}/tweets/t1/like`, () => new HttpResponse(null, { status: 500 })),
    );

    const user = userEvent.setup();
    renderProfile(otherUser.username);

    await waitFor(() => expect(screen.getByText('first tweet')).toBeInTheDocument());
    const likeButton = screen.getByTestId('tweet-like-button');
    expect(likeButton).toHaveTextContent('2');

    await user.click(likeButton);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
    expect(likeButton).toHaveTextContent('2');
  });

  it('removes a deleted own tweet from the profile tweet list', async () => {
    let tweets = [makeTweet({ id: 'mine', content: 'delete me from profile', author: mockAuthor })];
    server.use(
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json({
          id: mockAuthor.id,
          email: 'alice@example.com',
          username: mockAuthor.username,
          displayName: mockAuthor.displayName,
          bio: null,
          avatarUrl: mockAuthor.avatarUrl,
        }),
      ),
      http.get(`${API_URL}/users/${mockAuthor.username}`, () =>
        HttpResponse.json(
          makeProfile({
            id: mockAuthor.id,
            username: mockAuthor.username,
            displayName: mockAuthor.displayName,
            avatarUrl: mockAuthor.avatarUrl,
            isFollowing: false,
          }),
        ),
      ),
      http.get(`${API_URL}/users/${mockAuthor.username}/tweets`, () =>
        HttpResponse.json({ items: tweets, nextCursor: null, hasMore: false }),
      ),
      http.delete(`${API_URL}/tweets/mine`, () => {
        tweets = tweets.filter((tweet) => tweet.id !== 'mine');
        return HttpResponse.json({ success: true });
      }),
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const user = userEvent.setup();
    renderProfile(mockAuthor.username);

    await waitFor(() => expect(screen.getByText('delete me from profile')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /delete tweet/i }));

    await waitFor(() =>
      expect(screen.queryByText('delete me from profile')).not.toBeInTheDocument(),
    );

    confirmSpy.mockRestore();
  });

  it('redirects to login when navigating to /u/:username unauthenticated', async () => {
    // Default MSW handler returns 401 for /auth/me — no session.
    renderAuthApp(`/u/${otherUser.username}`);

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /log in/i })).toBeInTheDocument(),
    );
  });
});
