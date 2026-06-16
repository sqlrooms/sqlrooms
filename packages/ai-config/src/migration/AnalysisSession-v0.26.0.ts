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

  // Needs migration if uiMessages is missing, or if legacy keys need to be
  // folded into the current uiMessages-only shape.
  const hasUiMessages = 'uiMessages' in d;
  const hasLegacyAnalysisResults = 'analysisResults' in d;
  const hasLegacyToolData = 'toolAdditionalData' in d;

  return !hasUiMessages || hasLegacyAnalysisResults || hasLegacyToolData;
}

function getLegacyResultMetadata(result: UnknownRecord) {
  const metadata: UnknownRecord = {};
  const errorMessage = result.errorMessage;
  const error = isObject(errorMessage) ? errorMessage.error : undefined;
  if (typeof error === 'string') {
    metadata.errorMessage = {error};
  }

  if (typeof result.isCompleted === 'boolean') {
    metadata.isCompleted = result.isCompleted;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function withLegacyResultMetadata(
  message: UnknownRecord,
  legacyMetadata: UnknownRecord | undefined,
) {
  if (!legacyMetadata) return message;

  const metadata = isObject(message.metadata) ? message.metadata : {};
  const sqlrooms = isObject(metadata.sqlrooms) ? metadata.sqlrooms : {};

  return {
    ...message,
    metadata: {
      ...metadata,
      sqlrooms: {
        ...sqlrooms,
        ...legacyMetadata,
      },
    },
  };
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
  const uiMessages = [...existingUiMessages];

  // Only synthesize messages from legacy analysisResults when uiMessages is
  // absent entirely. If uiMessages is already present, only copy legacy result
  // metadata onto matching user messages to avoid duplicating messages.
  const synthesizedMessages: UnknownRecord[] = [];
  const needsMessageSynthesis = !('uiMessages' in (data as UnknownRecord));

  for (const result of analysisResults) {
    if (!isObject(result)) continue;
    const id = (result.id as string) || '';
    const prompt = (result.prompt as string) || '';
    const streamMessage = (result.streamMessage as UnknownRecord) || {};
    const parts = (streamMessage.parts as UnknownRecord[]) || [];
    const legacyMetadata = getLegacyResultMetadata(result);

    if (!needsMessageSynthesis) {
      const matchingUserMessageIndex = uiMessages.findIndex(
        (message) => message.id === id && message.role === 'user',
      );
      if (matchingUserMessageIndex !== -1) {
        const matchingUserMessage = uiMessages[matchingUserMessageIndex];
        if (!matchingUserMessage) continue;
        uiMessages[matchingUserMessageIndex] = withLegacyResultMetadata(
          matchingUserMessage,
          legacyMetadata,
        );
      }
      continue;
    }

    if (needsMessageSynthesis) {
      // Create user message for the prompt
      if (prompt) {
        synthesizedMessages.push(
          withLegacyResultMetadata(
            {
              id,
              role: 'user',
              parts: [{type: 'text', text: prompt}],
            },
            legacyMetadata,
          ),
        );
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
    uiMessages: [...uiMessages, ...synthesizedMessages],
    prompt: typeof session.prompt === 'string' ? session.prompt : '',
    isRunning: false,
  };
}

export {needsV0_26_0Migration, migrateFromV0_26_0};
