import {SliceFunctions} from '@sqlrooms/room-store';
import {z} from 'zod';

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

export const PivotExecutionState = z.enum([
  'idle',
  'running',
  'success',
  'cancel',
  'error',
  'stale',
]);
export type PivotExecutionState = z.infer<typeof PivotExecutionState>;

export const PivotRelationType = z.enum(['view', 'table']);
export type PivotRelationType = z.infer<typeof PivotRelationType>;

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

export const PivotRelations = z.object({
  cellsRelation: z.string(),
  rowTotalsRelation: z.string(),
  colTotalsRelation: z.string(),
  grandTotalRelation: z.string(),
  relationType: PivotRelationType.default('view'),
});
export type PivotRelations = z.infer<typeof PivotRelations>;

export const PivotStatus = z.object({
  status: PivotExecutionState.default('idle'),
  stale: z.boolean().default(false),
  lastError: z.string().optional(),
  lastRunTime: z.number().optional(),
  relations: PivotRelations.optional(),
});
export type PivotStatus = z.infer<typeof PivotStatus>;

export const PivotInstanceConfig = z.object({
  id: z.string(),
  title: z.string().default('Pivot'),
  source: PivotSource.optional(),
  config: PivotConfig,
});
export type PivotInstanceConfig = z.infer<typeof PivotInstanceConfig>;

export const PivotSliceConfig = z.object({
  pivots: z.record(z.string(), PivotInstanceConfig).default({}),
  order: z.array(z.string()).default([]),
  currentPivotId: z.string().optional(),
});
export type PivotSliceConfig = z.infer<typeof PivotSliceConfig>;

export type PivotDropZone = 'unused' | 'rows' | 'cols';

export type PivotField = {
  name: string;
  type: string;
};

export type PivotSourceOption = {
  value: string;
  label: string;
  source: PivotSource;
  fields: PivotField[];
  relationName?: string;
};

export type PivotSliceState = {
  pivot: SliceFunctions & {
    config: PivotSliceConfig;
    status: Record<string, PivotStatus>;
    initialize: () => Promise<void>;
    addPivot: (args?: {
      title?: string;
      source?: PivotSource;
      config?: Partial<PivotConfig>;
    }) => string;
    removePivot: (pivotId: string) => Promise<void>;
    renamePivot: (pivotId: string, title: string) => void;
    setCurrentPivot: (pivotId: string) => void;
    setSource: (source: PivotSource | undefined, pivotId?: string) => void;
    setConfig: (config: PivotConfig, pivotId?: string) => void;
    patchConfig: (config: Partial<PivotConfig>, pivotId?: string) => void;
    setRendererName: (
      rendererName: PivotRendererName,
      pivotId?: string,
    ) => void;
    setAggregatorName: (aggregatorName: string, pivotId?: string) => void;
    setRows: (rows: string[], pivotId?: string) => void;
    setCols: (cols: string[], pivotId?: string) => void;
    setVals: (vals: string[], pivotId?: string) => void;
    setUnusedOrder: (unusedOrder: string[], pivotId?: string) => void;
    moveField: (
      field: string,
      destination: PivotDropZone,
      index?: number,
      pivotId?: string,
    ) => void;
    cycleRowOrder: (pivotId?: string) => void;
    cycleColOrder: (pivotId?: string) => void;
    setAttributeFilterValues: (
      attribute: string,
      values: string[],
      pivotId?: string,
    ) => void;
    addAttributeFilterValues: (
      attribute: string,
      values: string[],
      pivotId?: string,
    ) => void;
    removeAttributeFilterValues: (
      attribute: string,
      values: string[],
      pivotId?: string,
    ) => void;
    clearAttributeFilter: (attribute: string, pivotId?: string) => void;
    invalidatePivot: (pivotId?: string) => void;
    runPivot: (pivotId?: string) => Promise<void>;
    cancelPivot: (pivotId?: string) => void;
  };
};

export type PivotOutputCell = {
  rowKey: string[];
  colKey: string[];
  value: number | string | null;
};
