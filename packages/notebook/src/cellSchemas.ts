import {z} from 'zod';

/** Notebook input types in Input Cell */
export const InputTypes = z.enum(['text', 'slider', 'dropdown']);
export type InputTypes = z.infer<typeof InputTypes>;

const InputText = z.object({
  kind: z.literal(InputTypes.enum.text),
  varName: z.string(),
  value: z.string().default(''),
});
export type InputText = z.infer<typeof InputText>;

const InputSlider = z.object({
  kind: z.literal(InputTypes.enum.slider),
  varName: z.string(),
  min: z.number().default(0),
  max: z.number().default(100),
  step: z.number().default(1),
  value: z.number().default(0),
});
export type InputSlider = z.infer<typeof InputSlider>;

const InputDropdown = z.object({
  kind: z.literal(InputTypes.enum.dropdown),
  varName: z.string(),
  options: z.array(z.string()).default([]),
  value: z.string().default(''),
});
export type InputDropdown = z.infer<typeof InputDropdown>;

export const InputUnion = z.discriminatedUnion('kind', [
  InputText,
  InputSlider,
  InputDropdown,
]);
export type InputUnion = z.infer<typeof InputUnion>;

/** Notebook Cell */
export const NotebookCellTypes = z.enum(['sql', 'text', 'vega', 'input']);
export type NotebookCellTypes = z.infer<typeof NotebookCellTypes>;

export const SqlCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Untitled'),
  type: z.literal(NotebookCellTypes.enum.sql),
  sql: z.string().default(''),
});
export type SqlCell = z.infer<typeof SqlCellSchema>;

export const TextCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Text'),
  type: z.literal(NotebookCellTypes.enum.text),
  text: z.string().default(''),
});
export type TextCell = z.infer<typeof TextCellSchema>;

export const VegaCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Chart'),
  type: z.literal(NotebookCellTypes.enum.vega),
  sqlId: z.string().default(''),
  vegaSpec: z.any().optional(),
});
export type VegaCell = z.infer<typeof VegaCellSchema>;

export const InputCellSchema = z.object({
  id: z.string(),
  name: z.string().default('Input'),
  type: z.literal('input'),
  input: InputUnion,
});
export type InputCell = z.infer<typeof InputCellSchema>;

export const NotebookCellSchema = z.discriminatedUnion('type', [
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
  InputCellSchema,
]);
export type NotebookCell = z.infer<typeof NotebookCellSchema>;

/** Notebook Tab */
export const NotebookTabSchema = z.object({
  id: z.string(),
  title: z.string().default('Notebook'),
  cellOrder: z.array(z.string()).default([]),
  inputBarOrder: z.array(z.string()).default([]),
  showInputBar: z.boolean().default(true),
});
export type NotebookTab = z.infer<typeof NotebookTabSchema>;

/** Notebook Slice */
export const NotebookSliceConfig = z.object({
  tabs: z.array(NotebookTabSchema).default([]),
  currentTabId: z.string().optional(),
  cells: z.record(z.string(), NotebookCellSchema).default({}),
  currentCellId: z.string().optional(),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfig>;
