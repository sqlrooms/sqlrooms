/**
 * Migration function to convert old AnalysisSession to new format
 *
 * Version: 0.26.x
 *
 * Changes:
 * - add uiMessages (AI SDK v5) to AnalysisSession along with legacy analysisResults
 * - add toolEditState (originally toolAdditionalData) to AnalysisSession to store tool edit state per session
 * - deprecate the following properties in AnalysisResult:
 *   - streamMessage
 *
 * OLD SCHEMA (legacy format):
 * {
 *  id: string,
 *   name: string,
 *   modelProvider: string,
 *   model: string,
 *   customModelName?: string,
 *   baseUrl?: string,
 *   createdAt?: Date
 *   analysisResults: Array<{
 *     id: string,
 *     prompt: string,
 *     isCompleted: boolean,
 *     errorMessage?: { error: string },
 *     streamMessage: StreamMessageSchema, //<-- OLD FIELD, DEPRECATED
 *   }>,
 * }
 *
 * NEW SCHEMA (current format):
 * {
 *  id: string,
 *   name: string,
 *   modelProvider: string,
 *   model: string,
 *   customModelName?: string,
 *   baseUrl?: string,
 *   createdAt?: Date
 *   analysisResults: Array<{
 *     id: string,
 *     prompt: string,
 *     isCompleted: boolean,
 *     errorMessage?: { error: string },
 *   }>,
 *   uiMessages: Array<UIMessageSchema>, //<-- NEW FIELD
 *   toolEditState: Record<string, unknown>, //<-- NEW FIELD
 *   messagesRevision?: number, //<-- NEW FIELD
 *   prompt: string, //<-- NEW FIELD
 *   isRunning: boolean, //<-- NEW FIELD
 * }
 */

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

/** Detect if session needs migration to UI messages */
function needsV0_26_0Migration(data: unknown): boolean {
  if (!isObject(data)) return false;

  const d = data as UnknownRecord;

  // Use key-presence checks rather than value comparisons so that a field
  // explicitly set to `{}` or `null` is still treated as "present" and does
  // not incorrectly re-trigger migration (which could duplicate uiMessages).
  const hasUiMessages = 'uiMessages' in d;
  const hasToolState = 'toolEditState' in d || 'toolAdditionalData' in d;

  return !hasUiMessages || !hasToolState;
}

/** Perform migration to AI SDK v5 uiMessages/toolEditState */
function migrateFromV0_26_0(data: unknown) {
  const {toolAdditionalData: _legacyToolAdditionalData, ...session} = {
    ...(data as UnknownRecord),
  };
  const analysisResults = (session.analysisResults as UnknownRecord[]) || [];
  const existingUiMessages = (session.uiMessages as UnknownRecord[]) || [];
  const toolEditState =
    (session.toolEditState as UnknownRecord) ??
    (session.toolAdditionalData as UnknownRecord) ??
    {};

  const synthesizedMessages: UnknownRecord[] = [];

  for (const result of analysisResults) {
    if (!isObject(result)) continue;
    const id = (result.id as string) || '';
    const prompt = (result.prompt as string) || '';
    const streamMessage = (result.streamMessage as UnknownRecord) || {};
    const parts = (streamMessage.parts as UnknownRecord[]) || [];

    // Create user message for the prompt
    if (prompt) {
      synthesizedMessages.push({
        id,
        role: 'user',
        parts: [{type: 'text', text: prompt}],
      });
    }

    // Create assistant message mapping the parts
    const assistantParts: UnknownRecord[] = [];
    for (const part of parts) {
      if (part.type === 'text') {
        const text = part.text as string;
        assistantParts.push({type: 'text', text});
      } else if (part.type === 'tool-invocation') {
        const toolInvocation = part.toolInvocation;
        if (isObject(toolInvocation)) {
          const toolCallId = toolInvocation.toolCallId as string;
          const toolName = toolInvocation.toolName as string;
          const state = toolInvocation.state as string;
          const args = toolInvocation.args;
          const llmResult = toolInvocation.result;
          const additional = part.additionalData;

          // Persist additionalData per toolCallId into session-level toolEditState
          if (toolCallId && additional !== undefined && toolEditState) {
            toolEditState[toolCallId] = additional;
          }

          // Map state to AI SDK v5 tool-* parts
          if (state === 'call') {
            assistantParts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'input-available',
              input: args,
            });
          } else {
            // Fallback: treat other states as result
            assistantParts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'output-available',
              input: args,
              output: llmResult,
            });
          }
        }
      }
      // Unknown legacy part types are ignored
    }

    if (assistantParts.length > 0) {
      synthesizedMessages.push({
        id: `${id}-assistant`,
        role: 'assistant',
        parts: assistantParts,
      });
    }
  }

  // Remove deprecated streamMessage field from analysisResults
  const cleanedAnalysisResults = analysisResults.map((result) => {
    if (!isObject(result)) return result;

    const {streamMessage, ...rest} = result as UnknownRecord & {
      streamMessage?: unknown;
    };
    return rest;
  });

  return {
    ...session,
    analysisResults: cleanedAnalysisResults,
    uiMessages: [...existingUiMessages, ...synthesizedMessages],
    toolEditState,
    prompt: '',
    isRunning: false,
  };
}

export {needsV0_26_0Migration, migrateFromV0_26_0};
