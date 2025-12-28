import {createWasmDuckDbConnector} from '@sqlrooms/duckdb';
import {
  createRoomShellSlice,
  createRoomStore,
  LayoutTypes,
  RoomShellSliceState,
} from '@sqlrooms/room-shell';
import {createSqlEditorSlice, SqlEditorSliceState} from '@sqlrooms/sql-editor';
import {DatabaseIcon} from 'lucide-react';
import {DataPanel} from './components/DataPanel';
import {MainView} from './components/MainView';

type RoomState = RoomShellSliceState & SqlEditorSliceState;

export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
  (set, get, store) => ({
    // Sql editor slice
    ...createSqlEditorSlice()(set, get, store),

    // Room shell slice
    ...createRoomShellSlice({
      connector: createWasmDuckDbConnector({
        initializationQuery: 'LOAD spatial',
      }),
      config: {
        layout: {
          type: LayoutTypes.enum.mosaic,
          nodes: {
            direction: 'row',
            first: 'data',
            second: 'main',
            splitPercentage: 30,
          },
        },
        dataSources: [
          {
            type: 'url',
            url: 'https://huggingface.co/datasets/sqlrooms/bixi-2025/resolve/main/bixi-flows-2025.parquet',
            tableName: 'flows',
          },
          {
            type: 'url',
            url: 'https://huggingface.co/datasets/sqlrooms/bixi-2025/resolve/main/bixi-locations-2025.parquet',
            tableName: 'locations',
          },
        ],
      },
      room: {
        panels: {
          data: {
            title: 'Data sources',
            icon: DatabaseIcon,
            component: DataPanel,
            placement: 'sidebar',
          },
          main: {
            title: 'Main view',
            icon: () => null,
            component: MainView,
            placement: 'main',
          },
        },
      },
    })(set, get, store),
  }),
);
