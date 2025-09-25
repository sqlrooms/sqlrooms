// No imports needed - only exports individual migration functions

/**
 * Migration to convert legacy analysisResults[].streamMessage into uiMessages and toolAdditionalData
 *
 * Version: 0.26.0
 * Changes:
 * - For sessions with legacy analysis results containing streamMessage.parts, synthesize UI messages:
 *   - user message for the prompt
 *   - assistant message mapping text/tool-invocation parts to AI SDK v5 parts
 * - Move per-part additionalData into session.toolAdditionalData keyed by toolCallId
 */

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

/** Detect if session needs migration to UI messages */
function needsV0_26_0Migration(data: unknown): boolean {
  if (!isObject(data)) return false;
  const analysisResults = (data as UnknownRecord).analysisResults;
  const uiMessages = (data as UnknownRecord).uiMessages as
    | unknown[]
    | undefined;
  if (!Array.isArray(analysisResults)) return false;
  const hasLegacyParts = analysisResults.some((r) => {
    const sm = isObject(r) ? (r as UnknownRecord).streamMessage : undefined;
    const parts = isObject(sm) ? (sm as UnknownRecord).parts : undefined;
    return Array.isArray(parts) && parts.length > 0;
  });
  const uiMessagesMissingOrEmpty =
    !Array.isArray(uiMessages) || uiMessages.length === 0;
  return hasLegacyParts && uiMessagesMissingOrEmpty;
}

/** Perform migration to AI SDK v5 uiMessages/toolAdditionalData */
function migrateFromV0_26_0(data: unknown) {
  const session = {...(data as UnknownRecord)};
  const analysisResults = (session.analysisResults as UnknownRecord[]) || [];
  const existingUiMessages = (session.uiMessages as UnknownRecord[]) || [];
  const toolAdditionalData =
    (session.toolAdditionalData as UnknownRecord) || {};

  const synthesizedMessages: UnknownRecord[] = [];

  for (const result of analysisResults) {
    if (!isObject(result)) continue;
    const id = (result.id as string) || '';
    const prompt = (result.prompt as string) || '';
    const streamMessage = (result.streamMessage as UnknownRecord) || {};
    const parts = (streamMessage.parts as UnknownRecord[]) || [];

    if (parts.length === 0) {
      // Still add a simple user/assistant pair for the prompt if present
      if (prompt) {
        synthesizedMessages.push({
          id: `${id}-user`,
          role: 'user',
          parts: [{type: 'text', text: prompt}],
        });
      }
      continue;
    }

    // Create user message for the prompt
    if (prompt) {
      synthesizedMessages.push({
        id: `${id}-user`,
        role: 'user',
        parts: [{type: 'text', text: prompt}],
      });
    }

    // Create assistant message mapping the parts
    const assistantParts: UnknownRecord[] = [];
    for (const part of parts) {
      const type = (part as UnknownRecord).type as string;
      if (type === 'text') {
        const text = (part as UnknownRecord).text as string;
        if (typeof text === 'string') {
          assistantParts.push({type: 'text', text});
        }
        continue;
      }
      if (type === 'tool-invocation') {
        const toolInvocation = (part as UnknownRecord)
          .toolInvocation as UnknownRecord;
        if (isObject(toolInvocation)) {
          const toolCallId = (toolInvocation.toolCallId as string) || '';
          const toolName = (
            (toolInvocation.toolName as string) ||
            (toolInvocation.name as string) ||
            'unknown'
          ).toString();
          const state = (toolInvocation.state as string) || 'call';
          const args = toolInvocation.args as unknown as unknown;
          const resultData = toolInvocation.result as unknown as unknown;
          const additional = (part as UnknownRecord).additionalData as unknown;

          // Persist additionalData per toolCallId into session-level toolAdditionalData
          if (toolCallId && additional !== undefined && toolAdditionalData) {
            (toolAdditionalData as UnknownRecord)[toolCallId] =
              additional as unknown;
          }

          // Map state to AI SDK v5 tool-* parts
          if (state === 'call') {
            assistantParts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'input-available',
              input: args,
            });
          } else if (state === 'result') {
            assistantParts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'output-available',
              input: args,
              output: resultData,
            });
          } else {
            // Fallback: treat as result if unknown state
            assistantParts.push({
              type: `tool-${toolName}`,
              toolCallId,
              state: 'output-available',
              input: args,
              output: resultData,
            });
          }
        }
        continue;
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

  return {
    ...session,
    uiMessages: [...existingUiMessages, ...synthesizedMessages],
    toolAdditionalData,
  };
}

export {needsV0_26_0Migration, migrateFromV0_26_0};
