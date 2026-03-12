import {z} from 'zod';
import {
  InputCellData,
  InputCellSchema,
  InputTypes,
  PivotCellSchema,
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
} from '@sqlrooms/cells';

export {InputTypes};

export const InputCell = z.object({
  id: z.string(),
  type: z.literal('input'),
  data: InputCellData,
});
export type InputCell = z.infer<typeof InputCell>;

export const NotebookCell = z.discriminatedUnion('type', [
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
  InputCellSchema,
  PivotCellSchema,
]);
export type NotebookCell = z.infer<typeof NotebookCell>;
export type NotebookCellType = NotebookCell['type'];

/** Notebook View Meta */
export const NotebookSheetMeta = z.object({
  cellOrder: z.array(z.string()).default([]),
});
export type NotebookSheetMeta = z.infer<typeof NotebookSheetMeta>;

export const NotebookSheet = z.object({
  id: z.string(),
  meta: NotebookSheetMeta,
});
export type NotebookSheet = z.infer<typeof NotebookSheet>;

/** Notebook Slice Config (View only) */
export const NotebookSliceConfig = z.object({
  sheets: z.record(z.string(), NotebookSheet).default({}),
  currentCellId: z.string().optional(),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfig>;

export const NotebookTab = z.object({
  id: z.string(),
  cellOrder: z.array(z.string()).default([]),
  name: z.string(), // Title from CellsSlice
});
export type NotebookTab = z.infer<typeof NotebookTab>;

export type InputUnion = z.infer<typeof import('@sqlrooms/cells').InputUnion>;
