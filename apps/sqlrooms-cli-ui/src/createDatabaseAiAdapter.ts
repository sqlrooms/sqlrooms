import {getTablesForAiScope} from '@sqlrooms/ai';
import type {DatabaseAiAdapter} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

export function createDatabaseAiAdapter(
  store: StoreApi<RoomState>,
): DatabaseAiAdapter {
  return {
    getTables: () => {
      const state = store.getState();

      return getTablesForAiScope(state.db.tables, state.db.currentDatabase, {
        scope: 'all',
      });
    },
    findTable: (tableName) => {
      return store.getState().db.findTable(tableName);
    },
  };
}
