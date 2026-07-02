import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theflock:theme';

function readStoredTheme(): ResolvedTheme | null {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' || stored === 'light' ? stored : null;
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyResolvedTheme(resolved: ResolvedTheme) {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

/**
 * Theme model: 'light' | 'dark' | 'system'. `theflock:theme` in localStorage stores ONLY an
 * explicit 'light'/'dark' choice — its absence means 'system'. In system mode the resolved
 * theme tracks the OS `prefers-color-scheme` media query live.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? 'system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    const stored = readStoredTheme();
    return stored ?? (systemPrefersDark() ? 'dark' : 'light');
  });

  useEffect(() => {
    applyResolvedTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }
    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
    // Read `matches` off the live MediaQueryList rather than the event — some environments
    // (and this project's jsdom test stub) dispatch a plain `change` Event without a `matches`
    // property, whereas the MediaQueryList itself is always current at the time it fires.
    function handleChange() {
      setResolvedTheme(mediaQueryList.matches ? 'dark' : 'light');
    }
    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, [theme]);

  const toggle = useCallback(() => {
    setResolvedTheme((current) => {
      const next: ResolvedTheme = current === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      setTheme(next);
      return next;
    });
  }, []);

  return { theme, resolvedTheme, toggle };
}
