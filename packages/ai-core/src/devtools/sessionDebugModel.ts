import type {ChatSessionSchema} from '@sqlrooms/ai-config';
import type {UIMessage} from 'ai';
import type {
  AgentSnapshot,
  AgentToolCall,
  StoredToolSet,
  ToolRendererRegistry,
} from '../types';

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

export type DebugMessage = {
  id: string;
  index: number;
  role: string;
  partCount: number;
  textPreview: string;
  raw: UIMessage;
};

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

export type DebugAgentProgressEntry = {
  parentToolCallId: string;
  toolCalls: AgentToolCall[];
  source: 'live' | 'session';
};

export type DebugAgentSnapshotEntry = {
  parentToolCallId: string;
  snapshot: AgentSnapshot;
  source: 'live' | 'session';
};

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

export function getSessionDebugToolCalls(
  session: ChatSessionSchema,
  agentProgress: Record<string, unknown[]> = {},
): DebugToolCall[] {
  return ((session.uiMessages ?? []) as UIMessage[]).flatMap(
    (message, messageIndex) =>
      getMessageParts(message).flatMap((part, partIndex) => {
        if (!isToolLikePart(part)) return [];
        const toolCallId = part.toolCallId;
        if (!toolCallId) return [];
        return [
          {
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
          },
        ];
      }),
  );
}

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

export function getSessionDebugAgentSnapshots(
  session: ChatSessionSchema,
  liveAgentSnapshots: Record<string, AgentSnapshot> = {},
): DebugAgentSnapshotEntry[] {
  const sessionSnapshots =
    (session.agentSnapshots as Record<string, AgentSnapshot> | undefined) ??
    {};
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
