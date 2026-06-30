import {
  createBlockSettingsSlice,
  type BlockSettingsSliceState,
} from '@sqlrooms/documents';
import {createSlice} from '@sqlrooms/room-store';
import {
  createMosaicDashboardSlice,
  type CreateMosaicDashboardSliceProps,
  type MosaicDashboardSliceState,
  type MosaicDashboardStoreState,
} from './MosaicDashboardSlice';

/**
 * Store state installed by the standard Mosaic dashboard feature composer.
 */
export type MosaicDashboardFeatureSlicesState = MosaicDashboardSliceState &
  BlockSettingsSliceState;

/**
 * Creates the store slices needed by Mosaic dashboard surfaces with settings.
 *
 * This composes dashboard state with the shared block/panel settings selection
 * state used by BlockSettingsPanelLayout.
 */
export function createDashboardFeatureSlices<
  TRoomState extends MosaicDashboardStoreState & BlockSettingsSliceState =
    MosaicDashboardStoreState & BlockSettingsSliceState,
>(props: CreateMosaicDashboardSliceProps = {}) {
  return createSlice<MosaicDashboardFeatureSlicesState, TRoomState>(
    (set, get, store) => ({
      ...createMosaicDashboardSlice(props)(set, get, store),
      ...createBlockSettingsSlice<TRoomState>()(set, get, store),
    }),
  );
}
