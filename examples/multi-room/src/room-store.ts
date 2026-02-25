import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStoreCreator,
  DataSource,
  persistSliceConfigs,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';

export type RoomState = RoomShellSliceState;

export const {createRoomStore, useRoomStore} =
  createRoomStoreCreator<RoomState>()(
    (roomId: string, defaultDataSources: DataSource[]) =>
      persistSliceConfigs(
        {
          name: `multi-room-${roomId}`,
          sliceConfigSchemas: {room: BaseRoomConfig},
        },
        (set, get, store) => ({
          ...createRoomShellSlice({
            config: {dataSources: defaultDataSources},
          })(set, get, store),
        }),
      ),
  );
