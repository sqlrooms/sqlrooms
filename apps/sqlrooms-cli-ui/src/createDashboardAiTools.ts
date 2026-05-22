import {
  DASHBOARD_AI_INSTRUCTIONS,
  createDashboardAiTools as createReusableDashboardAiTools,
} from '@sqlrooms/mosaic/ai';
import type {StoreApi} from 'zustand';
import type {RoomState} from './store-types';
import {createDashboardAiAdapter} from './createDashboardToolDeps';

export {DASHBOARD_AI_INSTRUCTIONS};

export function getDashboardAiInstructions(_store: StoreApi<RoomState>) {
  return DASHBOARD_AI_INSTRUCTIONS.trim();
}

export function createDashboardAiTools(store: StoreApi<RoomState>) {
  return createReusableDashboardAiTools({
    store,
    adapter: createDashboardAiAdapter(store),
  });
}
