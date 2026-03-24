import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {createId} from '@paralleldrive/cuid2';
import {
  addAttributeFilterValuesInConfig,
  clearAttributeFilterInConfig,
  createDefaultPivotConfig,
  moveFieldInConfig,
  nextSortOrder,
  normalizePivotConfig,
  removeAttributeFilterValuesInConfig,
  setAttributeFilterValuesInConfig,
} from './PivotCoreSlice';
import type {
  PivotInstanceSnapshot,
  PivotInstanceState,
  PivotInstanceStore,
} from './PivotCoreSlice';
import {createPivotQuerySourceFromTable} from './sql';
import {
  createOrReplacePivotRelations,
  dropPivotRelations,
} from './pivotExecution';
import {
  type PivotConfig,
  type PivotSliceConfig as PivotSlicePersistedConfig,
  type PivotSource,
  type PivotStatus,
  PivotSliceConfig,
  PivotSliceState,
} from './types';
import {createStore} from 'zustand/vanilla';

function createInitialPivotSliceConfig(props?: {
  config?: Partial<PivotConfig & {tableName?: string}>;
}): PivotSlicePersistedConfig {
  if (!props?.config) {
    return PivotSliceConfig.parse({
      pivots: {},
      pivotOrder: [],
      currentPivotId: undefined,
    });
  }
  const id = createId();
  const source = props?.config?.tableName
    ? ({kind: 'table', tableName: props.config.tableName} as PivotSource)
    : undefined;
  const config = createDefaultPivotConfig(props?.config);
  return PivotSliceConfig.parse({
    pivots: {
      [id]: {
        id,
        title: 'Pivot 1',
        source,
        config,
        status: {state: 'idle', stale: false},
      },
    },
    pivotOrder: [id],
    currentPivotId: id,
  });
}

function resetPivotRuntimeStatus(status: PivotStatus): PivotStatus {
  return {
    state: 'idle',
    stale: true,
    lastRunTime: status.lastRunTime,
  };
}

