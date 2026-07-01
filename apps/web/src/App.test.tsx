import { render, screen } from '@testing-library/react';
import App from './App';

describe('App shell', () => {
  it('renders the shell without runtime errors', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: /twitter clone/i })).toBeInTheDocument();
    expect(screen.getByTestId('shell-status')).toHaveTextContent('ok');
  });
});
