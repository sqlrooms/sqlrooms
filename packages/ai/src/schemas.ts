import {z} from 'zod';
import {StreamMessageSchema} from '@openassistant/core';

export const QueryToolParameters = z.object({
  type: z.literal('query'),
  sqlQuery: z.string(),
  reasoning: z.string(),
});
export type QueryToolParameters = z.infer<typeof QueryToolParameters>;

export const AnalysisSchema = z.string();
export type AnalysisSchema = z.infer<typeof AnalysisSchema>;

// ChartToolParameters is now in @sqlrooms/vega package
// export const ChartToolParameters = z.object({
//   sqlQuery: z.string(),
//   vegaLiteSpec: z.string(),
//   reasoning: z.string(),
// });
// export type ChartToolParameters = z.infer<typeof ChartToolParameters>;

export const ToolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  args: QueryToolParameters, // Simplified since we only have one default tool now
});
export type ToolCallSchema = z.infer<typeof ToolCallSchema>;

// Define specific schemas for message elements
export const QueryResultElementSchema = z.object({
  type: z.literal('query-result'),
  title: z.string(),
  sqlQuery: z.string(),
});
export type QueryResultElementSchema = z.infer<typeof QueryResultElementSchema>;

// Define a union of all possible element types
// Add more element types here as needed
export const ElementSchema = z.union([
  QueryResultElementSchema,
  z.string(), // For simple string messages
  // Add more element types here as they are created
]);
export type ElementSchema = z.infer<typeof ElementSchema>;

export const ToolCallMessageSchema = z.object({
  toolCallId: z.string(),
  element: ElementSchema,
});
export type ToolCallMessageSchema = z.infer<typeof ToolCallMessageSchema>;

export const ToolResultSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  args: z.record(z.any()),
  result: z.union([
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
    z.object({
      success: z.literal(true),
      data: z.record(z.any()),
    }),
  ]),
});
export type ToolResultSchema = z.infer<typeof ToolResultSchema>;

export const ErrorMessageSchema = z.object({
  error: z.string(),
});
export type ErrorMessageSchema = z.infer<typeof ErrorMessageSchema>;

export const AnalysisResultSchema = z.object({
  id: z.string().cuid2(),
  prompt: z.string(),
  streamMessage: StreamMessageSchema,
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
  createdAt: z.date().optional(),
});
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
