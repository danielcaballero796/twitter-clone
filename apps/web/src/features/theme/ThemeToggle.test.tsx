import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';
import { THEME_STORAGE_KEY } from './useTheme';

function setSystemPrefersDark(matches: boolean) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  Object.defineProperty(mql, 'matches', { value: matches, configurable: true });
}

describe('ThemeToggle', () => {
  it('renders a button with the theme-toggle testid and an aria-label matching the resolved theme', () => {
    setSystemPrefersDark(false);
    render(<ThemeToggle />);

    const button = screen.getByTestId('theme-toggle');
    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('aria-label', 'Switch to dark theme');
  });

  it('flips the aria-label after being activated', async () => {
    setSystemPrefersDark(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));

    expect(screen.getByTestId('theme-toggle')).toHaveAttribute(
      'aria-label',
      'Switch to light theme',
    );
  });

  it('applies the dark class to <html> and persists the choice to localStorage when activated via keyboard', async () => {
    setSystemPrefersDark(false);
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = screen.getByTestId('theme-toggle');
    button.focus();
    await user.keyboard('{Enter}');

    expect(button).toHaveAttribute('aria-label', 'Switch to light theme');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
