import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-shell';
import {produce} from 'immer';
import {z} from 'zod';

export const MapSettingsConfig = z.object({
  enableBrushing: z.boolean().default(false),
  syncCharts: z.boolean().default(true),
  brushRadius: z.number().default(50000),
});
export type MapSettingsConfig = z.infer<typeof MapSettingsConfig>;

export type MapSettingsSliceState = {
  mapSettings: {
    config: MapSettingsConfig;
    setEnableBrushing: (enabled: boolean) => void;
    setSyncCharts: (sync: boolean) => void;
    setBrushRadius: (radius: number) => void;
  };
};

export function createDefaultMapSettingsConfig(
  props?: Partial<MapSettingsConfig>,
): MapSettingsConfig {
  return {
    enableBrushing: false,
    syncCharts: true,
    brushRadius: 50000,
    ...props,
  } as MapSettingsConfig;
}

export function createMapSettingsSlice(props?: {
  config?: Partial<MapSettingsConfig>;
}) {
  return createSlice<
    MapSettingsSliceState,
    BaseRoomStoreState & MapSettingsSliceState
  >((set, _get, _store) => ({
    mapSettings: {
      config: createDefaultMapSettingsConfig(props?.config),
      setEnableBrushing: (enabled: boolean) => {
        set((state) =>
          produce(state, (draft) => {
            draft.mapSettings.config.enableBrushing = enabled;
          }),
        );
      },
      setSyncCharts: (sync: boolean) => {
        set((state) =>
          produce(state, (draft) => {
            draft.mapSettings.config.syncCharts = sync;
          }),
        );
      },
      setBrushRadius: (radius: number) => {
        set((state) =>
          produce(state, (draft) => {
            draft.mapSettings.config.brushRadius = radius;
          }),
        );
      },
    },
  }));
}
