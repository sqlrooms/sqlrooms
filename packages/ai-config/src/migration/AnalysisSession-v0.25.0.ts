/**
 * Migration function to migrate AnalysisResult.streamMessage to new streamMessage format.
 *
 * Version: 0.25.0
 * Introduced: migrate old openassistant toolCallMessages to Vercel AI SDK v4 toolInvocation format
 *
 * AnalysisResult:
 * {
 *   id: string,
 *   prompt: string,
 *   errorMessage?: ErrorMessageSchema,
 *   isCompleted: boolean,
 *   streamMessage: StreamMessageSchema, //<-- migrate from old streamMessage to new streamMessage
 * }
 *
 * OLD SCHEMA (legacy format, introduced in ai package v0.8.0):
 * {
 *   id: string,
 *   prompt: string,
 *   isCompleted: boolean,
 *   errorMessage?: { error: string },
 *   streamMessage: {
 *     text: string,       // DEPRECATED
 *     reasoning?: string, // DEPRECATED
 *     analysis?: string,  // DEPRECATED
 *     toolCallMessages: Array<{ // DEPRECATED
 *       toolCallId: string,
 *       toolName: string,
 *       args: unknown,
 *       llmResult: unknown,
 *       additionalData?: unknown,
 *       isCompleted: boolean,
 *     }>,
 *     parts: Array<{
 *       | { type: 'text', text: string }
 *       | {                                  // OLD FORMAT
 *           type: 'tool',
 *           toolCallMessages: Array<{
 *             toolCallId: string,
 *             toolName: string,
 *             args: unknown,
 *             llmResult: unknown,
 *             additionalData?: unknown,
 *             isCompleted: boolean,
 *           }>,
 *         }
 *     }>,
 *   },
 * }
 *
 * NEW SCHEMA (current format):
 * {
 *   id: string,
 *   prompt: string,
 *   isCompleted: boolean,
 *   errorMessage?: { error: string },
 *   streamMessage: {
 *     parts: Array<{
 *       | { type: 'text', text: string }
 *       | {                                  // NEW FORMAT
 *           type: 'tool-invocation',
 *           toolInvocation: {
 *             toolCallId: string,
 *             toolName: string,
 *             args: unknown,
 *             state: 'call' | 'result',
 *             result: unknown,
 *           },
 *           additionalData?: unknown,
 *           isCompleted: boolean,
 *         }
 *     }>,
 *   },
 * }
 *
 */

/**
 * Helper function to detect if streamMessage needs migration from v0.25.0 format
 */
function needsStreamMessageMigration(streamMessage: unknown): boolean {
  return (
    streamMessage !== null &&
    typeof streamMessage === 'object' &&
    'toolCallMessages' in streamMessage &&
    'parts' in streamMessage
  );
}

/**
 * Helper function to migrate a single streamMessage from v0.25.0 format
 */
function migrateStreamMessage(streamMessage: unknown) {
  if (!needsStreamMessageMigration(streamMessage)) {
    return streamMessage;
  }

  const parts = (streamMessage as {parts: Record<string, unknown>[]}).parts;
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

/**
 * Helper function to detect if session needs migration from v0.25.0 format
 */
function needsV0_25_0Migration(data: unknown): boolean {
  if (
    data === null ||
    typeof data !== 'object' ||
    !('analysisResults' in data)
  ) {
    return false;
  }

  const session = data as Record<string, unknown>;
  const analysisResults = session.analysisResults;

  if (!Array.isArray(analysisResults)) {
    return false;
  }

  // Check if any analysisResult has a streamMessage that needs migration
  return analysisResults.some((result) => {
    if (result && typeof result === 'object' && 'streamMessage' in result) {
      return needsStreamMessageMigration(result.streamMessage);
    }
    return false;
  });
}

/**
 * Helper function to migrate session data from v0.25.0 format
 */
function migrateFromV0_25_0(data: unknown) {
  if (!needsV0_25_0Migration(data)) {
    return data;
  }

  const session = data as Record<string, unknown>;
  const analysisResults = session.analysisResults as Record<string, unknown>[];

  const migratedAnalysisResults = analysisResults.map((result) => {
    if (result && typeof result === 'object' && 'streamMessage' in result) {
      const streamMessage = result.streamMessage;
      if (needsStreamMessageMigration(streamMessage)) {
        return {
          ...result,
          streamMessage: migrateStreamMessage(streamMessage),
        };
      }
    }
    return result;
  });

  return {
    ...session,
    analysisResults: migratedAnalysisResults,
  };
}

// Export individual migration functions for use in centralized migration
export {needsV0_25_0Migration, migrateFromV0_25_0};
