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

export const PivotFilterMapSchema = z.record(z.string(), z.boolean());
export type PivotFilterMap = z.infer<typeof PivotFilterMapSchema>;

export const PivotValueFilterSchema = z.record(
  z.string(),
  PivotFilterMapSchema,
);
export type PivotValueFilter = z.infer<typeof PivotValueFilterSchema>;

export const PivotSliceConfig = z.object({
  tableName: z.string().optional(),
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
export type PivotSliceConfig = z.infer<typeof PivotSliceConfig>;

export type PivotDropZone = 'unused' | 'rows' | 'cols';

export type PivotField = {
  name: string;
  type: string;
};

export type PivotSliceState = {
  pivot: SliceFunctions & {
    config: PivotSliceConfig;
    initialize: () => Promise<void>;
    setConfig: (config: PivotSliceConfig) => void;
    patchConfig: (config: Partial<PivotSliceConfig>) => void;
    setTableName: (tableName: string | undefined) => void;
    setRendererName: (rendererName: PivotRendererName) => void;
    setAggregatorName: (aggregatorName: string) => void;
    setRows: (rows: string[]) => void;
    setCols: (cols: string[]) => void;
    setVals: (vals: string[]) => void;
    setUnusedOrder: (unusedOrder: string[]) => void;
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
  };
};

export type PivotOutputCell = {
  rowKey: string[];
  colKey: string[];
  value: number | string | null;
};
