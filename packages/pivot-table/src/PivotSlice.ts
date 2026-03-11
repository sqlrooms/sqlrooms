import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {
  addAttributeFilterValuesInConfig,
  clearAttributeFilterInConfig,
  createDefaultPivotConfig,
  createDefaultPivotSliceConfig,
  createDefaultPivotStatus,
  moveFieldInConfig,
  nextSortOrder,
  removeAttributeFilterValuesInConfig,
  sanitizePivotConfigForFields,
  setAttributeFilterValuesInConfig,
} from './pivotConfig';
import {
  dropPivotRelations,
  executePivotRelations,
  getPivotFieldsFromTable,
} from './pivotExecution';
import {getPivotAggregator} from './aggregators';
import type {PivotConfig, PivotSliceState, PivotSource} from './types';

function createPivotId() {
  return `pivot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getResolvedPivotId(
  currentPivotId: string | undefined,
  requestedPivotId?: string,
) {
  return requestedPivotId ?? currentPivotId;
}

export {createDefaultPivotConfig} from './pivotConfig';

export function createPivotSlice(props?: {
  initialPivot?: {
    title?: string;
    source?: PivotSource;
    config?: Partial<PivotConfig>;
  };
}) {
  const initialPivotId = 'pivot-1';
  const initialConfig = createDefaultPivotSliceConfig({
    pivotId: initialPivotId,
    title: props?.initialPivot?.title ?? 'Pivot 1',
    config: props?.initialPivot?.config,
  });
  if (props?.initialPivot?.source) {
    initialConfig.pivots[initialPivotId]!.source = props.initialPivot.source;
  }
  const abortControllers = new Map<string, AbortController>();

  return createSlice<
    PivotSliceState,
    BaseRoomStoreState & DuckDbSliceState & PivotSliceState
  >((set, get) => ({
    pivot: {
      config: initialConfig,
      status: {
        [initialPivotId]: createDefaultPivotStatus(),
      },

      async initialize() {
        const tables = get().db.tables;
        if (tables.length === 0) {
          return;
        }
        set((state) =>
          produce(state, (draft) => {
            for (const pivotId of draft.pivot.config.order) {
              const pivot = draft.pivot.config.pivots[pivotId];
              if (!pivot) continue;
              if (!pivot.source) {
                pivot.source = {
                  kind: 'table',
                  tableName: tables[0]!.tableName,
                };
              }
              if (pivot.source.kind !== 'table') {
                continue;
              }
              const source = pivot.source;
              const table = tables.find(
                (candidate) => candidate.tableName === source.tableName,
              );
              if (!table && tables[0]) {
                pivot.source = {
                  kind: 'table',
                  tableName: tables[0].tableName,
                };
              }
              const nextTable = table ?? tables[0];
              if (nextTable) {
                pivot.config = sanitizePivotConfigForFields(
                  pivot.config,
                  getPivotFieldsFromTable(nextTable),
                );
              }
            }
          }),
        );
      },

      addPivot(args) {
        const pivotId = createPivotId();
        const firstTable = get().db.tables[0];
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.pivots[pivotId] = {
              id: pivotId,
              title:
                args?.title ?? `Pivot ${draft.pivot.config.order.length + 1}`,
              source:
                args?.source ??
                (firstTable
                  ? {kind: 'table', tableName: firstTable.tableName}
                  : undefined),
              config: createDefaultPivotConfig(args?.config),
            };
            draft.pivot.config.order.push(pivotId);
            draft.pivot.config.currentPivotId = pivotId;
            draft.pivot.status[pivotId] = createDefaultPivotStatus();
          }),
        );
        return pivotId;
      },

      async removePivot(pivotId) {
        const previousStatus = get().pivot.status[pivotId];
        abortControllers.get(pivotId)?.abort();
        abortControllers.delete(pivotId);
        set((state) =>
          produce(state, (draft) => {
            delete draft.pivot.config.pivots[pivotId];
            delete draft.pivot.status[pivotId];
            draft.pivot.config.order = draft.pivot.config.order.filter(
              (id) => id !== pivotId,
            );
            if (draft.pivot.config.currentPivotId === pivotId) {
              draft.pivot.config.currentPivotId = draft.pivot.config.order[0];
            }
          }),
        );
        if (previousStatus?.relations) {
          try {
            const connector = await get().db.getConnector();
            await dropPivotRelations({
              connector,
              relations: previousStatus.relations,
            });
          } catch {
            // Best-effort cleanup.
          }
        }
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

      setCurrentPivot(pivotId) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.currentPivotId = pivotId;
          }),
        );
      },

      setSource(source, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const tables = get().db.tables;
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.source = source;
            if (source?.kind === 'table') {
              const table = tables.find(
                (candidate) => candidate.tableName === source.tableName,
              );
              pivot.config = sanitizePivotConfigForFields(
                pivot.config,
                getPivotFieldsFromTable(table),
              );
            }
            draft.pivot.status[pivotId] = {
              ...(draft.pivot.status[pivotId] ?? createDefaultPivotStatus()),
              status: 'stale',
              stale: true,
              lastError: undefined,
            };
          }),
        );
      },

      setConfig(config, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = config;
            draft.pivot.status[pivotId] = {
              ...(draft.pivot.status[pivotId] ?? createDefaultPivotStatus()),
              status: 'stale',
              stale: true,
              lastError: undefined,
            };
          }),
        );
      },

      patchConfig(config, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        set((state) =>
          produce(state, (draft) => {
            const pivot = draft.pivot.config.pivots[pivotId];
            if (!pivot) return;
            pivot.config = {
              ...pivot.config,
              ...config,
            };
            draft.pivot.status[pivotId] = {
              ...(draft.pivot.status[pivotId] ?? createDefaultPivotStatus()),
              status: 'stale',
              stale: true,
              lastError: undefined,
            };
          }),
        );
      },

      setRendererName(rendererName, pivotId) {
        get().pivot.patchConfig({rendererName}, pivotId);
      },

      setAggregatorName(aggregatorName, pivotId) {
        const resolvedPivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          pivotId,
        );
        if (!resolvedPivotId) return;
        const pivot = get().pivot.config.pivots[resolvedPivotId];
        if (!pivot) return;
        const source = pivot.source;
        const table =
          source?.kind === 'table'
            ? get().db.tables.find(
                (candidate) => candidate.tableName === source.tableName,
              )
            : undefined;
        const nextConfig = sanitizePivotConfigForFields(
          {
            ...pivot.config,
            aggregatorName,
          },
          getPivotFieldsFromTable(table),
        );
        get().pivot.setConfig(nextConfig, resolvedPivotId);
      },

      setRows(rows, pivotId) {
        get().pivot.patchConfig({rows}, pivotId);
      },

      setCols(cols, pivotId) {
        get().pivot.patchConfig({cols}, pivotId);
      },

      setVals(vals, pivotId) {
        get().pivot.patchConfig({vals}, pivotId);
      },

      setUnusedOrder(unusedOrder, pivotId) {
        get().pivot.patchConfig({unusedOrder}, pivotId);
      },

      moveField(field, destination, index, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.setConfig(
          moveFieldInConfig(pivot.config, field, destination, index),
          pivotId,
        );
      },

      cycleRowOrder(requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.patchConfig(
          {rowOrder: nextSortOrder(pivot.config.rowOrder)},
          pivotId,
        );
      },

      cycleColOrder(requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.patchConfig(
          {colOrder: nextSortOrder(pivot.config.colOrder)},
          pivotId,
        );
      },

      setAttributeFilterValues(attribute, values, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.setConfig(
          setAttributeFilterValuesInConfig(pivot.config, attribute, values),
          pivotId,
        );
      },

      addAttributeFilterValues(attribute, values, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.setConfig(
          addAttributeFilterValuesInConfig(pivot.config, attribute, values),
          pivotId,
        );
      },

      removeAttributeFilterValues(attribute, values, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.setConfig(
          removeAttributeFilterValuesInConfig(pivot.config, attribute, values),
          pivotId,
        );
      },

      clearAttributeFilter(attribute, requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const pivot = get().pivot.config.pivots[pivotId];
        if (!pivot) return;
        get().pivot.setConfig(
          clearAttributeFilterInConfig(pivot.config, attribute),
          pivotId,
        );
      },

      invalidatePivot(requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.status[pivotId] = {
              ...(draft.pivot.status[pivotId] ?? createDefaultPivotStatus()),
              status: 'stale',
              stale: true,
            };
          }),
        );
      },

      async runPivot(requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        const state = get();
        const pivot = state.pivot.config.pivots[pivotId];
        if (!pivot?.source || pivot.source.kind !== 'table') return;
        const source = pivot.source;
        const table = state.db.tables.find(
          (candidate) => candidate.tableName === source.tableName,
        );
        if (!table) return;

        const controller = new AbortController();
        abortControllers.get(pivotId)?.abort();
        abortControllers.set(pivotId, controller);

        set((draftState) =>
          produce(draftState, (draft) => {
            const previousStatus =
              draft.pivot.status[pivotId] ?? createDefaultPivotStatus();
            draft.pivot.status[pivotId] = {
              ...previousStatus,
              status: 'running',
              stale: false,
              lastError: undefined,
            };
          }),
        );

        try {
          const connector = await state.db.getConnector();
          const nextConfig = sanitizePivotConfigForFields(
            pivot.config,
            getPivotFieldsFromTable(table),
          );
          const relations = await executePivotRelations({
            connector,
            schemaName: 'pivot',
            sourceRelation: table.table.toString(),
            config: nextConfig,
            relationId: pivotId,
            database: state.db.currentDatabase,
            signal: controller.signal,
          });
          set((draftState) =>
            produce(draftState, (draft) => {
              const currentPivot = draft.pivot.config.pivots[pivotId];
              if (currentPivot) {
                currentPivot.config = nextConfig;
              }
              draft.pivot.status[pivotId] = {
                status: 'success',
                stale: false,
                lastRunTime: Date.now(),
                relations,
              };
            }),
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          set((draftState) =>
            produce(draftState, (draft) => {
              draft.pivot.status[pivotId] = {
                ...(draft.pivot.status[pivotId] ?? createDefaultPivotStatus()),
                status: controller.signal.aborted ? 'cancel' : 'error',
                stale: true,
                lastError: message,
              };
            }),
          );
        } finally {
          abortControllers.delete(pivotId);
        }
      },

      cancelPivot(requestedPivotId) {
        const pivotId = getResolvedPivotId(
          get().pivot.config.currentPivotId,
          requestedPivotId,
        );
        if (!pivotId) return;
        abortControllers.get(pivotId)?.abort();
      },
    },
  }));
}
