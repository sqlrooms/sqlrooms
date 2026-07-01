import type {BaseRoomStoreState} from '@sqlrooms/room-store';
import {createSlice} from '@sqlrooms/room-store';
import {
  type BlockDocumentsSliceState,
  createBlockDocumentsSlice,
  type CreateBlockDocumentsSliceProps,
} from './BlockDocumentsSlice';
import {
  type BlockSettingsSliceState,
  createBlockSettingsSlice,
} from './block-settings/BlockSettingsSlice';

/**
 * Store state installed by the standard block document feature composer.
 */
export type BlockDocumentFeatureSlicesState = BlockDocumentsSliceState &
  BlockSettingsSliceState;

/**
 * Creates the store slices needed by block document surfaces with settings.
 *
 * This composes block document content state with the shared block/panel
 * settings selection state used by BlockSettingsPanelLayout.
 */
export function createBlockDocumentFeatureSlices<
  TRoomState extends BaseRoomStoreState & BlockDocumentFeatureSlicesState =
    BaseRoomStoreState & BlockDocumentFeatureSlicesState,
>(props: CreateBlockDocumentsSliceProps<TRoomState> = {}) {
  return createSlice<BlockDocumentFeatureSlicesState, TRoomState>(
    (set, get, store) => ({
      ...createBlockDocumentsSlice<TRoomState>(props)(set, get, store),
      ...createBlockSettingsSlice<TRoomState>()(set, get, store),
    }),
  );
}
