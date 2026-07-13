import type {ResolvedTheme} from '@sqlrooms/ui';
import type {MapProps} from 'react-map-gl/maplibre';
import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

export type DeckMapStyle = NonNullable<MapProps['mapStyle']>;
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

export function useDeckMapDefaultStyles() {
  return useContext(DeckMapDefaultStylesContext);
}

export function resolveDeckMapStyle(options: {
  mapStyle?: string;
  mapPropsMapStyle?: MapProps['mapStyle'];
  hostDefaultStyles?: DeckMapDefaultStyles;
  resolvedTheme: ResolvedTheme;
  fallbackStyles: Record<ResolvedTheme, string>;
}): DeckMapStyle {
  return (
    options.mapStyle ??
    options.mapPropsMapStyle ??
    options.hostDefaultStyles?.[options.resolvedTheme] ??
    options.fallbackStyles[options.resolvedTheme]
  );
}
