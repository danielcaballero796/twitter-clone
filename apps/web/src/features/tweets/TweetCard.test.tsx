import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import type { PublicTweet } from '@twitterclone/shared';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL, makeTweet } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import TweetCard from './TweetCard';

function renderCard(
  tweet: PublicTweet = makeTweet(),
  options: { onDelete?: (id: string) => void; sessionUserId?: string } = {},
) {
  const { onDelete = () => {}, sessionUserId } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={<TweetCard tweet={tweet} sessionUserId={sessionUserId} onDelete={onDelete} />}
          />
          <Route path="/u/:username" element={<p>Profile page for alice</p>} />
          <Route path="/t/:id" element={<p>Thread page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

describe('TweetCard', () => {
  it('navigates to /u/:username when the author name/handle is clicked', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByText('Alice'));

    expect(await screen.findByText('Profile page for alice')).toBeInTheDocument();
  });

  it('keeps the existing tweet-content testid and structure unchanged', () => {
    renderCard();

    expect(screen.getByTestId('tweet-content')).toHaveTextContent('A default tweet');
    expect(screen.getByText('@alice')).toBeInTheDocument();
  });

  it('renders a like button with the count, including zero', () => {
    renderCard(makeTweet({ likesCount: 0, likedByMe: false }));

    const likeButton = screen.getByTestId('tweet-like-button');
    expect(likeButton).toHaveTextContent('0');
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a non-zero count distinguishable from zero', () => {
    renderCard(makeTweet({ likesCount: 3, likedByMe: false }));

    expect(screen.getByTestId('tweet-like-button')).toHaveTextContent('3');
  });

  it('flips to liked optimistically and increments the count on click', async () => {
    server.use(
      http.post(`${API_URL}/tweets/tweet-1/like`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderCard(makeTweet({ likesCount: 2, likedByMe: false }));

    const likeButton = screen.getByTestId('tweet-like-button');
    await user.click(likeButton);

    await waitFor(() => expect(likeButton).toHaveAttribute('aria-pressed', 'true'));
    expect(likeButton).toHaveTextContent('3');
  });

  it('flips to not-liked optimistically and decrements the count on click', async () => {
    server.use(
      http.delete(`${API_URL}/tweets/tweet-1/like`, async () => {
        await delay(50);
        return HttpResponse.json({ success: true });
      }),
    );
    const user = userEvent.setup();
    renderCard(makeTweet({ likesCount: 3, likedByMe: true }));

    const likeButton = screen.getByTestId('tweet-like-button');
    await user.click(likeButton);

    await waitFor(() => expect(likeButton).toHaveAttribute('aria-pressed', 'false'));
    expect(likeButton).toHaveTextContent('2');
  });

  it('rolls back the button state and count and surfaces an error on mutation failure', async () => {
    server.use(
      http.post(`${API_URL}/tweets/tweet-1/like`, () => new HttpResponse(null, { status: 500 })),
    );
    const user = userEvent.setup();
    renderCard(makeTweet({ likesCount: 2, likedByMe: false }));

    const likeButton = screen.getByTestId('tweet-like-button');
    await user.click(likeButton);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(likeButton).toHaveAttribute('aria-pressed', 'false');
    expect(likeButton).toHaveTextContent('2');
  });

  it('renders the reply count and a link to the thread page', async () => {
    const user = userEvent.setup();
    renderCard(makeTweet({ id: 'tweet-1', replyCount: 5 }));

    const replyLink = screen.getByRole('link', { name: /5 replies, open thread/i });
    expect(replyLink).toHaveTextContent('5');

    await user.click(replyLink);

    expect(await screen.findByText('Thread page')).toBeInTheDocument();
  });

  it('shows singular reply label for a reply count of one', () => {
    renderCard(makeTweet({ replyCount: 1 }));

    expect(screen.getByRole('link', { name: /1 replies, open thread/i })).toBeInTheDocument();
  });

  it('renders a "Replying to @user" marker linking to the parent thread when inReplyTo is set', () => {
    renderCard(makeTweet({ inReplyTo: { id: 'parent-1', username: 'ada' } }));

    const marker = screen.getByRole('link', { name: '@ada' });
    expect(marker).toHaveAttribute('href', '/t/parent-1');
    expect(screen.getByText(/replying to/i)).toBeInTheDocument();
  });

  it('does not render a reply marker when inReplyTo is null', () => {
    renderCard(makeTweet({ inReplyTo: null }));

    expect(screen.queryByText(/replying to/i)).not.toBeInTheDocument();
  });

  it('shows the plain delete confirmation when replyCount is 0', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const tweet = makeTweet({ id: 'tweet-1', replyCount: 0 });
    renderCard(tweet, { sessionUserId: tweet.author.id });

    await user.click(screen.getByRole('button', { name: /delete tweet/i }));

    expect(confirmSpy).toHaveBeenCalledWith('Delete this tweet?');
    confirmSpy.mockRestore();
  });

  it('shows a cascade-aware delete confirmation referencing the reply count when replies exist', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const tweet = makeTweet({ id: 'tweet-1', replyCount: 3 });
    renderCard(tweet, { sessionUserId: tweet.author.id });

    await user.click(screen.getByRole('button', { name: /delete tweet/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this tweet and its 3 replies? This cannot be undone.',
    );
    confirmSpy.mockRestore();
  });

  it('uses singular "reply" wording when replyCount is exactly one', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    const tweet = makeTweet({ id: 'tweet-1', replyCount: 1 });
    renderCard(tweet, { sessionUserId: tweet.author.id });

    await user.click(screen.getByRole('button', { name: /delete tweet/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'Delete this tweet and its 1 reply? This cannot be undone.',
    );
    confirmSpy.mockRestore();
  });
});
