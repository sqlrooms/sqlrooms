import z from 'zod';
import {
  createJSONStorage,
  persist,
  PersistOptions,
  StateStorage,
} from 'zustand/middleware';
import {StateCreator} from './BaseRoomStore';

type PersistedSliceConfigs<T extends Record<string, z.ZodType>> = {
  [K in keyof T]: z.infer<T[K]>;
};

const unavailableStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

function getBrowserStorage(): StateStorage {
  try {
    return window.localStorage ?? unavailableStorage;
  } catch {
    return unavailableStorage;
  }
}

function warnStorageFailure(operation: string, error: unknown) {
  console.warn(
    `Persist storage ${operation} failed; persistence was skipped:`,
    error instanceof Error ? error.message : error,
  );
}

function runSafeStorageOperation<T>(
  operation: string,
  callback: () => T,
  fallback: T,
): T {
  try {
    const result = callback();
    if (result instanceof Promise) {
      return result.catch((error) => {
        warnStorageFailure(operation, error);
        return fallback;
      }) as T;
    }
    return result;
  } catch (error) {
    warnStorageFailure(operation, error);
    return fallback;
  }
}

/**
 * Wraps a Zustand persist storage so unavailable or failing storage does not
 * prevent normal state updates. This also protects serialisation from errors
 * such as `RangeError: Invalid string length` when state grows unexpectedly.
 */
function createSafeStorage<S, PersistedState>(
  base: PersistOptions<S, PersistedState>['storage'],
): PersistOptions<S, PersistedState>['storage'] {
  if (!base) return base;
  const originalGetItem = base.getItem.bind(base);
  const originalSetItem = base.setItem.bind(base);
  const originalRemoveItem = base.removeItem.bind(base);

  return {
    ...base,
    getItem: (...args: Parameters<typeof originalGetItem>) =>
      runSafeStorageOperation('getItem', () => originalGetItem(...args), null),
    setItem: (...args: Parameters<typeof originalSetItem>) =>
      runSafeStorageOperation(
        'setItem',
        () => originalSetItem(...args),
        undefined,
      ),
    removeItem: (...args: Parameters<typeof originalRemoveItem>) =>
      runSafeStorageOperation(
        'removeItem',
        () => originalRemoveItem(...args),
        undefined,
      ),
  };
}

/**
 * Internal symbol-based hook for schema-specific rehydrate merge input.
 *
 * If a Zod schema sets a function under this symbol, `createPersistHelpers().merge`
 * will call it with `{defaults, persisted}` and parse the returned value instead of
 * parsing `persisted` directly.
 *
 * This allows slices to opt into defaults-aware merging without hard-coding slice keys.
 */
const PersistMergeInputSymbol = Symbol.for('sqlrooms.persist.mergeInput');

/**
 * Builds the value passed to `schema.parse(...)` during rehydrate merge.
 */
type PersistMergeInputBuilder = (params: {
  persisted: unknown;
  defaults: unknown;
}) => unknown;

function getPersistMergeInputBuilder(
  schema: z.ZodType,
): PersistMergeInputBuilder | undefined {
  // Schemas can optionally expose a merge-input builder under this symbol.
  // This lets slices define custom rehydrate behavior without key-based branching.
  const marker = (
    schema as z.ZodType & {
      [PersistMergeInputSymbol]?: PersistMergeInputBuilder;
    }
  )[PersistMergeInputSymbol];

  return typeof marker === 'function' ? marker : undefined;
}

/**
 * Creates partialize and merge functions for Zustand persist middleware.
 * Automatically handles extracting and merging slice configs.
 *
 * @param sliceConfigs - Map of slice names to their Zod config schemas
 * @returns Object with partialize and merge functions
 *   - `partialize`: serializes `state[slice].config` for each configured slice
 *   - `merge`: rehydrates each slice config from persisted storage
 *
 * `merge` supports schema-level customization via an internal symbol marker.
 * When present on a schema, the marker function receives the current defaults and
 * persisted value and can return custom parse input for `schema.parse(...)`.
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
    partialize: (state: any): PersistedSliceConfigs<T> => {
      const result = {} as PersistedSliceConfigs<T>;
      for (const [key, schema] of Object.entries(sliceConfigs)) {
        try {
          (result as Record<string, unknown>)[key] = schema.parse(
            state[key]?.config,
          );
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
          // Default behavior parses persisted config as-is.
          // If a schema declares a merge-input builder, we pass both persisted
          // and current defaults so that schema can merge before validation.
          const parseMergeInput = getPersistMergeInputBuilder(schema);
          const mergeInput = parseMergeInput
            ? parseMergeInput({
                defaults: currentState[key]?.config,
                persisted: persistedConfig,
              })
            : persistedConfig;
          const config = schema.parse(mergeInput);

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
 * @param options.storage - Custom storage implementation (optional, defaults to localStorage with a no-op fallback)
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
export function persistSliceConfigs<
  S,
  TSliceConfigs extends Record<string, z.ZodType> = Record<string, z.ZodType>,
  PersistedState = PersistedSliceConfigs<TSliceConfigs>,
>(
  options: {
    sliceConfigSchemas: TSliceConfigs;
    partialize?: (state: S) => PersistedState;
    merge?: (persistedState: unknown, currentState: S) => S;
  } & Omit<PersistOptions<S, PersistedState>, 'partialize' | 'merge'>,
  stateCreator: StateCreator<S>,
): StateCreator<S> {
  const {sliceConfigSchemas, partialize, merge, storage, ...persistOptions} =
    options;
  const helpers = createPersistHelpers(sliceConfigSchemas);

  const safeStorage = createSafeStorage(
    storage ?? createJSONStorage<PersistedState>(getBrowserStorage),
  );

  return persist<S, [], [], PersistedState>(stateCreator, {
    ...persistOptions,
    ...(safeStorage ? {storage: safeStorage} : {}),
    partialize: partialize || helpers.partialize,
    merge: merge || helpers.merge,
  } as PersistOptions<S, PersistedState>) as StateCreator<S>;
}
