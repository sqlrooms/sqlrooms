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
import type {PivotInstanceStore, PivotInstanceState} from './PivotCoreSlice';
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

  return createSlice<PivotSliceState, RootState>((set, get, store) => ({
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

        function getSnapshot(): Omit<
          PivotInstanceState,
          | 'ui'
          | 'setSource'
          | 'setConfig'
          | 'patchConfig'
          | 'setRendererName'
          | 'setAggregatorName'
          | 'setVals'
          | 'moveField'
          | 'cycleRowOrder'
          | 'cycleColOrder'
          | 'setAttributeFilterValues'
          | 'addAttributeFilterValues'
          | 'removeAttributeFilterValues'
          | 'clearAttributeFilter'
          | 'setSectionOpen'
          | 'run'
        > {
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
          (adapterSet, adapterGet) => ({
            ...currentSnapshot,
            ui: {sectionOpenState: {}},
            setSource: (source) => {
              adapterSet({
                source,
                config: createDefaultPivotConfig(),
                status: {...adapterGet().status, stale: true},
              });
              get().pivot.setSource(pivotId, source);
            },
            setConfig: (config) => {
              const fields = adapterGet().fields;
              const next = normalizePivotConfig(config, fields);
              adapterSet({
                config: next,
                status: {...adapterGet().status, stale: true},
              });
              get().pivot.setConfig(pivotId, next);
            },
            patchConfig: (partial) => {
              const current = adapterGet().config;
              const fields = adapterGet().fields;
              const next = normalizePivotConfig(
                {...current, ...partial},
                fields,
              );
              adapterSet({
                config: next,
                status: {...adapterGet().status, stale: true},
              });
              get().pivot.setConfig(pivotId, next);
            },
            setRendererName: (rendererName) => {
              get().pivot.setRendererName(pivotId, rendererName);
            },
            setAggregatorName: (aggregatorName) => {
              get().pivot.setAggregatorName(pivotId, aggregatorName);
            },
            setVals: (vals) => {
              get().pivot.setVals(pivotId, vals);
            },
            moveField: (field, destination, index) => {
              get().pivot.moveField(pivotId, field, destination, index);
            },
            cycleRowOrder: () => {
              get().pivot.cycleRowOrder(pivotId);
            },
            cycleColOrder: () => {
              get().pivot.cycleColOrder(pivotId);
            },
            setAttributeFilterValues: (attribute, values) => {
              get().pivot.setAttributeFilterValues(pivotId, attribute, values);
            },
            addAttributeFilterValues: (attribute, values) => {
              get().pivot.addAttributeFilterValues(pivotId, attribute, values);
            },
            removeAttributeFilterValues: (attribute, values) => {
              get().pivot.removeAttributeFilterValues(
                pivotId,
                attribute,
                values,
              );
            },
            clearAttributeFilter: (attribute) => {
              get().pivot.clearAttributeFilter(pivotId, attribute);
            },
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
            run: async () => {
              await get().pivot.runPivot(pivotId);
            },
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

        const instanceStore: PivotInstanceStore = Object.assign(adapterStore, {
          destroy: () => {
            unsubscribe();
            pivotStores.delete(pivotId);
          },
        });
        pivotStores.set(pivotId, instanceStore);
        return instanceStore;
      },

      addPivot(pivotProps) {
        const id = createId();
        const title = generateUniqueName(
          pivotProps?.title ?? 'Pivot 1',
          Object.values(get().pivot.config.pivots).map((pivot) => pivot.title),
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
        const relations = get().pivot.config.pivots[pivotId]?.status.relations;
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
            pivot.status = {
              ...pivot.status,
              ...status,
            };
          }),
        );
      },

      setConfig(pivotId, config) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            const tableSource =
              pivot.source?.kind === 'table' ? pivot.source : undefined;
            const table = tableSource
              ? get().db.tables.find(
                  (candidate) => candidate.tableName === tableSource.tableName,
                )
              : undefined;
            pivot.config = normalizePivotConfig(config, table?.columns ?? []);
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      patchConfig(pivotId, config) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            const tableSource =
              pivot.source?.kind === 'table' ? pivot.source : undefined;
            const table = tableSource
              ? get().db.tables.find(
                  (candidate) => candidate.tableName === tableSource.tableName,
                )
              : undefined;
            pivot.config = normalizePivotConfig(
              {
                ...pivot.config,
                ...config,
              },
              table?.columns ?? [],
            );
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setRendererName(pivotId, rendererName) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.rendererName = rendererName;
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setAggregatorName(pivotId, aggregatorName) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.aggregatorName = aggregatorName;
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setRows(pivotId, rows) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.rows = rows;
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setCols(pivotId, cols) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.cols = cols;
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setVals(pivotId, vals) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.vals = vals;
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setUnusedOrder(pivotId, unusedOrder) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.unusedOrder = unusedOrder;
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      moveField(pivotId, field, destination, index) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = moveFieldInConfig(
              pivot.config,
              field,
              destination,
              index,
            );
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      cycleRowOrder(pivotId) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.rowOrder = nextSortOrder(pivot.config.rowOrder);
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      cycleColOrder(pivotId) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.colOrder = nextSortOrder(pivot.config.colOrder);
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      setAttributeFilterValues(pivotId, attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = setAttributeFilterValuesInConfig(
              pivot.config,
              attribute,
              values,
            );
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      addAttributeFilterValues(pivotId, attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = addAttributeFilterValuesInConfig(
              pivot.config,
              attribute,
              values,
            );
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      removeAttributeFilterValues(pivotId, attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = removeAttributeFilterValuesInConfig(
              pivot.config,
              attribute,
              values,
            );
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      clearAttributeFilter(pivotId, attribute) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = clearAttributeFilterInConfig(
              pivot.config,
              attribute,
            );
            pivot.status = resetPivotRuntimeStatus(pivot.status);
          }),
        );
      },

      async runPivot(pivotId, opts) {
        const state = get();
        const pivot = state.pivot.config.pivots[pivotId];
        if (!pivot) {
          return;
        }

        const schemaName = opts?.schemaName ?? '__sqlrooms_pivot';

        let querySource = opts?.querySource;
        if (!querySource) {
          const tableSource =
            pivot.source?.kind === 'table' ? pivot.source : undefined;
          if (!tableSource) {
            return;
          }
          const table = state.db.tables.find(
            (candidate) => candidate.tableName === tableSource.tableName,
          );
          if (!table) {
            return;
          }
          querySource = createPivotQuerySourceFromTable(table);
        }

        set((current) =>
          produce(current, (draft) => {
            const currentPivot = draft.pivot.config.pivots[pivotId];
            if (!currentPivot) return;
            currentPivot.status = {
              ...currentPivot.status,
              state: 'running',
            };
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
              const currentPivot = draft.pivot.config.pivots[pivotId];
              if (!currentPivot) return;
              currentPivot.config = normalizedConfig;
              currentPivot.status = {
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
              const currentPivot = draft.pivot.config.pivots[pivotId];
              if (!currentPivot) return;
              currentPivot.status = {
                ...currentPivot.status,
                state: 'error',
                lastError:
                  error instanceof Error ? error.message : String(error),
              };
            }),
          );
        }
      },
    },
  }));
}
