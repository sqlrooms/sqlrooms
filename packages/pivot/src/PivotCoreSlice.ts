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

export type PivotInstanceSnapshot = {
  source?: PivotSource;
  config: PivotConfig;
  status: PivotStatus;
  querySource?: PivotQuerySource;
  fields: PivotField[];
  availableTables: string[];
};

export type PivotInstanceCallbacks = {
  setSource?: (source: PivotSource | undefined) => void;
  setConfig?: (config: PivotConfig) => void;
  run?: () => void | Promise<void>;
};

export type PivotInstanceState = PivotInstanceSnapshot & {
  ui: PivotEditorUiState;
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

export type PivotInstanceStore = StoreApi<PivotInstanceState> & {
  destroy: () => void;
};

export type CreatePivotCoreStoreProps = {
  source?: PivotSource;
  config?: Partial<PivotConfig>;
  status?: Partial<PivotStatus>;
  querySource?: PivotQuerySource;
  fields?: PivotField[];
  availableTables?: string[];
  callbacks?: PivotInstanceCallbacks;
};

function defaultStatus(status?: Partial<PivotStatus>): PivotStatus {
  return {
    state: 'idle',
    stale: false,
    ...status,
  };
}

export function setAttributeFilterValuesInConfig(
  config: PivotConfig,
  attribute: string,
  values: string[],
) {
  return produce(config, (draft) => {
    draft.valueFilter[attribute] = Object.fromEntries(
      values.map((value) => [value, true]),
    );
  });
}

export function addAttributeFilterValuesInConfig(
  config: PivotConfig,
  attribute: string,
  values: string[],
) {
  return produce(config, (draft) => {
    const currentValues = draft.valueFilter[attribute] ?? {};
    for (const value of values) {
      currentValues[value] = true;
    }
    draft.valueFilter[attribute] = currentValues;
  });
}

export function removeAttributeFilterValuesInConfig(
  config: PivotConfig,
  attribute: string,
  values: string[],
) {
  return produce(config, (draft) => {
    const currentValues = {...(draft.valueFilter[attribute] ?? {})};
    for (const value of values) {
      delete currentValues[value];
    }
    if (Object.keys(currentValues).length === 0) {
      delete draft.valueFilter[attribute];
    } else {
      draft.valueFilter[attribute] = currentValues;
    }
  });
}

export function clearAttributeFilterInConfig(
  config: PivotConfig,
  attribute: string,
) {
  return produce(config, (draft) => {
    delete draft.valueFilter[attribute];
  });
}

function createPivotInstanceSnapshot(
  props?: CreatePivotCoreStoreProps,
): PivotInstanceSnapshot {
  const fields = props?.querySource?.columns ?? props?.fields ?? [];
  return {
    source: props?.source,
    config: normalizePivotConfig(
      createDefaultPivotConfig(props?.config),
      fields,
    ),
    status: defaultStatus(props?.status),
    querySource: props?.querySource,
    fields,
    availableTables: props?.availableTables ?? [],
  };
}

/**
 * Create a standalone pivot instance store (not backed by a room store).
 * Used by PivotEditor when no external store is provided.
 */
export function createPivotCoreStore(
  props?: CreatePivotCoreStoreProps,
): PivotInstanceStore {
  const snapshot = createPivotInstanceSnapshot(props);
  const callbacks = props?.callbacks;

  const updateConfig = (
    get: () => PivotInstanceState,
    set: (
      partial:
        | Partial<PivotInstanceState>
        | ((s: PivotInstanceState) => Partial<PivotInstanceState>),
    ) => void,
    updater: (config: PivotConfig) => PivotConfig,
  ) => {
    const nextConfig = normalizePivotConfig(
      updater(get().config),
      get().fields,
    );
    set((state) => ({
      config: nextConfig,
      status: {...state.status, stale: true},
    }));
    callbacks?.setConfig?.(nextConfig);
  };

  const store = createStore<PivotInstanceState>((set, get) => ({
    ...snapshot,
    ui: {sectionOpenState: {}},
    setSource: (source) => {
      const nextConfig = createDefaultPivotConfig();
      set((state) => ({
        source,
        config: nextConfig,
        status: {...state.status, stale: true},
      }));
      callbacks?.setSource?.(source);
      callbacks?.setConfig?.(nextConfig);
    },
    setConfig: (config) => updateConfig(get, set, () => config),
    patchConfig: (partial) =>
      updateConfig(get, set, (c) => ({...c, ...partial})),
    setRendererName: (rendererName) =>
      updateConfig(get, set, (c) => ({...c, rendererName})),
    setAggregatorName: (aggregatorName) =>
      updateConfig(get, set, (c) => ({...c, aggregatorName})),
    setVals: (vals) => updateConfig(get, set, (c) => ({...c, vals})),
    moveField: (field, destination, index) =>
      updateConfig(get, set, (c) =>
        moveFieldInConfig(c, field, destination, index),
      ),
    cycleRowOrder: () =>
      updateConfig(get, set, (c) => ({
        ...c,
        rowOrder: nextSortOrder(c.rowOrder),
      })),
    cycleColOrder: () =>
      updateConfig(get, set, (c) => ({
        ...c,
        colOrder: nextSortOrder(c.colOrder),
      })),
    setAttributeFilterValues: (attr, vals) =>
      updateConfig(get, set, (c) =>
        setAttributeFilterValuesInConfig(c, attr, vals),
      ),
    addAttributeFilterValues: (attr, vals) =>
      updateConfig(get, set, (c) =>
        addAttributeFilterValuesInConfig(c, attr, vals),
      ),
    removeAttributeFilterValues: (attr, vals) =>
      updateConfig(get, set, (c) =>
        removeAttributeFilterValuesInConfig(c, attr, vals),
      ),
    clearAttributeFilter: (attr) =>
      updateConfig(get, set, (c) => clearAttributeFilterInConfig(c, attr)),
    setSectionOpen: (section, isOpen) =>
      set((state) => ({
        ui: {
          ...state.ui,
          sectionOpenState: {...state.ui.sectionOpenState, [section]: isOpen},
        },
      })),
    run: async () => {
      await callbacks?.run?.();
    },
  }));

  return Object.assign(store, {destroy: () => undefined});
}