export function createPivotSlice(props?: {
  config?: Partial<PivotConfig & {tableName?: string}>;
}) {
  type RootState = BaseRoomStoreState & DuckDbSliceState & PivotSliceState;
  const pivotStores = new Map<string, PivotInstanceStore>();

  return createSlice<PivotSliceState, RootState>((set, get, store) => {
    /**
     * Shared helper: mutate a pivot's config and reset its runtime status.
     * `updater` receives the current config and returns the new one.
     */
    const updatePivotConfig = (
      pivotId: string,
      updater: (config: PivotConfig) => PivotConfig,
    ) => {
      set((state) =>
        produce(state, (draft) => {
          const pivot = draft.pivot.config.pivots[pivotId];
          if (!pivot) return;
          pivot.config = updater(pivot.config);
          pivot.status = resetPivotRuntimeStatus(pivot.status);
        }),
      );
    };

    return {
      pivot: {
        config: createInitialPivotSliceConfig(props),

        async initialize() {
          const tables = get().db.tables;
          if (tables.length === 0) {
            return;
          }
          set((state) =>
            produce(state, (draft) => {
              if (
                !draft.pivot.config.currentPivotId &&
                draft.pivot.config.pivotOrder.length > 0
              ) {
                draft.pivot.config.currentPivotId =
                  draft.pivot.config.pivotOrder[0];
              }

              for (const pivotId of draft.pivot.config.pivotOrder) {
                const pivot = draft.pivot.config.pivots[pivotId];
                if (!pivot) continue;
                if (pivot.source?.kind === 'table') {
                  const tableName = pivot.source.tableName;
                  const table =
                    tables.find(
                      (candidate) => candidate.tableName === tableName,
                    ) ?? tables[0];
                  if (table) {
                    pivot.source = {kind: 'table', tableName: table.tableName};
                    pivot.config = normalizePivotConfig(
                      pivot.config,
                      table.columns,
                    );
                  }
                }
                pivot.status = resetPivotRuntimeStatus(pivot.status);
              }
            }),
          );
        },

        getPivotStore(pivotId) {
          const existing = pivotStores.get(pivotId);
          if (existing) return existing;

          function getSnapshot(): PivotInstanceSnapshot {
            const rootState = get();
            const pivot = rootState.pivot.config.pivots[pivotId];
            const availableTables = rootState.db.tables.map((t) => t.tableName);
            if (!pivot) {
              return {
                source: undefined,
                config: createDefaultPivotConfig(),
                status: {state: 'idle', stale: false},
                querySource: undefined,
                fields: [],
                availableTables,
              };
            }
            const tableSource =
              pivot.source?.kind === 'table' ? pivot.source : undefined;
            const table = tableSource
              ? rootState.db.tables.find(
                  (t) => t.tableName === tableSource.tableName,
                )
              : undefined;
            const querySource = table
              ? createPivotQuerySourceFromTable(table)
              : undefined;
            return {
              source: pivot.source,
              config: pivot.config,
              status: pivot.status,
              querySource,
              fields: querySource?.columns ?? [],
              availableTables,
            };
          }

          let currentSnapshot = getSnapshot();

          const adapterStore = createStore<PivotInstanceState>(
            (adapterSet) => ({
              ...currentSnapshot,
              ui: {sectionOpenState: {}},
              setSource: (source) => get().pivot.setSource(pivotId, source),
              setConfig: (config) => get().pivot.setConfig(pivotId, config),
              patchConfig: (partial) =>
                get().pivot.patchConfig(pivotId, partial),
              setRendererName: (v) => get().pivot.setRendererName(pivotId, v),
              setAggregatorName: (v) =>
                get().pivot.setAggregatorName(pivotId, v),
              setVals: (v) => get().pivot.setVals(pivotId, v),
              moveField: (field, dest, idx) =>
                get().pivot.moveField(pivotId, field, dest, idx),
              cycleRowOrder: () => get().pivot.cycleRowOrder(pivotId),
              cycleColOrder: () => get().pivot.cycleColOrder(pivotId),
              setAttributeFilterValues: (a, v) =>
                get().pivot.setAttributeFilterValues(pivotId, a, v),
              addAttributeFilterValues: (a, v) =>
                get().pivot.addAttributeFilterValues(pivotId, a, v),
              removeAttributeFilterValues: (a, v) =>
                get().pivot.removeAttributeFilterValues(pivotId, a, v),
              clearAttributeFilter: (a) =>
                get().pivot.clearAttributeFilter(pivotId, a),
              setSectionOpen: (section, isOpen) =>
                adapterSet((state) => ({
                  ui: {
                    ...state.ui,
                    sectionOpenState: {
                      ...state.ui.sectionOpenState,
                      [section]: isOpen,
                    },
                  },
                })),
              run: () => get().pivot.runPivot(pivotId),
            }),
          );

          const unsubscribe = store.subscribe(() => {
            const nextSnapshot = getSnapshot();
            const prev = currentSnapshot;
            if (
              JSON.stringify(prev.source) ===
                JSON.stringify(nextSnapshot.source) &&
              JSON.stringify(prev.config) ===
                JSON.stringify(nextSnapshot.config) &&
              JSON.stringify(prev.status) ===
                JSON.stringify(nextSnapshot.status) &&
              JSON.stringify(prev.querySource) ===
                JSON.stringify(nextSnapshot.querySource) &&
              prev.fields.length === nextSnapshot.fields.length &&
              prev.fields.every(
                (f, i) =>
                  f.name === nextSnapshot.fields[i]?.name &&
                  f.type === nextSnapshot.fields[i]?.type,
              ) &&
              prev.availableTables.length ===
                nextSnapshot.availableTables.length &&
              prev.availableTables.every(
                (t, i) => t === nextSnapshot.availableTables[i],
              )
            ) {
              return;
            }
            currentSnapshot = nextSnapshot;
            adapterStore.setState(nextSnapshot);
          });

          const instanceStore: PivotInstanceStore = Object.assign(
            adapterStore,
            {
              destroy: () => {
                unsubscribe();
                pivotStores.delete(pivotId);
              },
            },
          );
          pivotStores.set(pivotId, instanceStore);
          return instanceStore;
        },

        addPivot(pivotProps) {
          const id = createId();
          const title = generateUniqueName(
            pivotProps?.title ?? 'Pivot 1',
            Object.values(get().pivot.config.pivots).map(
              (pivot) => pivot.title,
            ),
            ' ',
          );
          const nextPivot = {
            id,
            title,
            source: pivotProps?.source,
            config: createDefaultPivotConfig(pivotProps?.config),
            status: {state: 'idle', stale: false} satisfies PivotStatus,
          };
          set((state) =>
            produce(state, (draft) => {
              draft.pivot.config.pivots[id] = nextPivot;
              draft.pivot.config.pivotOrder.push(id);
              draft.pivot.config.currentPivotId = id;
            }),
          );
          return id;
        },

        removePivot(pivotId) {
          pivotStores.get(pivotId)?.destroy();
          pivotStores.delete(pivotId);
          const relations =
            get().pivot.config.pivots[pivotId]?.status.relations;
          void (async () => {
            if (!relations) return;
            const connector = await get().db.getConnector();
            await dropPivotRelations({connector, relations});
            void get().db.refreshTableSchemas();
          })();
          set((state) =>
            produce(state, (draft) => {
              delete draft.pivot.config.pivots[pivotId];
              draft.pivot.config.pivotOrder =
                draft.pivot.config.pivotOrder.filter((id) => id !== pivotId);
              if (draft.pivot.config.currentPivotId === pivotId) {
                draft.pivot.config.currentPivotId =
                  draft.pivot.config.pivotOrder[0];
              }
            }),
          );
        },

        setCurrentPivot(pivotId) {
          set((state) =>
            produce(state, (draft) => {
              draft.pivot.config.currentPivotId = pivotId;
            }),
          );
        },

        renamePivot(pivotId, title) {
          set((state) =>
            produce(state, (draft) => {
              const pivot = draft.pivot.config.pivots[pivotId];
              if (pivot) {
                pivot.title = title;
              }
            }),
          );
        },

        setSource(pivotId, source) {
          set((state) =>
            produce(state, (draft) => {
              const pivot = draft.pivot.config.pivots[pivotId];
              if (!pivot) return;
              pivot.source = source;
              pivot.config = createDefaultPivotConfig();
              pivot.status = resetPivotRuntimeStatus(pivot.status);
            }),
          );
        },

        setStatus(pivotId, status) {
          set((state) =>
            produce(state, (draft) => {
              const pivot = draft.pivot.config.pivots[pivotId];
              if (!pivot) return;
              pivot.status = {...pivot.status, ...status};
            }),
          );
        },

        setConfig(pivotId, config) {
          const tableSource =
            get().pivot.config.pivots[pivotId]?.source?.kind === 'table'
              ? get().pivot.config.pivots[pivotId]!.source
              : undefined;
          const columns =
            tableSource?.kind === 'table'
              ? (get().db.tables.find(
                  (t) => t.tableName === tableSource.tableName,
                )?.columns ?? [])
              : [];
          updatePivotConfig(pivotId, () =>
            normalizePivotConfig(config, columns),
          );
        },

        patchConfig(pivotId, config) {
          const tableSource =
            get().pivot.config.pivots[pivotId]?.source?.kind === 'table'
              ? get().pivot.config.pivots[pivotId]!.source
              : undefined;
          const columns =
            tableSource?.kind === 'table'
              ? (get().db.tables.find(
                  (t) => t.tableName === tableSource.tableName,
                )?.columns ?? [])
              : [];
          updatePivotConfig(pivotId, (c) =>
            normalizePivotConfig({...c, ...config}, columns),
          );
        },

        setRendererName: (pivotId, rendererName) =>
          updatePivotConfig(pivotId, (c) => ({...c, rendererName})),

        setAggregatorName: (pivotId, aggregatorName) =>
          updatePivotConfig(pivotId, (c) => ({...c, aggregatorName})),

        setRows: (pivotId, rows) =>
          updatePivotConfig(pivotId, (c) => ({...c, rows})),

        setCols: (pivotId, cols) =>
          updatePivotConfig(pivotId, (c) => ({...c, cols})),

        setVals: (pivotId, vals) =>
          updatePivotConfig(pivotId, (c) => ({...c, vals})),

        setUnusedOrder: (pivotId, unusedOrder) =>
          updatePivotConfig(pivotId, (c) => ({...c, unusedOrder})),

        moveField: (pivotId, field, destination, index) =>
          updatePivotConfig(pivotId, (c) =>
            moveFieldInConfig(c, field, destination, index),
          ),

        cycleRowOrder: (pivotId) =>
          updatePivotConfig(pivotId, (c) => ({
            ...c,
            rowOrder: nextSortOrder(c.rowOrder),
          })),

        cycleColOrder: (pivotId) =>
          updatePivotConfig(pivotId, (c) => ({
            ...c,
            colOrder: nextSortOrder(c.colOrder),
          })),

        setAttributeFilterValues: (pivotId, attribute, values) =>
          updatePivotConfig(pivotId, (c) =>
            setAttributeFilterValuesInConfig(c, attribute, values),
          ),

        addAttributeFilterValues: (pivotId, attribute, values) =>
          updatePivotConfig(pivotId, (c) =>
            addAttributeFilterValuesInConfig(c, attribute, values),
          ),

        removeAttributeFilterValues: (pivotId, attribute, values) =>
          updatePivotConfig(pivotId, (c) =>
            removeAttributeFilterValuesInConfig(c, attribute, values),
          ),

        clearAttributeFilter: (pivotId, attribute) =>
          updatePivotConfig(pivotId, (c) =>
            clearAttributeFilterInConfig(c, attribute),
          ),

        async runPivot(pivotId, opts) {
          const state = get();
          const pivot = state.pivot.config.pivots[pivotId];
          if (!pivot) return;

          const schemaName = opts?.schemaName ?? '__sqlrooms_pivot';

          let querySource = opts?.querySource;
          if (!querySource) {
            const tableSource =
              pivot.source?.kind === 'table' ? pivot.source : undefined;
            if (!tableSource) return;
            const table = state.db.tables.find(
              (t) => t.tableName === tableSource.tableName,
            );
            if (!table) return;
            querySource = createPivotQuerySourceFromTable(table);
          }

          set((current) =>
            produce(current, (draft) => {
              const p = draft.pivot.config.pivots[pivotId];
              if (!p) return;
              p.status = {...p.status, state: 'running'};
            }),
          );

          try {
            const connector = await state.db.getConnector();
            const normalizedConfig = normalizePivotConfig(
              pivot.config,
              querySource.columns,
            );
            const relations = await createOrReplacePivotRelations({
              connector,
              source: querySource,
              config: normalizedConfig,
              relationBaseName: `pivot_${pivotId}`,
              schemaName,
            });
            set((current) =>
              produce(current, (draft) => {
                const p = draft.pivot.config.pivots[pivotId];
                if (!p) return;
                p.config = normalizedConfig;
                p.status = {
                  state: 'success',
                  stale: false,
                  lastRunTime: Date.now(),
                  relations,
                  sourceRelation: querySource!.tableRef,
                };
              }),
            );
            void get().db.refreshTableSchemas();
          } catch (error) {
            set((current) =>
              produce(current, (draft) => {
                const p = draft.pivot.config.pivots[pivotId];
                if (!p) return;
                p.status = {
                  ...p.status,
                  state: 'error',
                  lastError:
                    error instanceof Error ? error.message : String(error),
                };
              }),
            );
          }
        },
      },
    };
  });
}
