import type {ResolvedTheme} from '@sqlrooms/ui';
import type {MapProps} from 'react-map-gl/maplibre';
import {getDeckMapStyleTheme} from './mapStyles';
import {createProtomapsDefaultStyles} from './protomapsStyles';
import {
  createContext,
  useContext,
  useMemo,
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
  PropsWithChildren<{
    /** Optional custom defaults, overriding the corresponding Protomaps themes. */
    styles?: DeckMapDefaultStyles;
    /** Browser-visible Protomaps API key; never persisted in map resources. */
    protomapsApiKey?: string;
  }>
> = ({styles, protomapsApiKey, children}) => {
  const defaults = useMemo(
    () => ({
      ...(protomapsApiKey?.trim()
        ? createProtomapsDefaultStyles(protomapsApiKey.trim())
        : {}),
      ...styles,
    }),
    [protomapsApiKey, styles],
  );
  return (
    <DeckMapDefaultStylesContext.Provider value={defaults}>
      {children}
    </DeckMapDefaultStylesContext.Provider>
  );
};

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
  fallbackStyles: Record<ResolvedTheme, DeckMapStyle>;
}): DeckMapStyle {
  const selectedStyle =
    usableMapStyle(options.mapStyle) ??
    usableMapStyle(options.mapPropsMapStyle);
  const selectedTheme = getDeckMapStyleTheme(selectedStyle);
  if (selectedTheme) {
    return (
      usableMapStyle(options.hostDefaultStyles?.[selectedTheme]) ??
      options.fallbackStyles[selectedTheme]
    );
  }
  return (
    selectedStyle ??
    usableMapStyle(options.hostDefaultStyles?.[options.resolvedTheme]) ??
    options.fallbackStyles[options.resolvedTheme]
  );
}
