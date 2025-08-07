import {z} from 'zod';

export const S3FileOrDirectory = z.union([
  z.object({
    key: z.string(),
    isDirectory: z.literal(true),
  }),
  z.object({
    key: z.string(),
    isDirectory: z.literal(false),
    lastModified: z.date().optional(),
    size: z.number().optional(),
    contentType: z.string().optional(),
  }),
]);
export type S3FileOrDirectory = z.infer<typeof S3FileOrDirectory>;
