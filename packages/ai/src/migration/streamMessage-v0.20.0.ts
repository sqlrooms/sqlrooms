// No imports needed - only exports individual migration functions

/**
 * Migration function to convert old streamMessage format to new streamMessage format.
 *
 * Version: 0.20.0
 * Introduced: Migration from legacy tool call format to new tool-invocation format
 *
 * OLD SCHEMA (legacy format):
 * {
 *   parts: [
 *     {
 *       type: 'text',
 *       text: string
 *     },
 *     {
 *       type: 'tool',
 *       toolCallMessages: [
 *         {
 *           toolCallId: string,
 *           toolName: string,
 *           args: object,
 *           isCompleted: boolean,
 *           llmResult: any,
 *           additionalData: any
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 * NEW SCHEMA (current format):
 * {
 *   parts: [
 *     {
 *       type: 'text',
 *       text: string,
 *       additionalData?: any,
 *       isCompleted?: boolean
 *     },
 *     {
 *       type: 'tool-invocation',
 *       toolInvocation: {
 *         toolCallId: string,
 *         toolName: string,
 *         args: object,
 *         state: 'call' | 'result',
 *         result?: any
 *       },
 *       additionalData?: any,
 *       isCompleted?: boolean
 *     }
 *   ]
 * }
 *
 * Key changes:
 * - Tool parts changed from 'tool' type with 'toolCallMessages' array to 'tool-invocation' type with single 'toolInvocation' object
 * - Each tool call is now a separate part instead of being grouped in an array
 * - Added 'state' field to toolInvocation ('call' for pending, 'result' for completed)
 * - Moved 'isCompleted' and 'additionalData' to the part level
 * - 'llmResult' is now 'result' and only present when state is 'result'
 */

/**
 * Helper function to detect if data needs migration from v0.20.0 format
 */
function needsV0_20_0Migration(data: unknown): boolean {
  return Boolean(
    data &&
      typeof data === 'object' &&
      'parts' in data &&
      Array.isArray((data as {parts: unknown[]}).parts) &&
      (data as {parts: unknown[]}).parts.some(
        (part: unknown) =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          (part as {type: string}).type === 'tool' &&
          'toolCallMessages' in part,
      ),
  );
}

/**
 * Helper function to migrate data from v0.20.0 format
 */
function migrateFromV0_20_0(data: unknown) {
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

// Export individual migration functions for use in centralized migration
export {needsV0_20_0Migration, migrateFromV0_20_0};
