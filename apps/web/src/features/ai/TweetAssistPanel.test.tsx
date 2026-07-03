import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import type { TweetAssistRequest } from '@twitterclone/shared';
import { API_URL } from '../../test/msw/handlers';
import { server } from '../../test/msw/server';
import TweetAssistPanel from './TweetAssistPanel';

function renderPanel(draft: string, callbacks?: Partial<Parameters<typeof TweetAssistPanel>[0]>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onReplace = vi.fn();
  const onInsert = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <TweetAssistPanel draft={draft} onReplace={onReplace} onInsert={onInsert} {...callbacks} />
    </QueryClientProvider>,
  );
  return { onReplace, onInsert };
}

const LONG_DRAFT = 'launched my app today finally after months of work';

describe('TweetAssistPanel', () => {
  it('disables every action for drafts under the minimum length', () => {
    renderPanel('short draft');

    for (const label of ['Improve', 'Shorten', 'Fix grammar', 'More engaging']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
  });

  it('shows a loading state and then the suggestion, sending the right action', async () => {
    let received: TweetAssistRequest | undefined;
    server.use(
      http.post(`${API_URL}/ai/tweet-assist`, async ({ request }) => {
        received = (await request.json()) as TweetAssistRequest;
        await delay(50);
        return HttpResponse.json({ suggestion: 'I finally launched my app today 🚀' });
      }),
    );
    renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'Improve' }));

    expect(screen.getByTestId('assist-loading')).toHaveAttribute('role', 'status');
    expect(await screen.findByTestId('assist-suggestion')).toHaveTextContent(
      'I finally launched my app today 🚀',
    );
    expect(received).toEqual({ text: LONG_DRAFT, action: 'improve' });
  });

  it('Use suggestion replaces the draft and dismisses the panel', async () => {
    const { onReplace } = renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'Shorten' }));
    await screen.findByTestId('assist-suggestion');
    await userEvent.click(screen.getByRole('button', { name: 'Use suggestion' }));

    expect(onReplace).toHaveBeenCalledWith('A default AI suggestion');
    expect(screen.queryByTestId('assist-suggestion')).not.toBeInTheDocument();
  });

  it('Insert appends the suggestion via onInsert', async () => {
    const { onInsert } = renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'Improve' }));
    await screen.findByTestId('assist-suggestion');
    await userEvent.click(screen.getByRole('button', { name: 'Insert' }));

    expect(onInsert).toHaveBeenCalledWith('A default AI suggestion');
  });

  it('Regenerate repeats the last action', async () => {
    const actions: string[] = [];
    server.use(
      http.post(`${API_URL}/ai/tweet-assist`, async ({ request }) => {
        const body = (await request.json()) as TweetAssistRequest;
        actions.push(body.action);
        return HttpResponse.json({ suggestion: `suggestion #${actions.length}` });
      }),
    );
    renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'More engaging' }));
    await screen.findByTestId('assist-suggestion');
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate' }));

    await waitFor(() =>
      expect(screen.getByTestId('assist-suggestion')).toHaveTextContent('suggestion #2'),
    );
    expect(actions).toEqual(['more-engaging', 'more-engaging']);
  });

  it('shows a generic alert when the provider fails', async () => {
    server.use(
      http.post(`${API_URL}/ai/tweet-assist`, () => new HttpResponse(null, { status: 502 })),
    );
    renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'Improve' }));

    const alert = await screen.findByTestId('assist-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(/could not generate a suggestion/i);
  });

  it('explains when AI assistance is not configured (503)', async () => {
    server.use(
      http.post(`${API_URL}/ai/tweet-assist`, () => new HttpResponse(null, { status: 503 })),
    );
    renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'Improve' }));

    expect(await screen.findByTestId('assist-error')).toHaveTextContent(
      /not available on this server/i,
    );
  });

  it('explains when the free quota ran out (429)', async () => {
    server.use(
      http.post(`${API_URL}/ai/tweet-assist`, () => new HttpResponse(null, { status: 429 })),
    );
    renderPanel(LONG_DRAFT);

    await userEvent.click(screen.getByRole('button', { name: 'Improve' }));

    expect(await screen.findByTestId('assist-error')).toHaveTextContent(/used up its free quota/i);
  });
});
