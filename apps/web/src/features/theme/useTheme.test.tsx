import { act, renderHook } from '@testing-library/react';
import { useTheme } from './useTheme';

const THEME_KEY = 'theflock:theme';

function setSystemPrefersDark(matches: boolean) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  Object.defineProperty(mql, 'matches', { value: matches, configurable: true });
}

describe('useTheme', () => {
  it('defaults to system light when nothing is stored and OS prefers light', () => {
    setSystemPrefersDark(false);

    const { result } = renderHook(() => useTheme());

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggling to dark applies the class and persists the explicit choice', () => {
    setSystemPrefersDark(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('dark');
  });

  it('toggling back to light removes the class and persists the explicit choice', () => {
    setSystemPrefersDark(false);
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.toggle();
    });
    act(() => {
      result.current.toggle();
    });

    expect(result.current.resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('applies a stored dark theme immediately on mount', () => {
    window.localStorage.setItem(THEME_KEY, 'dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reacts to a live OS preference change while in system mode, without writing localStorage', () => {
    setSystemPrefersDark(false);
    renderHook(() => useTheme());
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    act(() => {
      Object.defineProperty(mql, 'matches', { value: true, configurable: true });
      mql.dispatchEvent(new Event('change'));
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_KEY)).toBeNull();
  });
});
