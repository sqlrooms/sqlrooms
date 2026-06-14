/**
 * Migration function to convert old AnalysisSession to new format
 *
 * Version: 0.26.x
 *
 * Changes:
 * - add uiMessages (AI SDK v5) to AnalysisSession
 * - remove legacy analysisResults from the active parsed session shape
 * - remove toolAdditionalData (in-chat editing removed)
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
 *   uiMessages: Array<UIMessageSchema>, //<-- NEW FIELD
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

  // Needs migration if uiMessages is missing, or if legacy toolAdditionalData is present
  const hasUiMessages = 'uiMessages' in d;
  const hasLegacyToolData = 'toolAdditionalData' in d;

  return !hasUiMessages || hasLegacyToolData;
}

/** Perform migration to AI SDK v5 uiMessages and strip legacy fields. */
function migrateFromV0_26_0(data: unknown) {
  const {toolAdditionalData: _legacyToolAdditionalData, ...sessionWithLegacy} = {
    ...(data as UnknownRecord),
  };
  const analysisResults =
    (sessionWithLegacy.analysisResults as UnknownRecord[]) || [];
  const existingUiMessages =
    (sessionWithLegacy.uiMessages as UnknownRecord[]) || [];
  const {analysisResults: _legacyAnalysisResults, ...session} =
    sessionWithLegacy;

  // Only synthesize messages from legacy analysisResults when uiMessages is
  // absent entirely. If it's already present (e.g. only key cleanup is needed),
  // skip synthesis to avoid duplicating messages.
  const synthesizedMessages: UnknownRecord[] = [];
  const needsMessageSynthesis = !('uiMessages' in (data as UnknownRecord));

  if (needsMessageSynthesis) {
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

            // Map state to AI SDK v5 tool-* parts
            if (state === 'call') {
              assistantParts.push({
                type: `tool-${toolName}`,
                toolCallId,
                state: 'input-available',
                input: args,
              });
            } else {
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
      }

      if (assistantParts.length > 0) {
        synthesizedMessages.push({
          id: `${id}-assistant`,
          role: 'assistant',
          parts: assistantParts,
        });
      }
    }
  }

  return {
    ...session,
    uiMessages: [...existingUiMessages, ...synthesizedMessages],
    prompt: '',
    isRunning: false,
  };
}

export {needsV0_26_0Migration, migrateFromV0_26_0};
