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
export const NotebookDagMetaSchema = z.object({
  title: z.string().default('Notebook'),
  cellOrder: z.array(z.string()).default([]),
  inputBarOrder: z.array(z.string()).default([]),
  showInputBar: z.boolean().default(true),
});
export type NotebookDagMeta = z.infer<typeof NotebookDagMetaSchema>;

export const NotebookDagSchema = z.object({
  id: z.string(),
  meta: NotebookDagMetaSchema,
});
export type NotebookDag = z.infer<typeof NotebookDagSchema>;

/** Notebook Slice Config (View only) */
export const NotebookSliceConfigSchema = z.object({
  dags: z.record(z.string(), NotebookDagSchema).default({}),
  dagOrder: z.array(z.string()).default([]),
  currentDagId: z.string().optional(),
  currentCellId: z.string().optional(),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfigSchema>;

export const NotebookTabSchema = NotebookDagMetaSchema.extend({id: z.string()});
export type NotebookTab = z.infer<typeof NotebookTabSchema>;

export type InputUnion = z.infer<
  typeof import('@sqlrooms/cells').InputUnionSchema
>;
