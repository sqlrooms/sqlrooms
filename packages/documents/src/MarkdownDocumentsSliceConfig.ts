import {z} from 'zod';
import {DocumentAsset} from './DocumentAsset';

export const MarkdownDocumentState = z.object({
  id: z.string(),
  markdown: z.string().default(''),
  assets: z.record(z.string(), DocumentAsset).default({}),
  updatedAt: z.number().default(0),
});
export type MarkdownDocumentState = z.infer<typeof MarkdownDocumentState>;

/** Persisted Markdown documents keyed by artifact ID. */
export const MarkdownDocumentsSliceConfig = z.object({
  artifacts: z
    .record(z.string(), MarkdownDocumentState)
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
export type MarkdownDocumentsSliceConfig = z.infer<
  typeof MarkdownDocumentsSliceConfig
>;
