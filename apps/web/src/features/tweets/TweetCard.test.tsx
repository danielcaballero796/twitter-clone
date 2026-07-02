import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import type { PublicTweet } from '@twitterclone/shared';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { API_URL, makeTweet } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import TweetCard from './TweetCard';

function renderCard(tweet: PublicTweet = makeTweet()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TweetCard tweet={tweet} onDelete={() => {}} />} />
          <Route path="/u/:username" element={<p>Profile page for alice</p>} />
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
});
