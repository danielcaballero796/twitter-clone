/** Shared className builder for header NavLinks — active route gets the accent color. */
export function navLinkClassName({ isActive }: { isActive: boolean }) {
  const base =
    'flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors duration-200 cursor-pointer';
  return isActive
    ? `${base} font-medium text-indigo-600 dark:text-indigo-400`
    : `${base} text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100`;
}
