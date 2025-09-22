import {z} from 'zod';
import {StreamMessagePartSchema} from '@openassistant/core';

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
      const parts = (data as {parts: Record<string, unknown>[]}).parts;

      const newParts = [];
      for (const part of parts) {
        if (part.type === 'text') {
          const text = part.text;
          newParts.push({
            type: 'text',
            text,
          });
        } else if (part.type === 'tool') {
          const toolCallMessages = part.toolCallMessages as Record<
            string,
            unknown
          >[];
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

// migrate from old ollamaBaseUrl to new baseUrl
const migrateAnalysisSession = z.preprocess(
  (data) => {
    if (
      data &&
      typeof data === 'object' &&
      'ollamaBaseUrl' in data &&
      !('baseUrl' in data)
    ) {
      // migrate from old ollamaBaseUrl to new baseUrl
      const {ollamaBaseUrl, ...rest} = data as {ollamaBaseUrl: string} & Record<
        string,
        unknown
      >;
      return {
        ...rest,
        baseUrl: ollamaBaseUrl,
      };
    }
    return data;
  },
  z.object({
    id: z.string().cuid2(),
    name: z.string(),
    modelProvider: z.string(),
    model: z.string(),
    customModelName: z.string().optional(),
    baseUrl: z.string().optional(),
    analysisResults: z.array(AnalysisResultSchema),
    createdAt: z.coerce.date().optional(),
  }),
);

export const AnalysisSessionSchema = migrateAnalysisSession;
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
