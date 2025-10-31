import {
  Canvas,
  CanvasSliceConfig,
  CanvasSliceState,
  createCanvasSlice,
  createDefaultCanvasConfig,
} from '@sqlrooms/canvas';
import {createWebSocketDuckDbConnector} from '@sqlrooms/duckdb';
import {
  BaseRoomConfig,
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSyncSlice} from '@sqlrooms/sync';
import {DatabaseIcon} from 'lucide-react';
import {z} from 'zod';
import {DataSourcesPanel} from './DataSourcesPanel';

export const RoomConfig = BaseRoomConfig.merge(CanvasSliceConfig);
export type RoomConfig = z.infer<typeof RoomConfig>;

export type RoomState = RoomShellSliceState<RoomConfig> &
  CanvasSliceState & {
    apiKey: string;
    setApiKey: (apiKey: string) => void;
  };
export const RoomPanelTypes = z.enum(['main', 'data'] as const);
export type RoomPanelTypes = z.infer<typeof RoomPanelTypes>;

export const {roomStore, useRoomStore} = createRoomStore<RoomConfig, RoomState>(
  // persist(
  (set, get, store) => ({
    ...createRoomShellSlice<RoomConfig>({
      connector: createWebSocketDuckDbConnector({
        wsUrl: 'ws://localhost:4000',
        subscribeChannels: ['table:earthquakes'],
        onNotification: (payload) => {
          console.log('Notification from server:', payload);
        },
      }),
      config: {
        ...createDefaultCanvasConfig(),
        // CanvasSliceConfig.parse(exampleCanvas).canvas,
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            splitPercentage: 20,
            first: 'data',
            second: 'main',
          },
        },
        dataSources: [
          {
            tableName: 'earthquakes',
            type: 'url',
            url: 'https://pub-334685c2155547fab4287d84cae47083.r2.dev/earthquakes.parquet',
          },
        ],
      },
      room: {
        panels: {
          main: {
            title: 'Canvas',
            icon: () => null,
            component: Canvas,
            placement: 'main',
          },
          data: {
            title: 'Data',
            icon: DatabaseIcon,
            component: DataSourcesPanel,
            placement: 'sidebar',
          },
        },
      },
    })(set, get, store),

    ...createSyncSlice<RoomConfig>({
      crdtOptions: {
        selector: (state) => ({config: state.config}),
        onDocCreated: (key, doc) => {
          switch (key) {
            case 'config':
              break;
          }
        },
      },
    })(set, get, store),

    ...createCanvasSlice<RoomConfig>({
      getApiKey: () => get().apiKey,
      toolsOptions: {
        numberOfRowsToShareWithLLM: 2,
      },
      defaultModel: 'gpt-4.1-mini',
    })(set, get, store),

    apiKey: '',
    setApiKey: (apiKey) => set({apiKey}),
  }),

  // Persist settings
  // {
  //   // Local storage key
  //   name: 'canvas-example-app-state-storage',
  //   // Subset of the state to persist
  //   partialize: (state) => ({
  //     apiKey: state.apiKey,
  //     config: RoomConfig.parse(state.config),
  //   }),
  // },
  // ) as StateCreator<RoomState>,
);
