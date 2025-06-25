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

// migrate from old streamMessage to new streamMessage
const migrateStreamMessage = z.preprocess(
  (data) => {
    if (
      data &&
      typeof data === 'object' &&
      'toolCallMessages' in data &&
      'parts' in data
    ) {
      // migrate from old streamMessage to new streamMessage
      const parts = (data as any).parts as any[];

      const newParts = [];
      for (const part of parts) {
        if (part.type === 'text') {
          const text = part.text;
          newParts.push({
            type: 'text',
            text,
          });
        } else if (part.type === 'tool') {
          const toolCallMessages = part.toolCallMessages;
          for (const toolCallMessage of toolCallMessages) {
            const toolCallId = toolCallMessage.toolCallId;
            const toolName = toolCallMessage.toolName;
            const args = toolCallMessage.args;
            const isCompleted = toolCallMessage.isCompleted;
            const llmResult = toolCallMessage.llmResult;
            const additionalData = toolCallMessage.additionalData;

            const toolInvocation = {
              toolCallId,
              toolName,
              args,
              state: isCompleted ? 'result' : 'call',
              result: llmResult,
            };

            newParts.push({
              type: 'tool-invocation',
              toolInvocation,
              additionalData,
              isCompleted,
            });
          }
        }
      }

      return {
        parts: newParts,
      };
    }
    return data;
  },
  z.object({
    parts: z.array(StreamMessagePartSchema).optional(),
  }),
);

export const AnalysisResultSchema = z.object({
  id: z.string().cuid2(),
  prompt: z.string(),
  streamMessage: migrateStreamMessage,
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
