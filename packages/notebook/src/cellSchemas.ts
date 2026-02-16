import {z} from 'zod';
import {
  CellType,
  InputCellData,
  InputTypes,
  SqlCellData,
  TextCellData,
  VegaCellData,
} from '@sqlrooms/cells';

export {InputTypes};
export type NotebookCellType = CellType;

export const SqlCell = z.object({
  id: z.string(),
  type: z.literal('sql'),
  data: SqlCellData,
});
export type SqlCell = z.infer<typeof SqlCell>;

export const TextCell = z.object({
  id: z.string(),
  type: z.literal('text'),
  data: TextCellData,
});
export type TextCell = z.infer<typeof TextCell>;

export const VegaCell = z.object({
  id: z.string(),
  type: z.literal('vega'),
  data: VegaCellData,
});
export type VegaCell = z.infer<typeof VegaCell>;

export const InputCell = z.object({
  id: z.string(),
  type: z.literal('input'),
  data: InputCellData,
});
export type InputCell = z.infer<typeof InputCell>;

export const NotebookCell = z.discriminatedUnion('type', [
  SqlCell,
  TextCell,
  VegaCell,
  InputCell,
]);
export type NotebookCell = z.infer<typeof NotebookCell>;

/** Notebook View Meta */
export const NotebookSheetMeta = z.object({
  cellOrder: z.array(z.string()).default([]),
  inputBarOrder: z.array(z.string()).default([]),
  showInputBar: z.boolean().default(true),
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
  inputBarOrder: z.array(z.string()).default([]),
  showInputBar: z.boolean().default(true),
  name: z.string(), // Title from CellsSlice
});
export type NotebookTab = z.infer<typeof NotebookTab>;

export type InputUnion = z.infer<typeof import('@sqlrooms/cells').InputUnion>;
