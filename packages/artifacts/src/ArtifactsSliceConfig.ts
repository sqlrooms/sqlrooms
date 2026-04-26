import {z} from 'zod';

export const ArtifactType = z.string();
export type ArtifactType = z.infer<typeof ArtifactType>;

export const ArtifactEntry = z.object({
  id: z.string(),
  type: ArtifactType,
  title: z.string().default('Untitled'),
});
export type ArtifactEntry = z.infer<typeof ArtifactEntry>;

export const ArtifactsSliceConfig = z.object({
  itemsById: z.record(z.string(), ArtifactEntry).default({}),
  order: z.array(z.string()).default([]),
  currentItemId: z.string().optional(),
});
export type ArtifactsSliceConfig = z.infer<typeof ArtifactsSliceConfig>;
