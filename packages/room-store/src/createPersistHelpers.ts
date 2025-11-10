import z from 'zod';

/**
 * Creates partialize and merge functions for Zustand persist middleware.
 * Automatically handles extracting and merging slice configs.
 *
 * @param sliceConfigs - Map of slice names to their Zod config schemas
 * @returns Object with partialize and merge functions
 *
 * @example
 * ```ts
 * const {partialize, merge} = createPersistHelpers({
 *   room: BaseRoomConfig,
 *   layout: LayoutConfig,
 *   sqlEditor: SqlEditorSliceConfig,
 * });
 *
 * export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
 *   persist(
 *     (set, get, store) => ({...}),
 *     {
 *       name: 'my-app-state-storage',
 *       partialize,
 *       merge,
 *     },
 *   ) as StateCreator<RoomState>,
 * );
 * ```
 */
export function createPersistHelpers<T extends Record<string, z.ZodType>>(
  sliceConfigs: T,
) {
  return {
    partialize: (state: any) => {
      const result: Record<string, any> = {};
      for (const [key, schema] of Object.entries(sliceConfigs)) {
        result[key] = schema.parse(state[key].config);
      }
      return result;
    },

    merge: (persistedState: any, currentState: any) => {
      const merged = {...currentState};
      for (const [key, schema] of Object.entries(sliceConfigs)) {
        merged[key] = {
          ...currentState[key],
          config: schema.parse(persistedState[key]),
        };
      }
      return merged;
    },
  };
}
