import {DASHBOARD_AI_INSTRUCTIONS} from '@sqlrooms/mosaic/ai';
import {
  createDashboardWithDeckMapAiTools,
  getDashboardWithDeckMapAiInstructions,
} from '@sqlrooms/deck';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createDashboardAiAdapter} from './createDashboardToolDeps';

export {DASHBOARD_AI_INSTRUCTIONS};

export function getDashboardAiInstructions(
  _store: StoreApi<RoomState>,
  _runContext?: unknown,
) {
  return getDashboardWithDeckMapAiInstructions();
}

export function createDashboardAiTools(store: StoreApi<RoomState>) {
  return createDashboardWithDeckMapAiTools({
    store,
    adapter: createDashboardAiAdapter(store),
  });
}
