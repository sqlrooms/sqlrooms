import {createDefaultNotebookConfig, createNotebookSlice} from '@sqlrooms/notebook';
import {BaseRoomConfig, createRoomShellSlice, createRoomStore} from '@sqlrooms/room-shell';
import {createDuckDbSlice} from '@sqlrooms/duckdb';
import {z} from 'zod';

export const RoomConfig = BaseRoomConfig.merge(
  z.object(createDefaultNotebookConfig()),
);
export type RoomConfig = z.infer<typeof RoomConfig>;

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, any>(
  (set: any, get: any, store: any) => ({
    ...createRoomShellSlice<RoomConfig>({
      config: {
        title: 'Notebook Example',
        ...createDefaultNotebookConfig(),
      },
      room: {
        panels: {
          main: {
            title: 'Notebook',
            icon: () => null,
            component: (() => {
              const {createNotebookComponents} = require('@sqlrooms/notebook/dist/ui/Notebook');
              const {Notebook} = createNotebookComponents(useRoomStore as any);
              return Notebook as any;
            })(),
            placement: 'main',
          },
        },
      },
    })(set, get, store),
    ...createDuckDbSlice({})(set, get, store),
    ...createNotebookSlice()(set, get, store),
  }),
);

