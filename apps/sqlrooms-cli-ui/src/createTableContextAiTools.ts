import type {RoomState} from './store-types';
import type {StoreApi} from 'zustand';
import {createListContextTablesTool} from './ai-tools/listContextTables';
import {createReadTableSchemaTool} from './ai-tools/readTableSchema';

export function createTableContextAiTools(store: StoreApi<RoomState>) {
  return {
    list_context_tables: createListContextTablesTool(store),
    read_table_schema: createReadTableSchemaTool(store),
  };
}
