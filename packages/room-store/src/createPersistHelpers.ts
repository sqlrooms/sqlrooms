import {persist, PersistOptions} from 'zustand/middleware';
import z from 'zod';
import {StateCreator} from './BaseRoomStore';

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
        try {
          result[key] = schema.parse(state[key]?.config);
        } catch (error) {
          throw new Error(`Error parsing config key "${key}"`, {
            cause: error,
          });
        }
      }
      return result;
    },

    merge: (persistedState: any, currentState: any) => {
      const merged = {...currentState};
      for (const [key, schema] of Object.entries(sliceConfigs)) {
        try {
          merged[key] = {
            ...currentState[key],
            config: schema.parse(persistedState[key]),
          };
        } catch (error) {
          throw new Error(`Error parsing config key "${key}"`, {
            cause: error,
          });
        }
      }
      return merged;
    },
  };
}

/**
 * Wraps a state creator with Zustand's persist middleware and automatically
 * handles slice config serialization/deserialization using Zod schemas.
 *
 * This helper combines persist functionality with automatic `partialize` and `merge`
 * functions generated from your slice config schemas, eliminating manual type casting.
 *
 * @param options - Persist configuration object
 * @param options.name - Unique storage key (required)
 * @param options.sliceConfigSchemas - Map of slice names to Zod schemas for their configs
 * @param options.storage - Custom storage implementation (optional, defaults to localStorage)
 * @param options.version - Schema version for migrations (optional)
 * @param options.migrate - Migration function for version changes (optional)
 * @param options.skipHydration - Skip auto-hydration for SSR (optional)
 * @param stateCreator - Zustand state creator function
 * @returns Properly typed StateCreator with persist middleware applied
 *
 * @see {@link https://zustand.docs.pmnd.rs/middlewares/persist | Zustand persist middleware docs}
 *
 * @example
 * ```ts
 * export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
 *   persistSliceConfigs(
 *     {
 *       name: 'my-app-state-storage',
 *       sliceConfigSchemas: {
 *         room: BaseRoomConfig,
 *         layout: LayoutConfig,
 *         sqlEditor: SqlEditorSliceConfig,
 *       },
 *     },
 *     (set, get, store) => ({
 *       ...createRoomSlice()(set, get, store),
 *       ...createLayoutSlice({...})(set, get, store),
 *     })
 *   )
 * );
 * ```
 */
export function persistSliceConfigs<S>(
  options: Omit<PersistOptions<S>, 'partialize' | 'merge'> & {
    sliceConfigSchemas: Record<string, z.ZodType>;
  },
  stateCreator: StateCreator<S>,
): StateCreator<S> {
  const {sliceConfigSchemas, ...persistOptions} = options;
  const helpers = createPersistHelpers(sliceConfigSchemas);
  return persist<S>(stateCreator, {
    ...persistOptions,
    ...(helpers as Pick<PersistOptions<S>, 'partialize' | 'merge'>),
  } as PersistOptions<S>) as StateCreator<S>;
}
