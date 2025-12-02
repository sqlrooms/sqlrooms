import {z} from 'zod';

export const S3Config = z.object({
  accessKeyId: z.string().min(1, 'Access Key ID is required'),
  secretAccessKey: z.string().min(1, 'Secret Access Key is required'),
  region: z.string().min(1, 'Region is required'),
  bucket: z.string().min(1, 'Bucket name is required'),
  name: z.string().optional(), // Optional for saving
  sessionToken: z.string().optional(), // Optional for temporary credentials
});

export type S3Config = z.infer<typeof S3Config>;

export const S3Credentials = z.object({
  name: z.string().min(1, 'Name is required'),
  accessKeyId: z.string().min(1, 'Access Key ID is required'),
  secretAccessKey: z.string().min(1, 'Secret Access Key is required'),
  region: z.string().min(1, 'Region is required'),
  bucket: z.string().min(1, 'Bucket name is required'),
  sessionToken: z.string().optional(), // Optional for temporary credentials
  id: z.string().uuid('Invalid ID format'),
  createdAt: z.string().datetime('Invalid date format'),
  updatedAt: z.string().datetime('Invalid date format'),
});

export type S3Credentials = z.infer<typeof S3Credentials>;
