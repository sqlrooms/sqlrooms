import {z} from 'zod';
import {StreamMessagePartSchema} from '@openassistant/core';

export const ErrorMessageSchema = z.object({
  error: z.string(),
});
export type ErrorMessageSchema = z.infer<typeof ErrorMessageSchema>;

// migrate from old streamMessage to new streamMessage
const migrateStreamMessage = z.preprocess(
  (data) => {
    if (data && typeof data === 'object') {
      // Case A: Old "parts" array with legacy 'tool' entries
      if ('parts' in data) {
        const parts = (data as {parts: Record<string, unknown>[]}).parts;
        if (Array.isArray(parts)) {
          const newParts: Record<string, unknown>[] = [];
          for (const part of parts) {
            if ((part as {type?: string}).type === 'text') {
              const text = (part as {text?: string}).text;
              newParts.push({
                type: 'text',
                text,
              });
            } else if ((part as {type?: string}).type === 'tool') {
              const toolCallMessages =
                (
                  part as {
                    toolCallMessages?: Record<string, unknown>[];
                  }
                ).toolCallMessages || [];
              for (const toolCallMessage of toolCallMessages) {
                const toolCallId = (toolCallMessage as {toolCallId?: string})
                  .toolCallId;
                const toolName = (toolCallMessage as {toolName?: string})
                  .toolName;
                const args = (toolCallMessage as {args?: unknown}).args;
                const isCompleted = (toolCallMessage as {isCompleted?: boolean})
                  .isCompleted;
                const llmResult =
                  (toolCallMessage as {llmResult?: Record<string, unknown>})
                    .llmResult || {};
                const additionalData = (
                  toolCallMessage as {additionalData?: unknown}
                ).additionalData;

                const toolInvocation = {
                  toolCallId,
                  toolName,
                  args,
                  state: isCompleted ? 'result' : 'call',
                  result: {
                    ...llmResult,
                    toolCallId,
                  },
                };

                newParts.push({
                  type: 'tool-invocation',
                  toolInvocation,
                  additionalData,
                  isCompleted,
                });
              }
            } else if ((part as {type?: string}).type === 'tool-invocation') {
              // Ensure toolInvocation.result contains toolCallId if present
              const existing = part as {
                toolInvocation?: {
                  toolCallId?: string;
                  toolName?: string;
                  args?: unknown;
                  state?: string;
                  result?: Record<string, unknown> | undefined;
                };
              } & Record<string, unknown>;

              const ti = existing.toolInvocation || {};
              const toolCallId = ti.toolCallId;
              const updatedResult =
                ti.result && typeof ti.result === 'object'
                  ? {
                      ...ti.result,
                      toolCallId:
                        (ti.result as {toolCallId?: string}).toolCallId ??
                        toolCallId,
                    }
                  : ti.result;

              const updatedPart = {
                ...existing,
                toolInvocation: {
                  ...ti,
                  result: updatedResult,
                },
              };

              newParts.push(updatedPart);
            }
          }
          return {parts: newParts};
        }
      }

      // Case B: Very old shape with only top-level toolCallMessages
      if ('toolCallMessages' in data && !('parts' in data)) {
        const toolCallMessages =
          (data as {toolCallMessages?: Record<string, unknown>[]})
            .toolCallMessages || [];
        const newParts: Record<string, unknown>[] = [];

        // Preserve any leading text as a text part if present
        if (
          'text' in data &&
          typeof (data as {text?: string}).text === 'string' &&
          ((data as {text?: string}).text || '').trim() !== ''
        ) {
          newParts.push({
            type: 'text',
            text: (data as {text?: string}).text,
          });
        }

        for (const toolCallMessage of toolCallMessages) {
          const toolCallId = (toolCallMessage as {toolCallId?: string})
            .toolCallId;
          const toolName = (toolCallMessage as {toolName?: string}).toolName;
          const args = (toolCallMessage as {args?: unknown}).args;
          const isCompleted = (toolCallMessage as {isCompleted?: boolean})
            .isCompleted;
          const llmResult =
            (toolCallMessage as {llmResult?: Record<string, unknown>})
              .llmResult || {};
          const additionalData = (toolCallMessage as {additionalData?: unknown})
            .additionalData;

          const toolInvocation = {
            toolCallId,
            toolName,
            args,
            state: isCompleted ? 'result' : 'call',
            result: {
              ...llmResult,
              toolCallId,
            },
          };

          newParts.push({
            type: 'tool-invocation',
            toolInvocation,
            additionalData,
            isCompleted,
          });
        }

        return {parts: newParts};
      }
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
