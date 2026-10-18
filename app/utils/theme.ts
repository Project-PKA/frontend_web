/** The values the API stores in the profile (`theme`). */
export const THEMES = ['SYSTEM', 'DARK', 'LIGHT'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'SYSTEM';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/**
 * Applies the theme the way the design system expects: `data-theme="light"` or
 * `"dark"` on the root element, and no attribute for "system" so the tokens follow
 * `prefers-color-scheme`.
 */
export function applyTheme(theme: Theme, root: HTMLElement): void {
  if (theme === 'SYSTEM') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme.toLowerCase());
}
