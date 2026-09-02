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
