import {z} from 'zod';

const DocumentAssetBase = {
  id: z.string(),
  data: z.string(),
  filename: z.string().optional(),
  alt: z.string().optional(),
  title: z.string().optional(),
  provenance: z.unknown().optional(),
  createdAt: z.number().default(0),
  updatedAt: z.number().default(0),
};

export const DocumentAsset = z.discriminatedUnion('mediaType', [
  z.object({
    ...DocumentAssetBase,
    mediaType: z.literal('image/svg+xml'),
    encoding: z.enum(['utf8', 'base64']),
  }),
  z.object({
    ...DocumentAssetBase,
    mediaType: z.literal('image/png'),
    encoding: z.literal('base64'),
  }),
]);
export type DocumentAsset = z.infer<typeof DocumentAsset>;

export const MarkdownDocumentState = z.object({
  id: z.string(),
  markdown: z.string().default(''),
  assets: z.record(z.string(), DocumentAsset).default({}),
  updatedAt: z.number().default(0),
});
export type MarkdownDocumentState = z.infer<typeof MarkdownDocumentState>;

export const DocumentsSliceConfig = z.object({
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
export type DocumentsSliceConfig = z.infer<typeof DocumentsSliceConfig>;
