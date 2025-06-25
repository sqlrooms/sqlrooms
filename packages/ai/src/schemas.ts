import {z} from 'zod';

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

// TODO: StreamMessagePart schema should be provided by @openassistant/core
export const StreamMessagePartSchema = z.union([
  z.object({
    type: z.literal('text'),
    text: z.string(),
    additionalData: z.any().optional(),
    isCompleted: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('tool-invocation'),
    toolInvocation: z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.any(),
      state: z.string(),
      result: z.any().optional(),
    }),
    additionalData: z.any().optional(),
    isCompleted: z.boolean().optional(),
  }),
  // Add a catch-all for other part types that might exist
  z
    .object({
      type: z.string(),
      additionalData: z.any().optional(),
      isCompleted: z.boolean().optional(),
    })
    .passthrough(),
]);

export const AnalysisResultSchema = z.object({
  id: z.string().cuid2(),
  prompt: z.string(),
  streamMessage: z.object({
    parts: z.array(StreamMessagePartSchema).optional(),
  }),
  errorMessage: ErrorMessageSchema.optional(),
  isCompleted: z.boolean(),
});
export type AnalysisResultSchema = z.infer<typeof AnalysisResultSchema>;

export const AnalysisSessionSchema = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  modelProvider: z.string(),
  model: z.string(),
  analysisResults: z.array(AnalysisResultSchema),
  createdAt: z.coerce.date().optional(),
});
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
