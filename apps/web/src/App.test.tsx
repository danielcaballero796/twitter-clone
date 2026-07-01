import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  it('renders the shell and redirects unauthenticated users to the login page', async () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /twitter clone/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /log in/i })).toBeInTheDocument();
  });
});
