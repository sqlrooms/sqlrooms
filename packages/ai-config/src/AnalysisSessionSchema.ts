import {z} from 'zod';
import {UIMessagePartSchema, UIMessageSchema} from './UIMessageSchema';

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
    parts: z.array(z.unknown()).optional(),
  }),
);

export const AnalysisResultSchema = z.object({
  id: z.string(), // allow any string ID to match UI message ID from AI SDK v5
  prompt: z.string(),
  // deprecated:
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
  toolAdditionalData: z.record(z.string(), z.unknown()).optional(),
});

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
    uiMessages: z.array(z.unknown()),
    toolAdditionalData: z.record(z.string(), z.unknown()),
  }),
);

export const AnalysisSessionSchema = migrateAnalysisSession;
export type AnalysisSessionSchema = z.infer<typeof AnalysisSessionSchema>;
