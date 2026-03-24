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
import type {PivotHostBinding, PivotPersistedState} from './PivotBinding';

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
  startSync?: () => void;
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

function sameQuerySource(
  a: PivotQuerySource | undefined,
  b: PivotQuerySource | undefined,
) {
  if (a?.tableRef !== b?.tableRef) {
    return false;
  }
  return samePivotFields(a?.columns ?? [], b?.columns ?? []);
}

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

function createDefaultPivotPersistedState(
  partial?: Partial<PivotPersistedState>,
): PivotPersistedState {
  return {
    source: partial?.source,
    config: createDefaultPivotConfig(partial?.config),
  };
}

function samePivotSnapshot(a: PivotInstanceSnapshot, b: PivotInstanceSnapshot) {
  return (
    sameJson(a.source, b.source) &&
    sameJson(a.config, b.config) &&
    sameJson(a.status, b.status) &&
    sameQuerySource(a.querySource, b.querySource) &&
    samePivotFields(a.fields, b.fields) &&
    sameStringArray(a.availableTables, b.availableTables)
  );
}

type PivotInstanceInternalOps = {
  setSourceImpl: (source: PivotSource | undefined) => void;
  setConfigImpl: (config: PivotConfig) => void;
  runImpl: () => Promise<void>;
};

function createPivotInstanceActions(
  get: () => PivotInstanceState,
  set: (
    partial:
      | Partial<PivotInstanceState>
      | ((state: PivotInstanceState) => Partial<PivotInstanceState>),
  ) => void,
  ops: PivotInstanceInternalOps,
): Omit<PivotInstanceState, keyof PivotInstanceSnapshot | 'ui'> {
  const applyConfigChange = (updater: (config: PivotConfig) => PivotConfig) => {
    const nextConfig = normalizePivotConfig(
      updater(get().config),
      get().fields,
    );
    ops.setConfigImpl(nextConfig);
  };

  return {
    setSource: (source) => ops.setSourceImpl(source),
    setConfig: (config) => {
      const nextConfig = normalizePivotConfig(config, get().fields);
      ops.setConfigImpl(nextConfig);
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
        setAttributeFilterValuesInConfig(current, attribute, values),
      );
    },
    addAttributeFilterValues: (attribute, values) => {
      applyConfigChange((current) =>
        addAttributeFilterValuesInConfig(current, attribute, values),
      );
    },
    removeAttributeFilterValues: (attribute, values) => {
      applyConfigChange((current) =>
        removeAttributeFilterValuesInConfig(current, attribute, values),
      );
    },
    clearAttributeFilter: (attribute) => {
      applyConfigChange((current) =>
        clearAttributeFilterInConfig(current, attribute),
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
      await ops.runImpl();
    },
  };
}

export function createPivotCoreStore(
  props?: CreatePivotCoreStoreProps,
): PivotInstanceStore {
  const snapshot = createPivotInstanceSnapshot(props);
  const callbacks = props?.callbacks;
  const store = createStore<PivotInstanceState>((set, get) => ({
    ...snapshot,
    ui: {
      sectionOpenState: {},
    },
    ...createPivotInstanceActions(get, set, {
      setSourceImpl: (source) => {
        const nextConfig = createDefaultPivotConfig();
        set((state) => ({
          source,
          config: nextConfig,
          status: {
            ...state.status,
            stale: true,
          },
        }));
        callbacks?.setSource?.(source);
        callbacks?.setConfig?.(nextConfig);
      },
      setConfigImpl: (config) => {
        set((state) => ({
          config,
          status: {
            ...state.status,
            stale: true,
          },
        }));
        callbacks?.setConfig?.(config);
      },
      runImpl: async () => {
        await callbacks?.run?.();
      },
    }),
  }));

  return Object.assign(store, {
    destroy: () => undefined,
  });
}

function getBoundPivotSnapshot<RootState, Id extends string>(
  rootStore: StoreApi<RootState>,
  id: Id,
  binding: PivotHostBinding<RootState, Id>,
): PivotInstanceSnapshot {
  const rootState = rootStore.getState();
  const persistedState = createDefaultPivotPersistedState(
    binding.getPersistedState(rootState, id),
  );
  const runtimeState = binding.getRuntimeState(rootState, id);
  const fields = runtimeState.querySource?.columns ?? runtimeState.fields;

  return {
    source: persistedState.source,
    config: normalizePivotConfig(persistedState.config, fields),
    status: defaultStatus(runtimeState.status),
    querySource: runtimeState.querySource,
    fields,
    availableTables: runtimeState.availableTables,
  };
}

export function createPivotBoundStore<RootState, Id extends string>(args: {
  rootStore: StoreApi<RootState>;
  id: Id;
  binding: PivotHostBinding<RootState, Id>;
}): PivotInstanceStore {
  let currentSnapshot = getBoundPivotSnapshot(
    args.rootStore,
    args.id,
    args.binding,
  );
  const store = createStore<PivotInstanceState>((set, get) => ({
    ...currentSnapshot,
    ui: {
      sectionOpenState: {},
    },
    ...createPivotInstanceActions(get, set, {
      setSourceImpl: (source) => {
        set((state) => ({
          ...state,
          source,
          config: createDefaultPivotConfig(),
          status: {...state.status, stale: true},
        }));
        args.binding.setPersistedState(args.id, () =>
          createDefaultPivotPersistedState({source}),
        );
      },
      setConfigImpl: (config) => {
        set((state) => ({
          ...state,
          config,
          status: {...state.status, stale: true},
        }));
        args.binding.setPersistedState(args.id, (current) => ({
          ...current,
          config,
        }));
      },
      runImpl: async () => {
        await args.binding.run(args.id);
      },
    }),
  }));

  let unsubscribe: (() => void) | undefined;

  function startSync() {
    stopSync();
    currentSnapshot = getBoundPivotSnapshot(
      args.rootStore,
      args.id,
      args.binding,
    );
    store.setState((state) => ({...state, ...currentSnapshot}));
    unsubscribe = args.binding.subscribe(() => {
      const nextSnapshot = getBoundPivotSnapshot(
        args.rootStore,
        args.id,
        args.binding,
      );
      if (samePivotSnapshot(currentSnapshot, nextSnapshot)) {
        return;
      }
      currentSnapshot = nextSnapshot;
      store.setState((state) => ({
        ...state,
        ...nextSnapshot,
      }));
    });
  }

  function stopSync() {
    unsubscribe?.();
    unsubscribe = undefined;
  }

  startSync();

  return Object.assign(store, {
    destroy: stopSync,
    startSync,
  });
}
