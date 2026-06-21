import {SliceFunctions} from '@sqlrooms/room-store';
import {z} from 'zod';
import type {StoreApi} from 'zustand/vanilla';

export const PIVOT_RENDERER_NAMES = [
  'Table',
  'Table Heatmap',
  'Table Col Heatmap',
  'Table Row Heatmap',
  'Exportable TSV',
  'Grouped Column Chart',
  'Stacked Column Chart',
  'Grouped Bar Chart',
  'Stacked Bar Chart',
  'Line Chart',
  'Dot Chart',
  'Area Chart',
  'Scatter Chart',
  'Multiple Pie Chart',
] as const;

export const PivotRendererName = z.enum(PIVOT_RENDERER_NAMES);
export type PivotRendererName = z.infer<typeof PivotRendererName>;

export const PivotSortOrder = z.enum([
  'key_a_to_z',
  'value_a_to_z',
  'value_z_to_a',
]);
export type PivotSortOrder = z.infer<typeof PivotSortOrder>;

export const PivotFilterMapSchema = z.record(z.string(), z.boolean());
export type PivotFilterMap = z.infer<typeof PivotFilterMapSchema>;

export const PivotValueFilterSchema = z.record(
  z.string(),
  PivotFilterMapSchema,
);
export type PivotValueFilter = z.infer<typeof PivotValueFilterSchema>;

export const PivotConfig = z.object({
  rendererName: PivotRendererName.default('Table'),
  aggregatorName: z.string().default('Count'),
  rows: z.array(z.string()).default([]),
  cols: z.array(z.string()).default([]),
  vals: z.array(z.string()).default([]),
  valueFilter: PivotValueFilterSchema.default({}),
  rowOrder: PivotSortOrder.default('key_a_to_z'),
  colOrder: PivotSortOrder.default('key_a_to_z'),
  unusedOrder: z.array(z.string()).default([]),
  menuLimit: z.number().int().positive().default(500),
  hiddenAttributes: z.array(z.string()).default([]),
  hiddenFromAggregators: z.array(z.string()).default([]),
  hiddenFromDragDrop: z.array(z.string()).default([]),
});
export type PivotConfig = z.infer<typeof PivotConfig>;

export const PivotSource = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('table'),
    tableName: z.string(),
  }),
  z.object({
    kind: z.literal('sql'),
    sqlId: z.string(),
  }),
]);
export type PivotSource = z.infer<typeof PivotSource>;

export const PivotRelationViews = z.object({
  cells: z.string().optional(),
  rowTotals: z.string().optional(),
  colTotals: z.string().optional(),
  grandTotal: z.string().optional(),
  export: z.string().optional(),
});
export type PivotRelationViews = z.infer<typeof PivotRelationViews>;

export const PivotRunState = z.enum([
  'idle',
  'running',
  'success',
  'cancel',
  'error',
]);
export type PivotRunState = z.infer<typeof PivotRunState>;

export const PivotStatus = z.object({
  state: PivotRunState.default('idle'),
  stale: z.boolean().default(false),
  lastError: z.string().optional(),
  lastRunTime: z.number().optional(),
  relations: PivotRelationViews.optional(),
  sourceRelation: z.string().optional(),
});
export type PivotStatus = z.infer<typeof PivotStatus>;

function sanitizePersistedPivotStatus(status: PivotStatus): PivotStatus {
  const hasEphemeralRuntimeState = Boolean(
    status.relations ||
    status.sourceRelation ||
    status.lastError ||
    status.state === 'running' ||
    status.state === 'success' ||
    status.state === 'cancel' ||
    status.state === 'error',
  );

  if (!hasEphemeralRuntimeState) {
    return status;
  }

  return {
    state: 'idle',
    stale: true,
    lastRunTime: status.lastRunTime,
  };
}

export const PivotSliceItem = z
  .object({
    id: z.string(),
    title: z.string(),
    source: PivotSource.optional(),
    config: PivotConfig,
    status: PivotStatus.default({state: 'idle', stale: false}),
  })
  .transform((item) => ({
    ...item,
    status: sanitizePersistedPivotStatus(item.status),
  }));
export type PivotSliceItem = z.infer<typeof PivotSliceItem>;

export const PivotSliceConfig = z.object({
  pivots: z.record(z.string(), PivotSliceItem).default({}),
  pivotOrder: z.array(z.string()).default([]),
});
export type PivotSliceConfig = z.infer<typeof PivotSliceConfig>;

export type PivotDropZone = 'unused' | 'rows' | 'cols';

export type PivotField = {
  name: string;
  type: string;
};

export type PivotQuerySource = {
  tableRef: string;
  columns: PivotField[];
};

export type PivotSliceState = {
  pivot: SliceFunctions & {
    config: PivotSliceConfig;
    initialize: () => Promise<void>;
    getPivotStore: (pivotId: string) => PivotInstanceStore;
    addPivot: (props?: {
      id?: string;
      title?: string;
      source?: PivotSource;
      config?: Partial<PivotConfig>;
    }) => string;
    ensurePivot: (
      pivotId: string,
      props?: {
        title?: string;
        source?: PivotSource;
        config?: Partial<PivotConfig>;
      },
    ) => void;
    removePivot: (pivotId: string) => void;
    renamePivot: (pivotId: string, title: string) => void;
    setSource: (pivotId: string, source: PivotSource | undefined) => void;
    setStatus: (pivotId: string, status: Partial<PivotStatus>) => void;
    setConfig: (pivotId: string, config: PivotConfig) => void;
    patchConfig: (pivotId: string, config: Partial<PivotConfig>) => void;
    setRendererName: (pivotId: string, rendererName: PivotRendererName) => void;
    setAggregatorName: (pivotId: string, aggregatorName: string) => void;
    setRows: (pivotId: string, rows: string[]) => void;
    setCols: (pivotId: string, cols: string[]) => void;
    setVals: (pivotId: string, vals: string[]) => void;
    setUnusedOrder: (pivotId: string, unusedOrder: string[]) => void;
    moveField: (
      pivotId: string,
      field: string,
      destination: PivotDropZone,
      index?: number,
    ) => void;
    cycleRowOrder: (pivotId: string) => void;
    cycleColOrder: (pivotId: string) => void;
    setAttributeFilterValues: (
      pivotId: string,
      attribute: string,
      values: string[],
    ) => void;
    addAttributeFilterValues: (
      pivotId: string,
      attribute: string,
      values: string[],
    ) => void;
    removeAttributeFilterValues: (
      pivotId: string,
      attribute: string,
      values: string[],
    ) => void;
    clearAttributeFilter: (pivotId: string, attribute: string) => void;
    runPivot: (
      pivotId: string,
      opts?: {
        cascade?: boolean;
        schemaName?: string;
        querySource?: PivotQuerySource;
      },
    ) => Promise<void>;
  };
};

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

export type PivotOutputCell = {
  rowKey: string[];
  colKey: string[];
  value: number | string | null;
};
