import {z} from 'zod';

export const QueryToolParameters = z.object({
  type: z.literal('query'),
  sqlQuery: z.string(),
  reasoning: z.string(),
});
export type QueryToolParameters = z.infer<typeof QueryToolParameters>;

export const AnswerToolParameters = z.object({
  type: z.literal('answer'),
  answer: z.string(),
  chart: z.union([
    z.object({
      sqlQuery: z.string(),
      vegaLiteSpec: z.string(),
    }),
    z.null(),
  ]),
});
export type AnswerToolParameters = z.infer<typeof AnswerToolParameters>;

export const AnalysisSchema = z.string();
export type AnalysisSchema = z.infer<typeof AnalysisSchema>;

export const ChartToolParameters = z.object({
  sqlQuery: z.string(),
  vegaLiteSpec: z.string(),
  reasoning: z.string(),
});
export type ChartToolParameters = z.infer<typeof ChartToolParameters>;

export const ToolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  args: z.union([
    QueryToolParameters,
    AnswerToolParameters,
    ChartToolParameters,
  ]),
});
export type ToolCallSchema = z.infer<typeof ToolCallSchema>;

export const ToolCallMessageSchema = z.object({
  toolCallId: z.string(),
  element: z.any(),
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

export const AnalysisResultSchema = z.object({
  id: z.string().cuid2(),
  prompt: z.string(),
  toolResults: z.array(ToolResultSchema),
  toolCalls: z.array(ToolCallSchema),
  toolCallMessages: z.array(ToolCallMessageSchema),
  analysis: z.string(),
  isCompleted: z.boolean(),
});
export type AnalysisResultSchema = z.infer<typeof AnalysisResultSchema>;
