import {z} from 'zod';
import {
  InputCellData,
  InputTypes,
  InputCellSchema,
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

export const SqlCell = SqlCellSchema;
export type SqlCell = z.infer<typeof SqlCell>;

export const TextCell = TextCellSchema;
export type TextCell = z.infer<typeof TextCell>;

export const VegaCell = VegaCellSchema;
export type VegaCell = z.infer<typeof VegaCell>;

export const PivotCell = PivotCellSchema;
export type PivotCell = z.infer<typeof PivotCell>;

export type NotebookCellType =
  | InputCell['type']
  | SqlCell['type']
  | TextCell['type']
  | VegaCell['type']
  | PivotCell['type'];

export const NotebookCell = z.discriminatedUnion('type', [
  InputCellSchema,
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
  PivotCellSchema,
]);
export type NotebookCell = z.infer<typeof NotebookCell>;

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
