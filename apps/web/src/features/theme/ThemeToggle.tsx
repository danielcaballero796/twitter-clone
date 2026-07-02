import { MoonIcon, SunIcon } from '../../components/icons';
import { useTheme } from './useTheme';

/** Icon button that toggles the resolved light/dark theme; sun shown in dark mode, moon in light. */
export default function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-600 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 dark:focus-visible:ring-offset-slate-950"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
