import {RoomState} from '@sqlrooms/room-store';
import {AiSettingsSliceConfig} from '@sqlrooms/ai-config';

/**
 * Helper function to type guard the store config if we have aiSettings
 * @param store
 * @returns
 */
export function hasAiSettingsConfig<S extends RoomState<any>>(
  store: S,
): store is S & {aiSettings: {config: AiSettingsSliceConfig}} {
  return (
    isObject(store) &&
    'aiSettings' in store &&
    isObject(store.aiSettings) &&
    'config' in store.aiSettings &&
    isObject(store.aiSettings.config)
  );
}

function isObject(val: unknown): val is object {
  return typeof val === 'object' && val !== null;
}
