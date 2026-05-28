import type {RoomState} from './store-types';
import type {StoreApi} from 'zustand';
import {createReadTableSchemaTool} from './ai-tools/readTableSchema';

export function createTableContextAiTools(store: StoreApi<RoomState>) {
  return {
    read_table_schema: createReadTableSchemaTool(store),
  };
}
