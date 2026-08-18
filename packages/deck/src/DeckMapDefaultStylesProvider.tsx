import type {ResolvedTheme} from '@sqlrooms/ui';
import type {MapProps} from 'react-map-gl/maplibre';
import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

/** A MapLibre-compatible style accepted by the Deck map renderer. */
export type DeckMapStyle = NonNullable<MapProps['mapStyle']>;

/** Optional host-provided basemap defaults keyed by resolved UI theme. */
export type DeckMapDefaultStyles = Partial<Record<ResolvedTheme, DeckMapStyle>>;

const DeckMapDefaultStylesContext = createContext<
  DeckMapDefaultStyles | undefined
>(undefined);

/**
 * Supplies host-owned, theme-aware basemap defaults without persisting them in
 * individual map resources. Explicit map config styles still take precedence.
 */
export const DeckMapDefaultStylesProvider: FC<
  PropsWithChildren<{styles: DeckMapDefaultStyles}>
> = ({styles, children}) => (
  <DeckMapDefaultStylesContext.Provider value={styles}>
    {children}
  </DeckMapDefaultStylesContext.Provider>
);

/** Returns theme-aware host map defaults from the nearest provider, if any. */
export function useDeckMapDefaultStyles() {
  return useContext(DeckMapDefaultStylesContext);
}

/** True for `mapbox://` style URLs (MapLibre cannot load them without a token). */
export function isMapboxStyleUrl(style: unknown): boolean {
  return typeof style === 'string' && /^mapbox:/i.test(style.trim());
}

function usableMapStyle(
  style: string | MapProps['mapStyle'] | undefined,
): DeckMapStyle | undefined {
  if (style == null || isMapboxStyleUrl(style)) return undefined;
  return style as DeckMapStyle;
}

/** Resolve map style; skips `mapbox://` so the map can still load. */
export function resolveDeckMapStyle(options: {
  mapStyle?: string;
  mapPropsMapStyle?: MapProps['mapStyle'];
  hostDefaultStyles?: DeckMapDefaultStyles;
  resolvedTheme: ResolvedTheme;
  fallbackStyles: Record<ResolvedTheme, string>;
}): DeckMapStyle {
  return (
    usableMapStyle(options.mapStyle) ??
    usableMapStyle(options.mapPropsMapStyle) ??
    usableMapStyle(options.hostDefaultStyles?.[options.resolvedTheme]) ??
    options.fallbackStyles[options.resolvedTheme]
  );
}
