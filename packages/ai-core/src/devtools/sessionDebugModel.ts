import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import type {UIMessage} from 'ai';
import type {
  AgentSnapshot,
  AgentToolCall,
  StoredToolSet,
  ToolRendererRegistry,
} from '../types';

/** High-level counts and model/session metadata for a debugged chat session. */
export type SessionDebugSummary = {
  sessionId: string;
  name: string;
  isRunning: boolean;
  modelProvider: string;
  model: string;
  customModelName?: string;
  baseUrl?: string;
  createdAt?: Date;
  lastOpenedAt?: number;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  agentProgressCount: number;
  agentSnapshotCount: number;
};

/** Normalized message row used by the session debug timeline. */
export type DebugMessage = {
  id: string;
  index: number;
  role: string;
  partCount: number;
  textPreview: string;
  raw: UIMessage;
};

/** Normalized tool-call part with message position and debug payloads. */
export type DebugToolCall = {
  messageId: string;
  messageIndex: number;
  partIndex: number;
  role: string;
  toolCallId: string;
  toolName: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  raw: unknown;
  hasAgentProgress: boolean;
};

/** Agent progress tree attached to a parent tool call. */
export type DebugAgentProgressEntry = {
  parentToolCallId: string;
  toolCalls: AgentToolCall[];
  source: 'live' | 'session';
};

/** Captured agent metadata attached to a parent tool call. */
export type DebugAgentSnapshotEntry = {
  parentToolCallId: string;
  snapshot: AgentSnapshot;
  source: 'live' | 'session';
};

/** One displayable part in a chronological debug timeline message. */
export type DebugTimelinePart =
  | {
      kind: 'text' | 'reasoning';
      index: number;
      text: string;
      raw: unknown;
    }
  | {
      kind: 'tool';
      index: number;
      toolCall: DebugToolCall;
      agentProgress?: DebugAgentProgressEntry;
      agentSnapshot?: DebugAgentSnapshotEntry;
    }
  | {
      kind: 'other';
      index: number;
      type: string;
      raw: unknown;
    };

/** A chat message and its normalized debug timeline parts. */
export type DebugTimelineMessage = {
  message: DebugMessage;
  parts: DebugTimelinePart[];
};

/** Debug metadata for a tool registered in the current AI store. */
export type AvailableToolDebugInfo = {
  name: string;
  description?: string;
  hasExecute: boolean;
  hasRenderer: boolean;
};

