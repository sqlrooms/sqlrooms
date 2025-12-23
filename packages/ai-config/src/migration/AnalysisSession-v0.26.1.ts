/**
 * Migration function to convert old AnalysisSession to new format
 *
 * Version: 0.26.1
 *
 * Changes:
 * - rename toolAdditionalData to agentToolCallData
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
 *     streamMessage: StreamMessageSchema,
 *   }>,
 *   uiMessages: Array<UIMessageSchema>,
 *   toolAdditionalData: Record<string, unknown>, //<-- OLD FIELD, DEPRECATED
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
 *   uiMessages: Array<UIMessageSchema>,
 *   agentToolCallData: Record<string, AgentToolCallData>, //<-- NEW FIELD
 * }
 */

type UnknownRecord = Record<string, unknown>;

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

/**
 * Detect if session needs migration from v0.26.0 → v0.26.1
 * - toolAdditionalData (deprecated) → agentToolCallData (current)
 */
function needsV0_26_1Migration(data: unknown): boolean {
  if (!isObject(data)) return false;

  const session = data as UnknownRecord;
  const toolAdditionalData = session.toolAdditionalData;
  const agentToolCallData = session.agentToolCallData;

  // Only migrate when legacy field exists and new field is not present.
  return toolAdditionalData !== undefined && !isObject(agentToolCallData);
}

function isAgentToolCallDataLike(value: unknown): value is UnknownRecord {
  if (!isObject(value)) return false;
  const agentToolCalls = value.agentToolCalls;
  const timestamp = value.timestamp;
  return Array.isArray(agentToolCalls) && typeof timestamp === 'string';
}

/**
 * Perform migration:
 * - Move entries from toolAdditionalData → agentToolCallData
 * - Drop invalid entries (keeps Zod schema happy)
 * - Remove deprecated toolAdditionalData field
 */
function migrateFromV0_26_1(data: unknown) {
  if (!needsV0_26_1Migration(data)) return data;

  const session = {...(data as UnknownRecord)};
  const toolAdditionalData = session.toolAdditionalData;

  const agentToolCallData: UnknownRecord = {};

  if (isObject(toolAdditionalData)) {
    for (const [toolCallId, value] of Object.entries(toolAdditionalData)) {
      if (!toolCallId) continue;
      if (isAgentToolCallDataLike(value)) {
        agentToolCallData[toolCallId] = value;
      }
    }
  }

  delete session.toolAdditionalData;

  if (Object.keys(agentToolCallData).length > 0) {
    session.agentToolCallData = agentToolCallData;
  }

  return session;
}

export {needsV0_26_1Migration, migrateFromV0_26_1};
