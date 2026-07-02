import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeUserSummary } from '../../test/msw/handlers';
import UserCard from './UserCard';

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/explore']}>
        <Routes>
          <Route path="/explore" element={<UserCard user={makeUserSummary()} />} />
          <Route path="/u/:username" element={<p>Profile page for bob</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('UserCard', () => {
  it('navigates to /u/:username when the display-name block is clicked', async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByText('Bob'));

    expect(await screen.findByText('Profile page for bob')).toBeInTheDocument();
  });
});
