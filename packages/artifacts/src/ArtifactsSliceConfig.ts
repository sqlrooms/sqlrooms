import {z} from 'zod';

/** Discriminator for an artifact's kind, e.g. `"map"` or `"worksheet"`. */
export const ArtifactType = z.string();
export type ArtifactType = z.infer<typeof ArtifactType>;

/** Identity and display fields persisted for a single artifact. */
export const ArtifactMetadata = z.object({
  id: z.string(),
  type: ArtifactType,
  title: z.string().default('Untitled'),
});
export type ArtifactMetadata = z.infer<typeof ArtifactMetadata>;

/** Serializable artifacts slice state: the artifacts and their ordering. */
export const ArtifactsSliceConfig = z.object({
  artifactsById: z.record(z.string(), ArtifactMetadata).default({}),
  artifactOrder: z.array(z.string()).default([]),
  /** Artifact IDs pinned in workspace navigation. */
  pinnedArtifactIds: z.array(z.string()).default([]),
  currentArtifactId: z.string().optional(),
});
export type ArtifactsSliceConfig = z.infer<typeof ArtifactsSliceConfig>;
