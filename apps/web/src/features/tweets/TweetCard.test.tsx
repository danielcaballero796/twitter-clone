import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { makeTweet } from '../../test/msw/handlers';
import TweetCard from './TweetCard';

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TweetCard tweet={makeTweet()} onDelete={() => {}} />} />
        <Route path="/u/:username" element={<p>Profile page for alice</p>} />
      </Routes>
    </MemoryRouter>,
  );
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
});