type ToolLikePart = {
  type?: string;
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

function getMessageParts(message: UIMessage): unknown[] {
  return Array.isArray(message.parts) ? message.parts : [];
}

function isToolLikePart(part: unknown): part is ToolLikePart {
  if (!part || typeof part !== 'object') return false;
  const type = (part as {type?: unknown}).type;
  return (
    typeof type === 'string' &&
    (type === 'dynamic-tool' || type.startsWith('tool-'))
  );
}

function getToolName(part: ToolLikePart): string {
  if (part.type === 'dynamic-tool' && part.toolName) return part.toolName;
  return part.type?.replace(/^tool-/, '') || 'unknown';
}

function getTextPreview(message: UIMessage): string {
  return getMessageParts(message)
    .flatMap((part) => {
      if (!part || typeof part !== 'object') return [];
      const record = part as {type?: unknown; text?: unknown};
      return record.type === 'text' && typeof record.text === 'string'
        ? [record.text]
        : [];
    })
    .join('\n')
    .trim()
    .slice(0, 240);
}

function countToolCalls(messages: UIMessage[]): number {
  return messages.reduce(
    (count, message) =>
      count + getMessageParts(message).filter(isToolLikePart).length,
    0,
  );
}

function getPartText(part: unknown): string | undefined {
  if (!part || typeof part !== 'object') return undefined;
  const record = part as {text?: unknown};
  return typeof record.text === 'string' ? record.text : undefined;
}

function getPartType(part: unknown): string {
  if (!part || typeof part !== 'object') return 'unknown';
  const type = (part as {type?: unknown}).type;
  return typeof type === 'string' ? type : 'unknown';
}

function getToolCallFromPart({
  message,
  messageIndex,
  part,
  partIndex,
  agentProgress,
}: {
  message: UIMessage;
  messageIndex: number;
  part: unknown;
  partIndex: number;
  agentProgress: Record<string, unknown[]>;
}): DebugToolCall | undefined {
  if (!isToolLikePart(part)) return undefined;
  const toolCallId = part.toolCallId;
  if (!toolCallId) return undefined;

  return {
    messageId: message.id,
    messageIndex,
    partIndex,
    role: message.role,
    toolCallId,
    toolName: getToolName(part),
    state: part.state,
    input: part.input,
    output: part.output,
    errorText: part.errorText,
    raw: part,
    hasAgentProgress: (agentProgress[toolCallId]?.length ?? 0) > 0,
  };
}

/**
 * Builds aggregate debug metadata for a chat session.
 *
 * @param session - Chat session to summarize.
 */
export function getSessionDebugSummary(
  session: ChatSessionSchema,
): SessionDebugSummary {
  const messages = (session.uiMessages ?? []) as UIMessage[];

  return {
    sessionId: session.id,
    name: session.name,
    isRunning: session.isRunning,
    modelProvider: session.modelProvider,
    model: session.model,
    customModelName: session.customModelName,
    baseUrl: session.baseUrl,
    createdAt: session.createdAt,
    lastOpenedAt: session.lastOpenedAt,
    messageCount: messages.length,
    userMessageCount: messages.filter((message) => message.role === 'user')
      .length,
    assistantMessageCount: messages.filter(
      (message) => message.role === 'assistant',
    ).length,
    toolCallCount: countToolCalls(messages),
    agentProgressCount: Object.keys(session.agentProgress ?? {}).length,
    agentSnapshotCount: Object.keys(session.agentSnapshots ?? {}).length,
  };
}

/**
 * Normalizes session UI messages for debug display.
 *
 * @param session - Chat session whose messages should be listed.
 */
export function getSessionDebugMessages(
  session: ChatSessionSchema,
): DebugMessage[] {
  return ((session.uiMessages ?? []) as UIMessage[]).map((message, index) => ({
    id: message.id,
    index,
    role: message.role,
    partCount: getMessageParts(message).length,
    textPreview: getTextPreview(message),
    raw: message,
  }));
}

/**
 * Extracts top-level tool calls from session UI messages.
 *
 * @param session - Chat session to inspect.
 * @param agentProgress - Optional agent-progress map used to mark tool calls.
 */
export function getSessionDebugToolCalls(
  session: ChatSessionSchema,
  agentProgress: Record<string, unknown[]> = {},
): DebugToolCall[] {
  return ((session.uiMessages ?? []) as UIMessage[]).flatMap(
    (message, messageIndex) =>
      getMessageParts(message).flatMap((part, partIndex) => {
        const toolCall = getToolCallFromPart({
          message,
          messageIndex,
          part,
          partIndex,
          agentProgress,
        });
        return toolCall ? [toolCall] : [];
      }),
  );
}

/**
 * Merges persisted and live agent progress, preferring live entries.
 *
 * @param session - Chat session containing persisted progress.
 * @param liveAgentProgress - In-memory progress from the current store.
 */
export function getSessionDebugAgentProgress(
  session: ChatSessionSchema,
  liveAgentProgress: Record<string, AgentToolCall[]> = {},
): DebugAgentProgressEntry[] {
  const sessionProgress =
    (session.agentProgress as Record<string, AgentToolCall[]> | undefined) ??
    {};
  const keys = new Set([
    ...Object.keys(sessionProgress),
    ...Object.keys(liveAgentProgress),
  ]);

  return Array.from(keys)
    .sort()
    .map((parentToolCallId) => {
      const live = liveAgentProgress[parentToolCallId];
      if (live) {
        return {parentToolCallId, toolCalls: live, source: 'live' as const};
      }
      return {
        parentToolCallId,
        toolCalls: sessionProgress[parentToolCallId] ?? [],
        source: 'session' as const,
      };
    });
}

/**
 * Merges persisted and live agent snapshots, preferring live entries.
 *
 * @param session - Chat session containing persisted snapshots.
 * @param liveAgentSnapshots - In-memory snapshots from the current store.
 */
export function getSessionDebugAgentSnapshots(
  session: ChatSessionSchema,
  liveAgentSnapshots: Record<string, AgentSnapshot> = {},
): DebugAgentSnapshotEntry[] {
  const sessionSnapshots =
    (session.agentSnapshots as Record<string, AgentSnapshot> | undefined) ?? {};
  const keys = new Set([
    ...Object.keys(sessionSnapshots),
    ...Object.keys(liveAgentSnapshots),
  ]);

  return Array.from(keys)
    .sort()
    .flatMap((parentToolCallId): DebugAgentSnapshotEntry[] => {
      const live = liveAgentSnapshots[parentToolCallId];
      if (live) {
        return [{parentToolCallId, snapshot: live, source: 'live' as const}];
      }
      const snapshot = sessionSnapshots[parentToolCallId];
      return snapshot
        ? [{parentToolCallId, snapshot, source: 'session' as const}]
        : [];
    });
}

/**
 * Builds a chronological message timeline with tool calls and agent debug data.
 */
export function getSessionDebugTimeline({
  session,
  liveAgentProgress = {},
  liveAgentSnapshots = {},
}: {
  session: ChatSessionSchema;
  liveAgentProgress?: Record<string, AgentToolCall[]>;
  liveAgentSnapshots?: Record<string, AgentSnapshot>;
}): DebugTimelineMessage[] {
  const agentProgress = getSessionDebugAgentProgress(
    session,
    liveAgentProgress,
  );
  const agentSnapshots = getSessionDebugAgentSnapshots(
    session,
    liveAgentSnapshots,
  );
  const agentProgressById = Object.fromEntries(
    agentProgress.map((entry) => [entry.parentToolCallId, entry]),
  );
  const agentSnapshotsById = Object.fromEntries(
    agentSnapshots.map((entry) => [entry.parentToolCallId, entry]),
  );
  const toolProgressById = Object.fromEntries(
    agentProgress.map((entry) => [entry.parentToolCallId, entry.toolCalls]),
  );

  return ((session.uiMessages ?? []) as UIMessage[]).map(
    (message, messageIndex) => {
      const parts = getMessageParts(message).map((part, partIndex) => {
        const toolCall = getToolCallFromPart({
          message,
          messageIndex,
          part,
          partIndex,
          agentProgress: toolProgressById,
        });
        if (toolCall) {
          return {
            kind: 'tool' as const,
            index: partIndex,
            toolCall,
            agentProgress: agentProgressById[toolCall.toolCallId],
            agentSnapshot: agentSnapshotsById[toolCall.toolCallId],
          };
        }

        const type = getPartType(part);
        const text = getPartText(part);
        if (type === 'text' && text !== undefined) {
          return {
            kind: 'text' as const,
            index: partIndex,
            text,
            raw: part,
          };
        }

        if (type === 'reasoning' && text !== undefined) {
          return {
            kind: 'reasoning' as const,
            index: partIndex,
            text,
            raw: part,
          };
        }

        return {
          kind: 'other' as const,
          index: partIndex,
          type,
          raw: part,
        };
      });

      return {
        message: {
          id: message.id,
          index: messageIndex,
          role: message.role,
          partCount: parts.length,
          textPreview: getTextPreview(message),
          raw: message,
        },
        parts,
      };
    },
  );
}

/**
 * Lists registered tools with execute/renderer availability for debug display.
 *
 * @param tools - Tool registry from the AI store.
 * @param toolRenderers - Renderer registry from the AI store.
 */
export function getAvailableToolDebugInfo(
  tools: StoredToolSet,
  toolRenderers: ToolRendererRegistry = {},
): AvailableToolDebugInfo[] {
  return Object.entries(tools)
    .map(([name, tool]) => ({
      name,
      description:
        typeof tool.description === 'string' ? tool.description : undefined,
      hasExecute: typeof tool.execute === 'function',
      hasRenderer: Boolean(toolRenderers[name]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
