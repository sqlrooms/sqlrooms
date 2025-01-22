import {z} from 'zod';

export const ToolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  args: z.record(z.any()),
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

export const AnalysisStepSchema = z.object({
  query: z.string(),
  reasoning: z.string(),
});
export type AnalysisStepSchema = z.infer<typeof AnalysisStepSchema>;

export const AnalysisAnswerSchema = z.object({
  steps: z.array(AnalysisStepSchema),
  answer: z.string(),
  plotlyChartSpec: z.object({
    data: z.string(),
    layout: z.string(),
  }),
});
export type AnalysisAnswerSchema = z.infer<typeof AnalysisAnswerSchema>;

export const AnalysisResultSchema = z.object({
  id: z.string().cuid2(),
  prompt: z.string(),
  toolResults: z.array(ToolResultSchema),
  toolCalls: z.array(ToolCallSchema),
});
export type AnalysisResultSchema = z.infer<typeof AnalysisResultSchema>;
