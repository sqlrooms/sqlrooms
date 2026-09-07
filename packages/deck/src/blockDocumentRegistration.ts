import type {
  BlockDocumentStatefulBlockCommandType,
  BlockDocumentStatefulBlockType,
} from '@sqlrooms/documents';
import type {DuckDbSliceState} from '@sqlrooms/duckdb';
import type {DeckMapsSliceState} from './DeckMapsSlice';
import {DeckMapBlockSettings} from './BlockMapSettings';
import {ensureDeckMapResourceState} from './block';

export const DECK_MAP_BLOCK_TYPE = 'map';
export const DECK_MAP_BLOCK_DEFAULT_TITLE = 'Embedded Map';
export const DECK_MAP_BLOCK_DEFAULT_HEIGHT = 560;

/**
 * Options for configuring Deck map block document registration. Hosts pass
 * these to `createDeckMapBlockDocumentType` / `createDeckMapBlockDocumentCommandType`.
 */
export type DeckMapBlockDocumentRegistrationOptions<TState> = {
  /** Product label for the map block (defaults to "Map"). */
  label?: string;
  /** Description shown in block pickers. */
  description?: string;
  /** Default caption/title used when ensuring state. */
  defaultTitle?: string;
  /** Default height in pixels for the map block. */
  defaultHeight?: number;
  /** Minimum resizable height in pixels. */
  minHeight?: number;
  /** Maximum resizable height in pixels. */
  maxHeight?: number;
  /**
   * Called after Deck map state is ensured. Hosts can add product-specific
   * side effects; delete/remove stays host-owned.
   */
  afterEnsureState?: (options: {
    state: TState;
    blockInstanceId: string;
    title: string;
  }) => void;
};

/**
 * Builds the shared TipTap/UI registration metadata for a Deck map stateful
 * block. Hosts still own renderer maps, delete handlers, and product labels.
 */
export function createDeckMapBlockDocumentType<
  TState extends DeckMapsSliceState & DuckDbSliceState,
>(
  options: DeckMapBlockDocumentRegistrationOptions<TState> & {
    getState: () => TState;
  },
): BlockDocumentStatefulBlockType {
  const {
    getState,
    label = 'Map',
    description = 'Embedded Deck.gl map',
    defaultTitle = DECK_MAP_BLOCK_DEFAULT_TITLE,
    defaultHeight = DECK_MAP_BLOCK_DEFAULT_HEIGHT,
    minHeight = 360,
    maxHeight = 1600,
    afterEnsureState,
  } = options;

  return {
    blockType: DECK_MAP_BLOCK_TYPE,
    label,
    description,
    resizableHeight: true,
    defaultHeight,
    minHeight,
    maxHeight,
    requireScrollModifier: true,
    scrollHintLabel: 'this map',
    settings: DeckMapBlockSettings,
    hasOwnHeaderActions: true,
    createNode: (blockId) => {
      const state = getState();
      ensureDeckMapResourceState(state, blockId, defaultTitle);
      afterEnsureState?.({
        state,
        blockInstanceId: blockId,
        title: defaultTitle,
      });

      return {
        type: 'blockDocumentStatefulBlock',
        attrs: {
          id: blockId,
          blockType: DECK_MAP_BLOCK_TYPE,
          blockInstanceId: blockId,
          ownership: 'owned',
          caption: '',
          height: defaultHeight,
        },
      };
    },
  };
}

/**
 * Builds the shared command-type registration for a Deck map stateful block.
 */
export function createDeckMapBlockDocumentCommandType<
  TState extends DeckMapsSliceState & DuckDbSliceState,
>(
  options: DeckMapBlockDocumentRegistrationOptions<TState> = {},
): BlockDocumentStatefulBlockCommandType<TState> {
  const {
    label = 'Map',
    description = 'Embedded Deck.gl map',
    defaultTitle = DECK_MAP_BLOCK_DEFAULT_TITLE,
    defaultHeight = DECK_MAP_BLOCK_DEFAULT_HEIGHT,
    afterEnsureState,
  } = options;

  return {
    blockType: DECK_MAP_BLOCK_TYPE,
    label,
    description,
    defaultTitle,
    defaultHeight,
    ensureState: ({state, blockInstanceId, title}) => {
      const resolvedTitle = title ?? defaultTitle;
      ensureDeckMapResourceState(state, blockInstanceId, resolvedTitle);
      afterEnsureState?.({
        state,
        blockInstanceId,
        title: resolvedTitle,
      });
    },
  };
}
