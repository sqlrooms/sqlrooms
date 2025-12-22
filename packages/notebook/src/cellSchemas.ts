import {z} from 'zod';
import {
  CellTypes,
  InputTypes,
  SqlCellDataSchema,
  TextCellDataSchema,
  VegaCellDataSchema,
  InputCellDataSchema,
} from '@sqlrooms/cells';

export {CellTypes as NotebookCellTypes, InputTypes};

export const SqlCellSchema = z.object({
  id: z.string(),
  type: z.literal('sql'),
  data: SqlCellDataSchema,
});
export type SqlCell = z.infer<typeof SqlCellSchema>;

export const TextCellSchema = z.object({
  id: z.string(),
  type: z.literal('text'),
  data: TextCellDataSchema,
});
export type TextCell = z.infer<typeof TextCellSchema>;

export const VegaCellSchema = z.object({
  id: z.string(),
  type: z.literal('vega'),
  data: VegaCellDataSchema,
});
export type VegaCell = z.infer<typeof VegaCellSchema>;

export const InputCellSchema = z.object({
  id: z.string(),
  type: z.literal('input'),
  data: InputCellDataSchema,
});
export type InputCell = z.infer<typeof InputCellSchema>;

export const NotebookCellSchema = z.discriminatedUnion('type', [
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
  InputCellSchema,
]);
export type NotebookCell = z.infer<typeof NotebookCellSchema>;

/** Notebook View Meta */
export const NotebookSheetMetaSchema = z.object({
  cellOrder: z.array(z.string()).default([]),
  inputBarOrder: z.array(z.string()).default([]),
  showInputBar: z.boolean().default(true),
});
export type NotebookSheetMeta = z.infer<typeof NotebookSheetMetaSchema>;

export const NotebookSheetSchema = z.object({
  id: z.string(),
  meta: NotebookSheetMetaSchema,
});
export type NotebookSheet = z.infer<typeof NotebookSheetSchema>;

/** Notebook Slice Config (View only) */
export const NotebookSliceConfigSchema = z.object({
  sheets: z.record(z.string(), NotebookSheetSchema).default({}),
  currentCellId: z.string().optional(),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfigSchema>;

export const NotebookTabSchema = z.object({
  id: z.string(),
  cellOrder: z.array(z.string()).default([]),
  inputBarOrder: z.array(z.string()).default([]),
  showInputBar: z.boolean().default(true),
  name: z.string(), // Title from CellsSlice
});
export type NotebookTab = z.infer<typeof NotebookTabSchema>;

export type InputUnion = z.infer<
  typeof import('@sqlrooms/cells').InputUnionSchema
>;
