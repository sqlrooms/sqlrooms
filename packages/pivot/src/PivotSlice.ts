import {DuckDbSliceState} from '@sqlrooms/duckdb';
import {BaseRoomStoreState, createSlice} from '@sqlrooms/room-store';
import {produce} from 'immer';
import {z} from 'zod';
import {DEFAULT_PIVOT_AGGREGATOR} from './aggregators';
import {PivotSliceConfig, PivotSliceState, PivotSortOrder} from './types';

export function createDefaultPivotConfig(
  props?: Partial<PivotSliceConfig>,
): PivotSliceConfig {
  return PivotSliceConfig.parse({
    aggregatorName: DEFAULT_PIVOT_AGGREGATOR,
    rendererName: 'Table',
    rows: [],
    cols: [],
    vals: [],
    valueFilter: {},
    rowOrder: PivotSortOrder.enum.key_a_to_z,
    colOrder: PivotSortOrder.enum.key_a_to_z,
    unusedOrder: [],
    menuLimit: 500,
    hiddenAttributes: [],
    hiddenFromAggregators: [],
    hiddenFromDragDrop: [],
    ...props,
  });
}

function nextSortOrder(current: z.infer<typeof PivotSortOrder>) {
  switch (current) {
    case PivotSortOrder.enum.key_a_to_z:
      return PivotSortOrder.enum.value_a_to_z;
    case PivotSortOrder.enum.value_a_to_z:
      return PivotSortOrder.enum.value_z_to_a;
    default:
      return PivotSortOrder.enum.key_a_to_z;
  }
}

export function createPivotSlice(props?: {config?: Partial<PivotSliceConfig>}) {
  return createSlice<
    PivotSliceState,
    BaseRoomStoreState & DuckDbSliceState & PivotSliceState
  >((set, get) => ({
    pivot: {
      config: createDefaultPivotConfig(props?.config),

      async initialize() {
        const tables = get().db.tables;
        if (tables.length === 0) {
          return;
        }
        const currentTable = get().pivot.config.tableName;
        const nextTable = tables.find(
          (table) => table.tableName === currentTable,
        )
          ? currentTable
          : tables[0]?.tableName;
        if (!nextTable) {
          return;
        }

        const availableFields = new Set(
          (
            tables.find((table) => table.tableName === nextTable)?.columns ?? []
          ).map((column) => column.name),
        );

        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.tableName = nextTable;
            draft.pivot.config.rows = draft.pivot.config.rows.filter((field) =>
              availableFields.has(field),
            );
            draft.pivot.config.cols = draft.pivot.config.cols.filter((field) =>
              availableFields.has(field),
            );
            draft.pivot.config.vals = draft.pivot.config.vals.filter((field) =>
              availableFields.has(field),
            );
            draft.pivot.config.unusedOrder =
              draft.pivot.config.unusedOrder.filter((field) =>
                availableFields.has(field),
              );
            draft.pivot.config.valueFilter = Object.fromEntries(
              Object.entries(draft.pivot.config.valueFilter).filter(([field]) =>
                availableFields.has(field),
              ),
            );
          }),
        );
      },

      setConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config = PivotSliceConfig.parse(config);
          }),
        );
      },

      patchConfig(config) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config = PivotSliceConfig.parse({
              ...draft.pivot.config,
              ...config,
            });
          }),
        );
      },

      setTableName(tableName) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.tableName = tableName;
            draft.pivot.config.rows = [];
            draft.pivot.config.cols = [];
            draft.pivot.config.vals = [];
            draft.pivot.config.unusedOrder = [];
            draft.pivot.config.valueFilter = {};
          }),
        );
      },

      setRendererName(rendererName) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.rendererName = rendererName;
          }),
        );
      },

      setAggregatorName(aggregatorName) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.aggregatorName = aggregatorName;
          }),
        );
      },

      setRows(rows) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.rows = rows;
          }),
        );
      },

      setCols(cols) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.cols = cols;
          }),
        );
      },

      setVals(vals) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.vals = vals;
          }),
        );
      },

      setUnusedOrder(unusedOrder) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.unusedOrder = unusedOrder;
          }),
        );
      },

      moveField(field, destination, index) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.rows = draft.pivot.config.rows.filter(
              (value) => value !== field,
            );
            draft.pivot.config.cols = draft.pivot.config.cols.filter(
              (value) => value !== field,
            );
            draft.pivot.config.unusedOrder =
              draft.pivot.config.unusedOrder.filter((value) => value !== field);

            const target =
              destination === 'rows'
                ? draft.pivot.config.rows
                : destination === 'cols'
                  ? draft.pivot.config.cols
                  : draft.pivot.config.unusedOrder;

            const targetIndex =
              index === undefined || index < 0 || index > target.length
                ? target.length
                : index;
            target.splice(targetIndex, 0, field);
          }),
        );
      },

      cycleRowOrder() {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.rowOrder = nextSortOrder(
              draft.pivot.config.rowOrder,
            );
          }),
        );
      },

      cycleColOrder() {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.colOrder = nextSortOrder(
              draft.pivot.config.colOrder,
            );
          }),
        );
      },

      setAttributeFilterValues(attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            draft.pivot.config.valueFilter[attribute] = Object.fromEntries(
              values.map((value) => [value, true]),
            );
          }),
        );
      },

      addAttributeFilterValues(attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const current = draft.pivot.config.valueFilter[attribute] ?? {};
            for (const value of values) {
              current[value] = true;
            }
            draft.pivot.config.valueFilter[attribute] = current;
          }),
        );
      },

      removeAttributeFilterValues(attribute, values) {
        set((state) =>
          produce(state, (draft) => {
            const current = {
              ...(draft.pivot.config.valueFilter[attribute] ?? {}),
            };
            for (const value of values) {
              delete current[value];
            }
            if (Object.keys(current).length === 0) {
              delete draft.pivot.config.valueFilter[attribute];
            } else {
              draft.pivot.config.valueFilter[attribute] = current;
            }
          }),
        );
      },

      clearAttributeFilter(attribute) {
        set((state) =>
          produce(state, (draft) => {
            delete draft.pivot.config.valueFilter[attribute];
          }),
        );
      },
    },
  }));
}
