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
        const persistedConfig = persistedState?.[key];

        if (persistedConfig === undefined || persistedConfig === null) {
          continue;
        }

        try {
          const config =
            key === 'aiSettings'
              ? schema.parse({
                  defaults: currentState[key]?.config,
                  persisted: persistedConfig,
                })
              : schema.parse(persistedConfig);

          merged[key] = {
            ...currentState[key],
            config,
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
 * @param options.partialize - Optional custom partialize function (overrides auto-generated one)
 * @param options.merge - Optional custom merge function (overrides auto-generated one)
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
 * Basic usage:
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
 *
 * @example
 * With custom partialize/merge for additional state:
 * ```ts
 * export const {roomStore, useRoomStore} = createRoomStore<RoomState>(
 *   persistSliceConfigs(
 *     {
 *       name: 'my-app-state-storage',
 *       sliceConfigSchemas: {
 *         room: BaseRoomConfig,
 *         layout: LayoutConfig,
 *       },
 *       partialize: (state) => ({
 *         apiKey: state.apiKey, // Persist additional field
 *         ...createPersistHelpers({room: BaseRoomConfig, layout: LayoutConfig}).partialize(state),
 *       }),
 *       merge: (persisted, current) => ({
 *         ...createPersistHelpers({room: BaseRoomConfig, layout: LayoutConfig}).merge(persisted, current),
 *         apiKey: persisted.apiKey, // Restore additional field
 *       }),
 *     },
 *     (set, get, store) => ({...})
 *   )
 * );
 * ```
 */
export function persistSliceConfigs<S>(
  options: {
    sliceConfigSchemas: Record<string, z.ZodType>;
    partialize?: (state: S) => Partial<S>;
    merge?: (persistedState: unknown, currentState: S) => S;
  } & Omit<PersistOptions<S>, 'partialize' | 'merge'>,
  stateCreator: StateCreator<S>,
): StateCreator<S> {
  const {sliceConfigSchemas, partialize, merge, ...persistOptions} = options;
  const helpers = createPersistHelpers(sliceConfigSchemas);

  return persist<S>(stateCreator, {
    ...persistOptions,
    partialize: partialize || helpers.partialize,
    merge: merge || helpers.merge,
  } as PersistOptions<S>) as StateCreator<S>;
}
