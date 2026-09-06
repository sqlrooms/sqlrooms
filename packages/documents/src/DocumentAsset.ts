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

/** Image asset shared by Markdown documents and block documents. */
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
