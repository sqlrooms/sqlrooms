import {
  createDuckDbDatabaseAiAdapter,
  type DatabaseAiAdapter,
} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';

export function createDatabaseAiAdapter(
  store: StoreApi<RoomState>,
): DatabaseAiAdapter {
  return createDuckDbDatabaseAiAdapter(store);
}
