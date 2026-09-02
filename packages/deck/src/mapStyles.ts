import {getTheme, type ResolvedTheme} from '@sqlrooms/ui';

/** Built-in basemaps offered in map settings. IDs are persisted in map configs. */
export const DECK_MAP_BASEMAP_STYLES = [
  {id: 'light', label: 'Light', theme: 'light'},
  {id: 'dark', label: 'Dark', theme: 'dark'},
] as const;

/** Returns the theme variant for a built-in basemap ID, if recognized. */
export function getDeckMapStyleTheme(
  style: unknown,
): ResolvedTheme | undefined {
  // Preserve selections saved by early versions of the Protomaps defaults.
  if (style === 'protomaps-light') return 'light';
  if (style === 'protomaps-dark') return 'dark';
  return DECK_MAP_BASEMAP_STYLES.find((candidate) => candidate.id === style)
    ?.theme;
}

function getCurrentTheme(): ResolvedTheme {
  // ThemeProvider applies the resolved theme here, including hosts with a
  // custom storage key and default theme (such as the CLI).
  if (typeof document !== 'undefined') {
    if (document.documentElement.classList.contains('dark')) return 'dark';
    if (document.documentElement.classList.contains('light')) return 'light';
  }
  return getTheme();
}

/** Snapshots the current app theme as a portable basemap ID at map creation. */
export function getDefaultDeckMapStyle(
  theme: ResolvedTheme = getCurrentTheme(),
): string {
  return theme;
}
