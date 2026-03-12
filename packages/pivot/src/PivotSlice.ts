import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {produce} from 'immer';
import {createId} from '@paralleldrive/cuid2';
import {
  createDefaultPivotConfig,
  moveFieldInConfig,
  nextSortOrder,
  normalizePivotConfig,
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

function createInitialPivotSliceConfig(props?: {
  config?: Partial<PivotConfig & {tableName?: string}>;
}): PivotSlicePersistedConfig {
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

export function createPivotSlice(props?: {
  config?: Partial<PivotConfig & {tableName?: string}>;
}) {
  return createSlice<
    PivotSliceState,
    BaseRoomStoreState & DuckDbSliceState & PivotSliceState
  >((set, get) => ({
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
            }
          }),
        );
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
            pivot.status.stale = true;
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
            pivot.status.stale = true;
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
            pivot.status.stale = true;
          }),
        );
      },

      setRendererName(pivotId, rendererName) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.rendererName = rendererName;
            pivot.status.stale = true;
          }),
        );
      },

      setAggregatorName(pivotId, aggregatorName) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.aggregatorName = aggregatorName;
            pivot.status.stale = true;
          }),
        );
      },

      setRows(pivotId, rows) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.rows = rows;
            pivot.status.stale = true;
          }),
        );
      },

      setCols(pivotId, cols) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.cols = cols;
            pivot.status.stale = true;
          }),
        );
      },

      setVals(pivotId, vals) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.vals = vals;
            pivot.status.stale = true;
          }),
        );
      },

      setUnusedOrder(pivotId, unusedOrder) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.unusedOrder = unusedOrder;
            pivot.status.stale = true;
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
            pivot.status.stale = true;
          }),
        );
      },

      cycleRowOrder(pivotId) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.rowOrder = nextSortOrder(pivot.config.rowOrder);
            pivot.status.stale = true;
          }),
        );
      },

      cycleColOrder(pivotId) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.colOrder = nextSortOrder(pivot.config.colOrder);
            pivot.status.stale = true;
          }),
        );
      },

      setAttributeFilterValues(pivotId, attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config.valueFilter[attribute] = Object.fromEntries(
              values.map((value) => [value, true]),
            );
            pivot.status.stale = true;
          }),
        );
      },

      addAttributeFilterValues(pivotId, attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            const current = pivot.config.valueFilter[attribute] ?? {};
            for (const value of values) {
              current[value] = true;
            }
            pivot.config.valueFilter[attribute] = current;
            pivot.status.stale = true;
          }),
        );
      },

      removeAttributeFilterValues(pivotId, attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            const current = {
              ...(pivot.config.valueFilter[attribute] ?? {}),
            };
            for (const value of values) {
              delete current[value];
            }
            if (Object.keys(current).length === 0) {
              delete pivot.config.valueFilter[attribute];
            } else {
              pivot.config.valueFilter[attribute] = current;
            }
            pivot.status.stale = true;
          }),
        );
      },

      clearAttributeFilter(pivotId, attribute) {
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            delete pivot.config.valueFilter[attribute];
            pivot.status.stale = true;
          }),
        );
      },

      async runPivot(pivotId) {
        const state = get();
        const pivot = state.pivot.config.pivots[pivotId];
        const tableSource =
          pivot?.source?.kind === 'table' ? pivot.source : undefined;
        if (!pivot || !tableSource) {
          return;
        }
        const table = state.db.tables.find(
          (candidate) => candidate.tableName === tableSource.tableName,
        );
        if (!table) {
          return;
        }

        const querySource = createPivotQuerySourceFromTable(table);
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
          const relations = await createOrReplacePivotRelations({
            connector,
            source: querySource,
            config: pivot.config,
            relationBaseName: `pivot_${pivotId}`,
            schemaName: 'pivot',
          });
          set((current) =>
            produce(current, (draft) => {
              const currentPivot = draft.pivot.config.pivots[pivotId];
              if (!currentPivot) return;
              currentPivot.status = {
                state: 'success',
                stale: false,
                lastRunTime: Date.now(),
                relations,
                sourceRelation: querySource.tableRef,
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
