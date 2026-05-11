import {z} from 'zod';

export const DocumentArtifact = z.object({
  id: z.string(),
  markdown: z.string().default(''),
  updatedAt: z.number().default(0),
});
export type DocumentArtifact = z.infer<typeof DocumentArtifact>;

export const DocumentsSliceConfig = z.object({
  artifacts: z
    .record(z.string(), DocumentArtifact)
    .default({})
    .superRefine((artifacts, ctx) => {
      for (const [key, artifact] of Object.entries(artifacts)) {
        if (key !== artifact.id) {
          ctx.addIssue({
            code: 'custom',
            path: [key, 'id'],
            message: `Artifact key "${key}" does not match artifact id "${artifact.id}"`,
          });
        }
      }
    }),
});
export type DocumentsSliceConfig = z.infer<typeof DocumentsSliceConfig>;
