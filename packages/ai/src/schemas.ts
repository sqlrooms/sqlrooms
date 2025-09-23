import {z} from 'zod';
import {migrateAnalysisSession} from './migration';
import {UIMessageSchema, UIMessagePartSchema} from './schema/UIMessageSchema';

export const QueryToolParameters = z.object({
  type: z.literal('query'),
  sqlQuery: z.string(),
  reasoning: z.string(),
});
export type QueryToolParameters = z.infer<typeof QueryToolParameters>;

export const ErrorMessageSchema = z.object({
  error: z.string(),
});
export type ErrorMessageSchema = z.infer<typeof ErrorMessageSchema>;

export const AnalysisResultSchema = z.object({
  id: z.string(), // Allow any string ID to match UI message IDs
  prompt: z.string(),
  // deprecated
  // streamMessage: migrateStreamMessage,
  response: z.array(UIMessagePartSchema),
  errorMessage: ErrorMessageSchema.optional(),
  isCompleted: z.boolean(),
});
export type AnalysisResultSchema = z.infer<typeof AnalysisResultSchema>;

const AnalysisSessionBaseSchema = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  modelProvider: z.string(),
  model: z.string(),
  customModelName: z.string().optional(),
  baseUrl: z.string().optional(),
  analysisResults: z.array(AnalysisResultSchema),
  createdAt: z.coerce.date().optional(),
  // use vercel ai v5 schema
  uiMessages: z.array(UIMessageSchema),
  toolAdditionalData: z.record(z.unknown()).optional(),
});

export const AnalysisSessionSchema = migrateAnalysisSession(
  AnalysisSessionBaseSchema,
);
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
