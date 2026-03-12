import {
  DEFAULT_PIVOT_AGGREGATOR,
  getDefaultValuesForAggregator,
} from './aggregators';
import {produce} from 'immer';
import {createStore, type StoreApi} from 'zustand/vanilla';
import {z} from 'zod';
import {
  type PivotConfig,
  type PivotDropZone,
  type PivotField,
  type PivotQuerySource,
  type PivotSource,
  type PivotStatus,
  PivotConfig as PivotConfigSchema,
  PivotSortOrder,
} from './types';

export function createDefaultPivotConfig(
  props?: Partial<PivotConfig>,
): PivotConfig {
  return PivotConfigSchema.parse({
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

export function nextSortOrder(current: z.infer<typeof PivotSortOrder>) {
  switch (current) {
    case PivotSortOrder.enum.key_a_to_z:
      return PivotSortOrder.enum.value_a_to_z;
    case PivotSortOrder.enum.value_a_to_z:
      return PivotSortOrder.enum.value_z_to_a;
    default:
      return PivotSortOrder.enum.key_a_to_z;
  }
}

export function moveFieldInConfig(
  config: PivotConfig,
  field: string,
  destination: PivotDropZone,
  index?: number,
): PivotConfig {
  return produce(config, (draft) => {
    draft.rows = draft.rows.filter((value) => value !== field);
    draft.cols = draft.cols.filter((value) => value !== field);
    draft.unusedOrder = draft.unusedOrder.filter((value) => value !== field);

    const target =
      destination === 'rows'
        ? draft.rows
        : destination === 'cols'
          ? draft.cols
          : draft.unusedOrder;

    const targetIndex =
      index === undefined || index < 0 || index > target.length
        ? target.length
        : index;
    target.splice(targetIndex, 0, field);
  });
}

export function normalizePivotConfig(
  config: PivotConfig,
  fields: PivotField[],
): PivotConfig {
  const availableFields = new Set(fields.map((field) => field.name));
  const filteredConfig = produce(config, (draft) => {
    draft.rows = draft.rows.filter((field) => availableFields.has(field));
    draft.cols = draft.cols.filter((field) => availableFields.has(field));
    draft.vals = draft.vals.filter((field) => availableFields.has(field));
    draft.unusedOrder = draft.unusedOrder.filter((field) =>
      availableFields.has(field),
    );
    draft.valueFilter = Object.fromEntries(
      Object.entries(draft.valueFilter).filter(([field]) =>
        availableFields.has(field),
      ),
    );
  });

  return produce(filteredConfig, (draft) => {
    draft.vals = getDefaultValuesForAggregator({
      aggregatorName: draft.aggregatorName,
      fields: fields.filter(
        (field) => !draft.hiddenFromAggregators.includes(field.name),
      ),
      currentValues: draft.vals,
    });
  });
}

export type PivotEditorUiState = {
  sectionOpenState: Record<string, boolean>;
};

export type PivotCoreHostCallbacks = {
  onSourceChange?: (source: PivotSource | undefined) => void;
  onConfigChange?: (config: PivotConfig) => void;
  onRun?: () => void | Promise<void>;
};

export type PivotCoreSliceState = {
  source?: PivotSource;
  config: PivotConfig;
  status: PivotStatus;
  querySource?: PivotQuerySource;
  fields: PivotField[];
  availableTables: string[];
  ui: PivotEditorUiState;
  syncFromHost: (
    partial: Partial<
      Pick<
        PivotCoreSliceState,
        | 'source'
        | 'config'
        | 'status'
        | 'querySource'
        | 'fields'
        | 'availableTables'
      >
    >,
  ) => void;
  setFields: (fields: PivotField[]) => void;
  setAvailableTables: (tableNames: string[]) => void;
  setSource: (source: PivotSource | undefined) => void;
  setConfig: (config: PivotConfig) => void;
  patchConfig: (config: Partial<PivotConfig>) => void;
  setRendererName: (rendererName: PivotConfig['rendererName']) => void;
  setAggregatorName: (aggregatorName: string) => void;
  setVals: (vals: string[]) => void;
  moveField: (
    field: string,
    destination: PivotDropZone,
    index?: number,
  ) => void;
  cycleRowOrder: () => void;
  cycleColOrder: () => void;
  setAttributeFilterValues: (attribute: string, values: string[]) => void;
  addAttributeFilterValues: (attribute: string, values: string[]) => void;
  removeAttributeFilterValues: (attribute: string, values: string[]) => void;
  clearAttributeFilter: (attribute: string) => void;
  setSectionOpen: (section: string, isOpen: boolean) => void;
  run: () => Promise<void>;
};

export type CreatePivotCoreStoreProps = {
  source?: PivotSource;
  config?: Partial<PivotConfig>;
  status?: Partial<PivotStatus>;
  querySource?: PivotQuerySource;
  fields?: PivotField[];
  availableTables?: string[];
  callbacks?: PivotCoreHostCallbacks;
};

function sameJson(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameStringArray(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function samePivotFields(a: PivotField[], b: PivotField[]) {
  return (
    a.length === b.length &&
    a.every(
      (field, index) =>
        field.name === b[index]?.name && field.type === b[index]?.type,
    )
  );
}

function defaultStatus(status?: Partial<PivotStatus>): PivotStatus {
  return {
    state: 'idle',
    stale: false,
    ...status,
  };
}

export function createPivotCoreStore(
  props?: CreatePivotCoreStoreProps,
): StoreApi<PivotCoreSliceState> {
  const callbacks = props?.callbacks;

  const applyConfigChange = (updater: (config: PivotConfig) => PivotConfig) => {
    const previous = store.getState();
    const nextConfig = normalizePivotConfig(
      updater(previous.config),
      previous.fields,
    );
    store.setState({
      config: nextConfig,
      status: {
        ...previous.status,
        stale: true,
      },
    });
    callbacks?.onConfigChange?.(nextConfig);
  };
  const store = createStore<PivotCoreSliceState>((set, get) => ({
    source: props?.source,
    config: normalizePivotConfig(
      createDefaultPivotConfig(props?.config),
      props?.querySource?.columns ?? props?.fields ?? [],
    ),
    status: defaultStatus(props?.status),
    querySource: props?.querySource,
    fields: props?.querySource?.columns ?? props?.fields ?? [],
    availableTables: props?.availableTables ?? [],
    ui: {
      sectionOpenState: {},
    },
    syncFromHost: (partial) => {
      set((state) => {
        const nextFields =
          partial.querySource?.columns ?? partial.fields ?? state.fields;
        const nextConfig = partial.config
          ? normalizePivotConfig(partial.config, nextFields)
          : state.config;
        const nextStatus = partial.status
          ? defaultStatus(partial.status)
          : state.status;
        const nextSource = Object.prototype.hasOwnProperty.call(
          partial,
          'source',
        )
          ? partial.source
          : state.source;
        const nextQuerySource = partial.querySource ?? state.querySource;
        const nextAvailableTables =
          partial.availableTables ?? state.availableTables;

        if (
          sameJson(nextSource, state.source) &&
          sameJson(nextConfig, state.config) &&
          sameJson(nextStatus, state.status) &&
          sameJson(nextQuerySource, state.querySource) &&
          samePivotFields(nextFields, state.fields) &&
          sameStringArray(nextAvailableTables, state.availableTables)
        ) {
          return state;
        }

        return {
          ...state,
          source: nextSource,
          config: nextConfig,
          status: nextStatus,
          querySource: nextQuerySource,
          fields: nextFields,
          availableTables: nextAvailableTables,
        };
      });
    },
    setFields: (fields) => {
      set((state) => ({
        fields,
        config: normalizePivotConfig(state.config, fields),
      }));
    },
    setAvailableTables: (availableTables) => set({availableTables}),
    setSource: (source) => {
      set((state) => ({
        source,
        config: createDefaultPivotConfig(),
        status: {
          ...state.status,
          stale: true,
        },
      }));
      callbacks?.onSourceChange?.(source);
      callbacks?.onConfigChange?.(createDefaultPivotConfig());
    },
    setConfig: (config) => {
      const nextConfig = normalizePivotConfig(config, get().fields);
      set((state) => ({
        config: nextConfig,
        status: {
          ...state.status,
          stale: true,
        },
      }));
      callbacks?.onConfigChange?.(nextConfig);
    },
    patchConfig: (config) => {
      applyConfigChange((current) => ({
        ...current,
        ...config,
      }));
    },
    setRendererName: (rendererName) => {
      applyConfigChange((current) => ({
        ...current,
        rendererName,
      }));
    },
    setAggregatorName: (aggregatorName) => {
      applyConfigChange((current) => ({
        ...current,
        aggregatorName,
      }));
    },
    setVals: (vals) => {
      applyConfigChange((current) => ({
        ...current,
        vals,
      }));
    },
    moveField: (field, destination, index) => {
      applyConfigChange((current) =>
        moveFieldInConfig(current, field, destination, index),
      );
    },
    cycleRowOrder: () => {
      applyConfigChange((current) => ({
        ...current,
        rowOrder: nextSortOrder(current.rowOrder),
      }));
    },
    cycleColOrder: () => {
      applyConfigChange((current) => ({
        ...current,
        colOrder: nextSortOrder(current.colOrder),
      }));
    },
    setAttributeFilterValues: (attribute, values) => {
      applyConfigChange((current) =>
        produce(current, (draft) => {
          draft.valueFilter[attribute] = Object.fromEntries(
            values.map((value) => [value, true]),
          );
        }),
      );
    },
    addAttributeFilterValues: (attribute, values) => {
      applyConfigChange((current) =>
        produce(current, (draft) => {
          const currentValues = draft.valueFilter[attribute] ?? {};
          for (const value of values) {
            currentValues[value] = true;
          }
          draft.valueFilter[attribute] = currentValues;
        }),
      );
    },
    removeAttributeFilterValues: (attribute, values) => {
      applyConfigChange((current) =>
        produce(current, (draft) => {
          const currentValues = {...(draft.valueFilter[attribute] ?? {})};
          for (const value of values) {
            delete currentValues[value];
          }
          if (Object.keys(currentValues).length === 0) {
            delete draft.valueFilter[attribute];
          } else {
            draft.valueFilter[attribute] = currentValues;
          }
        }),
      );
    },
    clearAttributeFilter: (attribute) => {
      applyConfigChange((current) =>
        produce(current, (draft) => {
          delete draft.valueFilter[attribute];
        }),
      );
    },
    setSectionOpen: (section, isOpen) =>
      set((state) => ({
        ui: {
          ...state.ui,
          sectionOpenState: {
            ...state.ui.sectionOpenState,
            [section]: isOpen,
          },
        },
      })),
    run: async () => {
      await callbacks?.onRun?.();
    },
  }));
  return store;
}
