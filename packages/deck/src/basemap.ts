import type {ResolvedTheme} from '@sqlrooms/ui';
import type {MapProps} from 'react-map-gl/maplibre';
import {getDeckMapStyleTheme} from './mapStyles';

/** A MapLibre-compatible style accepted by the Deck map renderer. */
export type DeckMapStyle = NonNullable<MapProps['mapStyle']>;

/** Optional host-provided basemap defaults keyed by resolved UI theme. */
export type DeckMapDefaultStyles = Partial<Record<ResolvedTheme, DeckMapStyle>>;

/**
 * Resolves a basemap's light/dark variant. Return stable style objects or URLs,
 * or undefined to use host defaults. Providers and credentials are runtime-only.
 */
export type DeckMapBasemapProvider = (
  theme: ResolvedTheme,
) => DeckMapStyle | undefined;

/** True for `mapbox://` style URLs (MapLibre cannot load them without a token). */
export function isMapboxStyleUrl(style: unknown): boolean {
  return typeof style === 'string' && /^mapbox:/i.test(style.trim());
}

function usableMapStyle(style: MapProps['mapStyle']): DeckMapStyle | undefined {
  if (style == null || isMapboxStyleUrl(style)) return undefined;
  return style;
}

/** Resolves explicit styles, a basemap provider, host defaults, then the fallback. */
export function resolveDeckMapStyle(options: {
  mapStyle?: string;
  mapPropsMapStyle?: MapProps['mapStyle'];
  basemapProvider?: DeckMapBasemapProvider;
  hostDefaultStyles?: DeckMapDefaultStyles;
  resolvedTheme: ResolvedTheme;
  fallbackStyles: Record<ResolvedTheme, DeckMapStyle>;
}): DeckMapStyle {
  const selectedStyle =
    usableMapStyle(options.mapStyle) ??
    usableMapStyle(options.mapPropsMapStyle);
  const selectedTheme = getDeckMapStyleTheme(selectedStyle);
  if (selectedStyle !== undefined && !selectedTheme) return selectedStyle;
  const theme = selectedTheme ?? options.resolvedTheme;
  return (
    usableMapStyle(options.basemapProvider?.(theme)) ??
    usableMapStyle(options.hostDefaultStyles?.[theme]) ??
    options.fallbackStyles[theme]
  );
}
