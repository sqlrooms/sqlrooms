import type {DeckMapDefaultStyles} from './basemap';
import {
  createContext,
  useContext,
  type FC,
  type PropsWithChildren,
} from 'react';

const DeckMapDefaultStylesContext = createContext<
  DeckMapDefaultStyles | undefined
>(undefined);

/**
 * Supplies host-owned, theme-aware basemap defaults without persisting them in
 * individual map resources. The required `styles` object is keyed by `light`
 * and/or `dark`. Explicit map styles and basemap callbacks take precedence.
 *
 * @deprecated Configure `basemapProvider` on `createDeckMapsSlice` or pass it
 * directly to `DeckJsonMap` instead. Retained for backward compatibility.
 */
export const DeckMapDefaultStylesProvider: FC<
  PropsWithChildren<{styles: DeckMapDefaultStyles}>
> = ({styles, children}) => (
  <DeckMapDefaultStylesContext.Provider value={styles}>
    {children}
  </DeckMapDefaultStylesContext.Provider>
);

/**
 * Returns theme-aware host map defaults from the nearest provider, if any.
 *
 * @deprecated Use the room's `deckMaps.basemapProvider` or an explicitly supplied
 * basemap callback instead. Retained for backward compatibility.
 */
export function useDeckMapDefaultStyles() {
  return useContext(DeckMapDefaultStylesContext);
}
