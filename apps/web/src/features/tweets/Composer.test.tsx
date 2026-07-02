import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { API_URL, makeTweet, mockAuthor } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import Composer from './Composer';
import TimelineFeed from './TimelineFeed';

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
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

describe('Composer', () => {
  it('updates the remaining character counter live while typing', async () => {
    const user = userEvent.setup();
    renderWithClient(<Composer />);

    expect(screen.getByTestId('composer-counter')).toHaveTextContent('280');

    await user.type(screen.getByPlaceholderText(/what's happening/i), 'hola');

    expect(screen.getByTestId('composer-counter')).toHaveTextContent('276');
  });

  it('blocks submission over 280 chars: disabled button, inline error, no request', async () => {
    let createCalled = false;
    server.use(
      http.post(`${API_URL}/tweets`, () => {
        createCalled = true;
        return HttpResponse.json(makeTweet(), { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithClient(<Composer />);

    const textarea = screen.getByPlaceholderText(/what's happening/i);
    await user.click(textarea);
    await user.paste('z'.repeat(281));

    expect(screen.getByTestId('composer-counter')).toHaveTextContent('-1');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /tweet/i });
    expect(submit).toBeDisabled();

    await user.click(submit);
    expect(createCalled).toBe(false);
  });

  it('creates a tweet and shows it at the top of the timeline without a reload', async () => {
    // Stateful mock — the created tweet must survive the post-mutation refetch.
    let tweets = [makeTweet({ id: 'existing-1', content: 'an older tweet' })];
    server.use(
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(sessionUser)),
      http.get(`${API_URL}/tweets/timeline`, () =>
        HttpResponse.json({ items: tweets, nextCursor: null, hasMore: false }),
      ),
      http.post(`${API_URL}/tweets`, () => {
        const created = makeTweet({ id: 'created-1', content: 'fresh off the composer' });
        tweets = [created, ...tweets];
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const user = userEvent.setup();
    renderWithClient(
      <>
        <Composer />
        <TimelineFeed />
      </>,
    );

    await waitFor(() => expect(screen.getByText('an older tweet')).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText(/what's happening/i), 'fresh off the composer');
    await user.click(screen.getByRole('button', { name: /^tweet$/i }));

    await waitFor(() => expect(screen.getByText('fresh off the composer')).toBeInTheDocument());

    const contents = screen.getAllByTestId('tweet-content').map((node) => node.textContent);
    expect(contents[0]).toBe('fresh off the composer');
    expect(contents).toContain('an older tweet');
  });
});
