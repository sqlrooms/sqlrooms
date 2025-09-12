import {z} from 'zod';

export const NotebookCellTypes = z.enum(['sql', 'text', 'vega', 'input']);
export type NotebookCellTypes = z.infer<typeof NotebookCellTypes>;

export const SqlCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Untitled'),
  type: z.literal('sql'),
  sql: z.string().default(''),
});
export type SqlCell = z.infer<typeof SqlCellSchema>;

export const TextCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Text'),
  type: z.literal('text'),
  text: z.string().default(''),
});
export type TextCell = z.infer<typeof TextCellSchema>;

export const VegaCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Chart'),
  type: z.literal('vega'),
  sql: z.string().default(''),
  vegaSpec: z.any().optional(),
});
export type VegaCell = z.infer<typeof VegaCellSchema>;

export const InputCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Input'),
  type: z.literal('input'),
  input: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('slider'),
      varName: z.string(),
      min: z.number().default(0),
      max: z.number().default(100),
      step: z.number().default(1),
      value: z.number().default(0),
    }),
    z.object({
      kind: z.literal('text'),
      varName: z.string(),
      value: z.string().default(''),
    }),
    z.object({
      kind: z.literal('dropdown'),
      varName: z.string(),
      options: z.array(z.string()).default([]),
      value: z.string().default(''),
    }),
  ]),
});
export type InputCell = z.infer<typeof InputCellSchema>;

export const NotebookCellSchema = z.discriminatedUnion('type', [
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
  InputCellSchema,
]);
export type NotebookCell = z.infer<typeof NotebookCellSchema>;

export const NotebookTabSchema = z.object({
  id: z.string(),
  title: z.string().default('Notebook'),
  cellOrder: z.array(z.string()).default([]),
});
export type NotebookTab = z.infer<typeof NotebookTabSchema>;

export const NotebookSliceConfig = z.object({
  notebook: z.object({
    tabs: z.array(NotebookTabSchema).default([]),
    currentTabId: z.string().optional(),
    cells: z.record(z.string(), NotebookCellSchema).default({}),
    currentCellId: z.string().optional(),
  }),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfig>;
