import {z} from 'zod';

export const DocumentArtifact = z.object({
  id: z.string(),
  markdown: z.string().default(''),
  updatedAt: z.number().default(0),
});
export type DocumentArtifact = z.infer<typeof DocumentArtifact>;

export const DocumentsSliceConfig = z.object({
  artifacts: z.record(z.string(), DocumentArtifact).default({}),
});
export type DocumentsSliceConfig = z.infer<typeof DocumentsSliceConfig>;
