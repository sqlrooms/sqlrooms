import {z} from 'zod';

export const ArtifactType = z.string();
export type ArtifactType = z.infer<typeof ArtifactType>;

export const ArtifactMetadata = z.object({
  id: z.string(),
  type: ArtifactType,
  title: z.string().default('Untitled'),
});
export type ArtifactMetadata = z.infer<typeof ArtifactMetadata>;

export const ArtifactsSliceConfig = z.object({
  artifactsById: z.record(z.string(), ArtifactMetadata).default({}),
  artifactOrder: z.array(z.string()).default([]),
  currentArtifactId: z.string().optional(),
});
export type ArtifactsSliceConfig = z.infer<typeof ArtifactsSliceConfig>;
