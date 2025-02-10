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

export const ToolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  args: z.union([QueryToolParameters, AnswerToolParameters]),
});
export type ToolCallSchema = z.infer<typeof ToolCallSchema>;

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
});
export type AnalysisResultSchema = z.infer<typeof AnalysisResultSchema>;
