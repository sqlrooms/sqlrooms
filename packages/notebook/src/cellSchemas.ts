import {z} from 'zod';
import {
  InputCellData,
  InputCellSchema,
  InputTypes,
  SqlCellSchema,
  TextCellSchema,
  VegaCellSchema,
} from '@sqlrooms/cells';
import {PivotCellSchema} from '@sqlrooms/pivot';

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

/** Notebook view metadata for a single artifact. */
export const NotebookArtifactMeta = z.object({
  cellOrder: z.array(z.string()).default([]),
});
export type NotebookArtifactMeta = z.infer<typeof NotebookArtifactMeta>;

export const NotebookArtifact = z.object({
  id: z.string(),
  meta: NotebookArtifactMeta,
});
export type NotebookArtifact = z.infer<typeof NotebookArtifact>;

/** Notebook Slice Config (view-only artifact runtime metadata). */
export const NotebookSliceConfig = z.object({
  artifacts: z.record(z.string(), NotebookArtifact).default({}),
  currentCellId: z.string().optional(),
});
export type NotebookSliceConfig = z.infer<typeof NotebookSliceConfig>;

export const NotebookArtifactView = z.object({
  id: z.string(),
  cellOrder: z.array(z.string()).default([]),
  name: z.string(),
});
export type NotebookArtifactView = z.infer<typeof NotebookArtifactView>;

export type InputUnion = z.infer<typeof import('@sqlrooms/cells').InputUnion>;
