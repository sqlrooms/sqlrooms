import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {createId} from '@paralleldrive/cuid2';
import {
  setAiRunContextPrimaryItem,
  type AiRunContext,
  type ChatSessionSchema,
} from '@sqlrooms/ai-config';
import type {StoreApi} from '@sqlrooms/room-store';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {
  LanguageModel,
  LanguageModelUsage,
  TextStreamPart,
  ToolSet,
} from 'ai';
import {
  createAgentUIStreamResponse,
  DefaultChatTransport,
  stepCountIs,
  ToolLoopAgent,
  UIMessage,
} from 'ai';
import {produce} from 'immer';
import {TOOL_CALL_CANCELLED} from './constants';
import {
  CHAT_REQUEST_ERROR_PART_TYPE,
  createChatRequestErrorPart,
  setChatRequestErrorMessage,
} from './chatTurns';
import type {
  AiSliceStateForTransport,
  AiToolExecutionContext,
  ToolTimingEntry,
  AssistantMessageMetadata,
  MessageTokenUsage,
  AgentToolCall,
} from './types';
import {
  fixIncompleteToolCalls,
  mergeAbortSignals,
  sanitizeMessagesForLLM,
  shouldEndAnalysis,
} from './utils';
import {formatAbortSnapshot} from './agents/AgentUtils';
import {
  ChatTimeoutError,
  createToolTimeoutError,
  getTimedOutSessionAgentState,
  getTimedOutToolAgentState,
  getToolExecutionTimeoutMs,
  type AiTimeoutOptions,
} from './timeouts';
import {tryMeasureProviderContext} from './devtools/providerContextDiagnostics';
import {prepareOpenAiCompatibleToolImages} from './openAiCompatibleToolImages';

/**
 * Write tool timings from the store into assistant message metadata so they
 * survive serialization. Mutates `messages` in place — callers should pass
 * cloned messages (e.g., from `fixIncompleteToolCalls`).
 */
export function writeToolTimingsToMetadata(
  messages: UIMessage[],
  allTimings: Record<string, ToolTimingEntry>,
): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;

    const toolCallIds = msg.parts
      .filter(
        (p) =>
          typeof p.type === 'string' &&
          (p.type.startsWith('tool-') || p.type === 'dynamic-tool'),
      )
      .map((p) => (p as {toolCallId?: string}).toolCallId)
      .filter((id): id is string => !!id);

    if (toolCallIds.length === 0) continue;

    const timings: Record<string, ToolTimingEntry> = {};
    for (const id of toolCallIds) {
      const entry = allTimings[id];
      if (entry) timings[id] = entry;
    }

    if (Object.keys(timings).length > 0) {
      const existing = (msg.metadata ?? {}) as AssistantMessageMetadata;
      msg.metadata = {
        ...existing,
        toolTimings: {...(existing.toolTimings ?? {}), ...timings},
      };
    }
  }
}

/**
 * Walk completed messages and enrich any cancelled agent tool calls with
 * human-readable progress snapshots from the store. Mutates `messages` in place.
 */
function enrichMessagesWithAbortSnapshots(
  messages: UIMessage[],
  state: AiSliceStateForTransport,
): void {
  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.parts) continue;
    for (let i = 0; i < msg.parts.length; i++) {
      const part = msg.parts[i] as Record<string, unknown>;
      if (
        part.state !== 'output-error' ||
        !part.toolCallId ||
        typeof part.toolCallId !== 'string'
      ) {
        continue;
      }
      const snapshot = state.ai.readAbortSnapshot?.(part.toolCallId as string);
      if (!snapshot) continue;

      const formatted = formatAbortSnapshot(snapshot);
      const existingError =
        typeof part.errorText === 'string'
          ? part.errorText
          : TOOL_CALL_CANCELLED;
      part.errorText = `${existingError}\nProgress before cancellation:\n${formatted}`;
    }
  }
}

export function writeAgentDebugStateToSession(
  session: ChatSessionSchema,
  state: AiSliceStateForTransport,
): void {
  const sessionToolCallIds = getSessionToolCallIds(session);
  addReachableAgentToolCallIds(sessionToolCallIds, state.ai.agentProgress);

  session.agentProgress = structuredClone(
    filterRecordByKeys(state.ai.agentProgress, sessionToolCallIds),
  ) as ChatSessionSchema['agentProgress'];

  if (state.ai.devtools.shouldPersistAgentSnapshots()) {
    session.agentSnapshots = structuredClone(
      filterRecordByKeys(state.ai.devtools.agentSnapshots, sessionToolCallIds),
    ) as ChatSessionSchema['agentSnapshots'];
  } else {
    delete session.agentSnapshots;
  }
}

function getSessionToolCallIds(session: ChatSessionSchema): Set<string> {
  const toolCallIds = new Set<string>();

  for (const message of (session.uiMessages ?? []) as UIMessage[]) {
    for (const part of message.parts ?? []) {
      const toolCallId = (part as {toolCallId?: unknown}).toolCallId;
      if (typeof toolCallId === 'string') {
        toolCallIds.add(toolCallId);
      }
    }
  }

  return toolCallIds;
}

function addReachableAgentToolCallIds(
  toolCallIds: Set<string>,
  agentProgress: Record<string, AgentToolCall[]>,
): void {
  let foundNewToolCall = true;

  while (foundNewToolCall) {
    foundNewToolCall = false;

    for (const [parentToolCallId, toolCalls] of Object.entries(agentProgress)) {
      if (!toolCallIds.has(parentToolCallId)) continue;

      for (const toolCall of toolCalls) {
        foundNewToolCall =
          addAgentToolCallIds(toolCallIds, toolCall) || foundNewToolCall;
      }
    }
  }
}

function addAgentToolCallIds(
  toolCallIds: Set<string>,
  toolCall: AgentToolCall,
): boolean {
  let foundNewToolCall = false;

  if (!toolCallIds.has(toolCall.toolCallId)) {
    toolCallIds.add(toolCall.toolCallId);
    foundNewToolCall = true;
  }

  for (const nestedCall of toolCall.agentToolCalls ?? []) {
    foundNewToolCall =
      addAgentToolCallIds(toolCallIds, nestedCall) || foundNewToolCall;
  }

  return foundNewToolCall;
}

function filterRecordByKeys<T>(
  record: Record<string, T>,
  keys: Set<string>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => keys.has(key)),
  );
}

export type ChatTransportConfig = {
  sessionId: string;
  store: StoreApi<AiSliceStateForTransport>;
  defaultProvider: string;
  defaultModel: string;
  headers?: Record<string, string>;
  getInstructions: () => string;
  /**
   * Optional: supply a pre-configured custom model.
   * e.g. import {anthropic} from "@ai-sdk/anthropic";
   * getCustomModel: () => anthropic('claude-sonnet-4-5')
   * If provided, this model will be used instead of the default OpenAI-compatible client.
   */
  getCustomModel?: () => LanguageModel | undefined;
  /** Optional timeout safety limits; all limits are disabled when omitted. */
  timeouts?: AiTimeoutOptions;
};

function getSessionById(
  store: StoreApi<AiSliceStateForTransport>,
  sessionId: string | undefined,
): ChatSessionSchema | undefined {
  if (!sessionId) return undefined;
  return store
    .getState()
    .ai.config.sessions.find((s: ChatSessionSchema) => s.id === sessionId);
}

/**
 * Wrap every executable tool in `tools` so it receives the invoking turn's
 * execution scope (`sessionId` plus the mutable `AiRunContext` accessors) in its
 * AI SDK execution options.
 *
 * Use this wherever a toolset is handed to an agent that does not itself own the
 * chat request — most importantly for nested `ToolLoopAgent` sub-agents, whose
 * tools would otherwise execute with no scope at all and fall back to whatever
 * artifact/map/session is currently visible in the UI.
 *
 * Semantics:
 *
 * - Parent scope wins over inner options when the parent supplies a value, so a
 *   nested agent cannot accidentally reassign the owning session. Fields the
 *   parent leaves `undefined` preserve whatever the inner options already had.
 * - `getAiRunContext` is read at execution time rather than captured, so an
 *   in-turn retarget (e.g. `set_primary_context_artifact`) is visible to later
 *   tool calls, including those inside nested agents.
 * - The inner tool's own `toolCallId`, `messages`, and `abortSignal` are left
 *   intact.
 * - `state` is optional and only used for `setToolCallSession` attribution. Omit
 *   it when forwarding into nested agents; the chat transport passes it so
 *   top-level tool calls stay attributed to their session.
 * - `getState` lets timeout cleanup read the latest nested-agent progress. It
 *   should be supplied by transports that provide `state`.
 * - Configured per-tool timeouts preserve upstream cancellation signals and
 *   abort the signal forwarded to the wrapped tool when its limit expires.
 */
export function withRunContextTools(
  tools: ToolSet,
  args: AiToolExecutionContext & {
    state?: AiSliceStateForTransport;
    getState?: () => AiSliceStateForTransport;
    timeouts?: AiTimeoutOptions;
  },
): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => {
      if (!tool || typeof tool.execute !== 'function') {
        return [name, tool];
      }

      const originalExecute = tool.execute;
      return [
        name,
        {
          ...tool,
          execute: async (
            input: unknown,
            options?: Record<string, unknown>,
          ) => {
            const toolCallId =
              typeof options?.toolCallId === 'string'
                ? options.toolCallId
                : undefined;
            if (toolCallId && args.sessionId) {
              args.state?.ai.setToolCallSession(toolCallId, args.sessionId);
            }
            const timeoutMs = getToolExecutionTimeoutMs(args.timeouts, name);
            const timeoutController =
              timeoutMs == null ? undefined : new AbortController();
            const incomingAbortSignal = options?.abortSignal as
              | AbortSignal
              | undefined;
            const abortSignal = mergeAbortSignals([
              incomingAbortSignal,
              timeoutController?.signal,
            ]);
            const executionOptions = {
              ...options,
              abortSignal,
              ...definedScopeFields({
                sessionId: args.sessionId,
                aiRunContext: args.getAiRunContext
                  ? args.getAiRunContext()
                  : args.aiRunContext,
                getAiRunContext: args.getAiRunContext,
                setAiRunContext: args.setAiRunContext,
                setPrimaryRunContextItem: args.setPrimaryRunContextItem,
              }),
            } as never;

            if (timeoutMs == null || !timeoutController) {
              return originalExecute(input as never, executionOptions);
            }

            let timeoutId: ReturnType<typeof setTimeout> | undefined;
            const timeoutError = createToolTimeoutError(name, timeoutMs);
            const timeoutPromise = new Promise<never>((_resolve, reject) => {
              timeoutId = setTimeout(() => {
                reject(timeoutError);
                try {
                  normalizeTimedOutToolAgentState(
                    args.getState?.() ?? args.state,
                    toolCallId,
                    timeoutError.message,
                  );
                } finally {
                  timeoutController.abort(timeoutError);
                }
              }, timeoutMs);
            });

            try {
              return await Promise.race([
                Promise.resolve(
                  originalExecute(input as never, executionOptions),
                ),
                timeoutPromise,
              ]);
            } finally {
              if (timeoutId) clearTimeout(timeoutId);
            }
          },
        },
      ];
    }),
  ) as ToolSet;
}

/**
 * Drop `undefined` scope fields so wrapping a toolset with a partially
 * populated parent context never erases scope the inner options already carry.
 */
function definedScopeFields(
  fields: AiToolExecutionContext,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
}

function normalizeTimedOutToolAgentState(
  state: AiSliceStateForTransport | undefined,
  toolCallId: string | undefined,
  timeoutMessage: string,
): void {
  if (!state || !toolCallId) return;

  const timedOutAgentState = getTimedOutToolAgentState(
    toolCallId,
    state.ai.agentProgress,
    state.ai.pendingSubAgentApprovals,
    timeoutMessage,
  );
  for (const [parentToolCallId, toolCalls] of Object.entries(
    timedOutAgentState.agentProgress,
  )) {
    if (toolCalls !== state.ai.agentProgress[parentToolCallId]) {
      state.ai.updateAgentProgress(parentToolCallId, toolCalls);
    }
  }
  for (const approvalId of timedOutAgentState.approvalIds) {
    state.ai.resolveSubAgentApproval(approvalId, false);
  }
}

/**
 * The AI SDK stream metadata is not reliably surfaced back onto `UIMessage.metadata`
 * for our local transport setup, so persist token usage per session and stamp it
 * onto the last assistant message ourselves during `onChatFinish`.
 */
const sessionTokenUsage = new Map<string, MessageTokenUsage>();

function rememberSessionTokenUsage(
  sessionId: string,
  usage: MessageTokenUsage,
): void {
  sessionTokenUsage.set(sessionId, structuredClone(usage));
}

function consumeSessionTokenUsage(
  sessionId: string,
): MessageTokenUsage | undefined {
  const usage = sessionTokenUsage.get(sessionId);
  sessionTokenUsage.delete(sessionId);
  return usage;
}

function writeTokenUsageToLastAssistantMessage(
  messages: UIMessage[],
  usage: MessageTokenUsage | undefined,
): void {
  if (!usage || usage.totalTokens <= 0) return;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant') continue;

    const existing = (msg.metadata ?? {}) as AssistantMessageMetadata;
    msg.metadata = {
      ...existing,
      tokenUsage: usage,
    };
    return;
  }
}

function toMessageTokenUsage(
  usage: LanguageModelUsage | undefined,
): MessageTokenUsage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    totalTokens: usage?.totalTokens ?? 0,
    inputTokenDetails: {
      cacheReadTokens: usage?.inputTokenDetails?.cacheReadTokens,
      cacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens,
    },
    outputTokenDetails: {
      reasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
    },
  };
}

function extractProviderErrorMessage(
  error: unknown,
  seen = new Set<unknown>(),
): string | undefined {
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed.startsWith('{')) return undefined;
    try {
      return extractProviderErrorMessage(JSON.parse(trimmed), seen);
    } catch {
      return undefined;
    }
  }

  if (!error || typeof error !== 'object' || seen.has(error)) {
    return undefined;
  }
  seen.add(error);

  const record = error as Record<string, unknown>;
  const providerError = record.error;
  if (providerError && typeof providerError === 'object') {
    const providerRecord = providerError as Record<string, unknown>;
    if (typeof providerRecord.message === 'string') {
      return providerRecord.message;
    }
  }

  const commonFields = [
    record.data,
    record.responseBody,
    record.body,
    record.response,
    record.cause,
  ];
  for (const field of commonFields) {
    const message = extractProviderErrorMessage(field, seen);
    if (message) return message;
  }

  return undefined;
}

export function getChatErrorMessageForDisplay(error: unknown): string {
  const providerMessage = extractProviderErrorMessage(error);
  if (providerMessage) return providerMessage;

  const message = getErrorMessageForDisplay(error);
  return message && message.trim().length > 0 ? message : 'Unknown error';
}

export function createLocalChatTransportFactory({
  sessionId,
  store,
  defaultProvider,
  defaultModel,
  headers,
  getInstructions,
  getCustomModel,
  timeouts,
}: ChatTransportConfig) {
  return () => {
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      // Parse caller-supplied body defensively to avoid breaking the stream
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch (parseError) {
        console.error(
          'Failed to parse chat transport body. Messages will be empty.',
          {bodyType: typeof body, bodyLength: body?.length, parseError},
        );
        parsed = {};
      }
      const parsedObj = (parsed as {messages?: unknown}) || {};

      // Resolve provider/model/apiKey/baseUrl at call time to pick up latest settings.
      const state = store.getState();
      const sessionFromBody = getSessionById(store, sessionId);
      const provider = sessionFromBody?.modelProvider || defaultProvider;
      const modelId = sessionFromBody?.model || defaultModel;
      let aiRunContext = sessionFromBody?.runContext;
      const setAiRunContext = (nextContext: AiRunContext | undefined) => {
        aiRunContext = nextContext;
        state.ai.setSessionRunContext(sessionId, nextContext);
      };

      // Fetch API key and base URL dynamically to pick up settings changes
      const apiKey = state.ai.getApiKeyFromSettings();
      const baseUrl = state.ai.getBaseUrlFromSettings();

      // Prefer a user-supplied model if available
      let model: LanguageModel | undefined = getCustomModel?.();
      const usesOpenAiCompatibleModel = !model;

      // Fallback to OpenAI-compatible if no custom model provided
      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl ?? 'https://api.openai.com/v1',
          headers,
          includeUsage: true,
        });
        model = openai.chatModel(modelId);
      }

      const messagesCopy = Array.isArray(parsedObj.messages)
        ? (parsedObj.messages as UIMessage[])
        : [];

      // Pass tools with their execute functions — the ToolLoopAgent runs the
      // full tool loop server-side. UI-approval tools (no execute) are paused
      // by the agent and resumed via addToolOutput from the client.
      // Cast: state.ai.tools holds real AI SDK tools behind StoredToolSet.
      const tools = withRunContextTools((state.ai.tools || {}) as ToolSet, {
        state,
        getState: () => store.getState(),
        sessionId,
        aiRunContext,
        getAiRunContext: () => aiRunContext,
        setAiRunContext,
        setPrimaryRunContextItem: (item) => {
          setAiRunContext(setAiRunContextPrimaryItem(aiRunContext, item));
        },
        timeouts,
      });

      // get system instructions dynamically at request time to ensure fresh table schema
      const systemInstructions = getInstructions();

      const providerOptions = state.ai.getProviderOptions?.({
        provider,
        modelId,
      });

      // Get abort controller for the owning session (from body) if available
      const sessionAbortSignal = state.ai.getAbortController(sessionId)?.signal;
      // Also respect the request-level abort signal from useChat().stop()
      const abortSignal = mergeAbortSignals([
        init?.signal ?? undefined,
        sessionAbortSignal,
      ]);

      const maxSteps = state.ai.getMaxStepsFromSettings();
      const diagnosticsByStep: string[] = [];
      let completedDiagnosticStep = 0;

      const agent = new ToolLoopAgent({
        model,
        instructions: systemInstructions,
        tools,
        stopWhen: stepCountIs(maxSteps),
        prepareStep: async ({stepNumber, messages}) => {
          const providerMessages = usesOpenAiCompatibleModel
            ? prepareOpenAiCompatibleToolImages(messages)
            : messages;
          const preparedStep =
            providerMessages === messages
              ? undefined
              : {messages: providerMessages};
          if (!state.ai.devtools.shouldCaptureProviderContexts()) {
            return preparedStep;
          }
          const diagnostic = await tryMeasureProviderContext({
            role: 'chat-coordinator',
            provider,
            model: modelId,
            sessionId,
            step: stepNumber,
            instructions: systemInstructions,
            messages: providerMessages,
            tools,
            sources: [
              'base-instructions',
              'session-run-context',
              'sanitized-session-messages',
              'top-level-tool-registry',
            ],
          });
          if (!diagnostic) return preparedStep;
          diagnosticsByStep[stepNumber] = diagnostic.id;
          state.ai.devtools.writeProviderContext(diagnostic);
          return preparedStep;
        },
        onStepFinish: ({usage}) => {
          const diagnosticId = diagnosticsByStep[completedDiagnosticStep++];
          if (diagnosticId && usage.inputTokens != null) {
            state.ai.devtools.setProviderContextInputTokens(
              diagnosticId,
              usage.inputTokens,
            );
          }
        },
        ...(providerOptions ? {providerOptions} : {}),
      });

      // Accumulate token usage across steps for this response
      const accumulatedUsage: MessageTokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };
      let lastStepInputTokens = 0;

      return createAgentUIStreamResponse({
        agent,
        uiMessages: sanitizeMessagesForLLM(
          fixIncompleteToolCalls(messagesCopy),
          Object.keys(tools),
        ),
        abortSignal,
        onError: getChatErrorMessageForDisplay,
        messageMetadata: ({part}: {part: TextStreamPart<ToolSet>}) => {
          if (part.type === 'finish-step') {
            const u = part.usage;
            accumulatedUsage.inputTokens += u.inputTokens ?? 0;
            accumulatedUsage.outputTokens += u.outputTokens ?? 0;
            accumulatedUsage.totalTokens += u.totalTokens ?? 0;
            lastStepInputTokens = u.inputTokens ?? 0;
            if (
              u.inputTokenDetails?.cacheReadTokens != null ||
              u.inputTokenDetails?.cacheWriteTokens != null
            ) {
              accumulatedUsage.inputTokenDetails = {
                cacheReadTokens:
                  (accumulatedUsage.inputTokenDetails?.cacheReadTokens ?? 0) +
                  (u.inputTokenDetails?.cacheReadTokens ?? 0),
                cacheWriteTokens:
                  (accumulatedUsage.inputTokenDetails?.cacheWriteTokens ?? 0) +
                  (u.inputTokenDetails?.cacheWriteTokens ?? 0),
              };
            }
            if (u.outputTokenDetails?.reasoningTokens != null) {
              accumulatedUsage.outputTokenDetails = {
                reasoningTokens:
                  (accumulatedUsage.outputTokenDetails?.reasoningTokens ?? 0) +
                  (u.outputTokenDetails.reasoningTokens ?? 0),
              };
            }
          }
          if (part.type === 'finish') {
            // Prefer totalUsage from the finish event (authoritative cumulative value
            // from the agent) over per-step accumulated values which may be zeros
            // when the provider doesn't report usage in streaming chunks.
            const finishPart = part as {
              totalUsage?: LanguageModelUsage;
              usage?: LanguageModelUsage;
            };
            const finishUsage = toMessageTokenUsage(
              finishPart.totalUsage ?? finishPart.usage,
            );
            const finalUsage =
              finishUsage.totalTokens > 0 ||
              finishUsage.inputTokens > 0 ||
              finishUsage.outputTokens > 0
                ? finishUsage
                : accumulatedUsage;
            finalUsage.lastStepInputTokens = lastStepInputTokens;
            rememberSessionTokenUsage(sessionId, finalUsage);
            return {
              tokenUsage: finalUsage,
            } satisfies AssistantMessageMetadata;
          }
          return undefined;
        },
      });
    };

    return new DefaultChatTransport({fetch: fetchImpl});
  };
}

export function createRemoteChatTransportFactory(params: {
  store: StoreApi<AiSliceStateForTransport>;
  defaultProvider: string;
  defaultModel: string;
  sessionId: string;
  getInstructions: () => string;
}) {
  return (endpoint: string, headers?: Record<string, string>) => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const {store, defaultProvider, defaultModel, sessionId, getInstructions} =
        params;
      // Resolve provider/model/instructions at call time to pick up latest settings.
      const state = store.getState();

      // Parse caller-supplied body defensively to avoid breaking the stream
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch (parseError) {
        console.error(
          'Failed to parse remote chat transport body. Messages will be empty.',
          {bodyType: typeof body, bodyLength: body?.length, parseError},
        );
        parsed = {};
      }

      const sessionFromBody = getSessionById(store, sessionId);
      const modelProvider = sessionFromBody?.modelProvider || defaultProvider;
      const model = sessionFromBody?.model || defaultModel;

      const parsedObj =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      const messages = Array.isArray(parsedObj.messages)
        ? sanitizeMessagesForLLM(
            fixIncompleteToolCalls(parsedObj.messages as UIMessage[]),
          )
        : [];
      const enhancedBody = {
        ...parsedObj,
        messages,
        modelProvider,
        model,
        instructions: getInstructions(),
        runContext: sessionFromBody?.runContext,
        maxSteps: state.ai.getMaxStepsFromSettings(),
      };

      // Merge request abort (useChat.stop) with per-session abort (cancelAnalysis)
      const sessionAbortSignal = state.ai.getAbortController(sessionId)?.signal;
      const abortSignal = mergeAbortSignals([
        init?.signal ?? undefined,
        sessionAbortSignal,
      ]);

      // Make the request with enhanced body
      return fetch(input, {
        ...init,
        headers: mergeRemoteChatHeaders(
          headers,
          state.ai.chatHeaders,
          init?.headers,
        ),
        signal: abortSignal,
        body: JSON.stringify(enhancedBody),
      });
    };

    return new DefaultChatTransport({
      api: endpoint,
      credentials: 'include',
      fetch: fetchImpl,
    });
  };
}

export function mergeRemoteChatHeaders(
  configuredHeaders: Record<string, string> | undefined,
  currentHeaders: Record<string, string>,
  requestHeaders: HeadersInit | undefined,
) {
  const mergedHeaders = new Headers(configuredHeaders);
  new Headers(requestHeaders).forEach((value, name) => {
    mergedHeaders.set(name, value);
  });
  for (const [name, value] of Object.entries(currentHeaders)) {
    mergedHeaders.set(name, value);
  }
  return Object.fromEntries(mergedHeaders);
}

function selectErrorSourceMessages({
  sessionMessages,
  fallbackMessages,
}: {
  sessionMessages: UIMessage[];
  fallbackMessages?: UIMessage[];
}): UIMessage[] {
  if (fallbackMessages && fallbackMessages.length > 0) {
    return fallbackMessages;
  }
  return sessionMessages;
}

function hasChatRequestErrorPart(message: UIMessage | undefined): boolean {
  return Boolean(
    message?.role === 'assistant' &&
    message.parts?.some((part) => part.type === CHAT_REQUEST_ERROR_PART_TYPE),
  );
}

function createChatRequestErrorMessage(error: string): UIMessage {
  return {
    id: createId(),
    role: 'assistant',
    parts: [createChatRequestErrorPart({error})],
  };
}

export function createChatHandlers({
  store,
  onChatFinish,
}: {
  store: StoreApi<AiSliceStateForTransport>;
  onChatFinish?: (args: {sessionId: string; messages: UIMessage[]}) => void;
}) {
  return {
    onChatFinish: ({
      sessionId,
      messages,
    }: {
      sessionId: string;
      messages: UIMessage[];
    }) => {
      if (!sessionId) return;
      try {
        const state = store.getState();
        const abortController = state.ai.getAbortController(sessionId);

        // check if the analysis has been aborted, force-complete and clean up immediately
        const aborted = !!abortController?.signal.aborted;
        if (aborted) {
          const sessionMessages =
            (getSessionById(store, sessionId)?.uiMessages as UIMessage[]) || [];
          const sourceMessages =
            messages && messages.length > 0 ? messages : sessionMessages;
          const abortReason = abortController?.signal.reason;
          const abortMessage =
            abortReason instanceof ChatTimeoutError
              ? abortReason.message
              : TOOL_CALL_CANCELLED;
          const completedMessages = fixIncompleteToolCalls(
            sourceMessages,
            abortMessage,
            {completeApprovalRequests: abortReason instanceof ChatTimeoutError},
          );

          // Enrich cancelled agent tool calls with progress snapshots so the
          // LLM can see what sub-agents accomplished before the abort.
          enrichMessagesWithAbortSnapshots(completedMessages, state);

          consumeSessionTokenUsage(sessionId);
          writeToolTimingsToMetadata(
            completedMessages,
            state.ai.getToolTimings(),
          );
          const cancelledUserMessage = completedMessages
            .filter((msg) => msg.role === 'user')
            .slice(-1)[0];
          if (cancelledUserMessage) {
            setChatRequestErrorMessage(cancelledUserMessage, {
              error: abortMessage,
            });
          }
          state.ai.setSessionUiMessages(sessionId, completedMessages);

          state.ai.setIsRunning(sessionId, false);
          state.ai.setAbortController(sessionId, undefined);
          // Clear transient abort snapshots now that they've been embedded
          state.ai.clearAbortSnapshots?.();

          // Force useChat to reinitialize with the fixed messages
          store.setState((s: AiSliceStateForTransport) =>
            produce(s, (draft: AiSliceStateForTransport) => {
              const sess = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (sess) {
                sess.messagesRevision = (sess.messagesRevision || 0) + 1;
                writeAgentDebugStateToSession(sess, state);
              }
            }),
          );

          return;
        }

        // fix any incomplete tool-calls before saving (can happen with AbortController)
        const completedMessages = fixIncompleteToolCalls(messages);
        writeTokenUsageToLastAssistantMessage(
          completedMessages,
          consumeSessionTokenUsage(sessionId),
        );
        writeToolTimingsToMetadata(
          completedMessages,
          state.ai.getToolTimings(),
        );
        state.ai.setSessionUiMessages(sessionId, completedMessages);

        store.setState((stateToUpdate: AiSliceStateForTransport) =>
          produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
            const targetSession = draft.ai.config.sessions.find(
              (s: ChatSessionSchema) => s.id === sessionId,
            );
            if (!targetSession) return;

            writeAgentDebugStateToSession(targetSession, state);
          }),
        );

        if (shouldEndAnalysis(completedMessages)) {
          state.ai.setIsRunning(sessionId, false);
          state.ai.setAbortController(sessionId, undefined);
          onChatFinish?.({sessionId, messages: completedMessages});
        }
      } catch (err) {
        console.error('onChatFinish error:', err);
        throw err;
      }
    },
    onChatError: (
      sessionId: string,
      error: unknown,
      fallbackMessages?: UIMessage[],
    ) => {
      try {
        consumeSessionTokenUsage(sessionId);
        const timeoutReason = store.getState().ai.getAbortController(sessionId)
          ?.signal.reason;
        const errMsg =
          timeoutReason instanceof ChatTimeoutError
            ? timeoutReason.message
            : getChatErrorMessageForDisplay(error);

        // Detect API key errors (401/403 or common error messages)
        const isApiKeyError = isAuthenticationError(error, errMsg);
        if (isApiKeyError) {
          const session = getSessionById(store, sessionId);
          const provider = session?.modelProvider || 'openai';
          store.getState().ai.setApiKeyError(provider, true);
        }

        const currentState = store.getState();
        const toolTimings = currentState.ai.getToolTimings();
        const timedOutApprovalIds: string[] = [];

        store.setState((state: AiSliceStateForTransport) =>
          produce(state, (draft: AiSliceStateForTransport) => {
            if (!sessionId) return;
            const targetSession = draft.ai.config.sessions.find(
              (s: ChatSessionSchema) => s.id === sessionId,
            );
            if (targetSession) {
              const existingMessages = (targetSession.uiMessages ||
                []) as UIMessage[];
              const sourceMessages = selectErrorSourceMessages({
                sessionMessages: existingMessages,
                fallbackMessages,
              });
              const completedMessages = fixIncompleteToolCalls(
                sourceMessages,
                errMsg,
                {
                  completeApprovalRequests:
                    timeoutReason instanceof ChatTimeoutError,
                },
              );
              writeToolTimingsToMetadata(completedMessages, toolTimings);

              const lastUserMessage = completedMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];

              if (lastUserMessage) {
                setChatRequestErrorMessage(lastUserMessage, {error: errMsg});
              }

              if (!hasChatRequestErrorPart(completedMessages.at(-1))) {
                completedMessages.push(createChatRequestErrorMessage(errMsg));
              }

              targetSession.uiMessages =
                completedMessages as ChatSessionSchema['uiMessages'];
              let stateForPersistence = currentState;
              if (timeoutReason instanceof ChatTimeoutError) {
                const timedOutAgentState = getTimedOutSessionAgentState(
                  completedMessages,
                  currentState.ai.agentProgress,
                  currentState.ai.pendingSubAgentApprovals,
                  errMsg,
                );
                for (const [parentToolCallId, toolCalls] of Object.entries(
                  timedOutAgentState.agentProgress,
                )) {
                  draft.ai.agentProgress[parentToolCallId] = toolCalls;
                }
                for (const approvalId of timedOutAgentState.approvalIds) {
                  delete draft.ai.pendingSubAgentApprovals[approvalId];
                  timedOutApprovalIds.push(approvalId);
                }
                stateForPersistence = {
                  ...currentState,
                  ai: {
                    ...currentState.ai,
                    agentProgress: timedOutAgentState.agentProgress,
                  },
                };
              }
              writeAgentDebugStateToSession(targetSession, stateForPersistence);
            }
          }),
        );

        for (const approvalId of timedOutApprovalIds) {
          currentState.ai.resolveSubAgentApproval(approvalId, false);
        }

        // Force useChat to reinitialize with the fixed messages
        store.setState((s: AiSliceStateForTransport) =>
          produce(s, (draft: AiSliceStateForTransport) => {
            const sess = draft.ai.config.sessions.find(
              (s: ChatSessionSchema) => s.id === sessionId,
            );
            if (sess) {
              sess.messagesRevision = (sess.messagesRevision || 0) + 1;
            }
          }),
        );

        store.getState().ai.setIsRunning(sessionId, false);
        store.getState().ai.setAbortController(sessionId, undefined);
        store.getState().ai.clearAbortSnapshots?.();
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
  };
}

/**
 * Detects if an error is related to API key authentication issues.
 * Checks for HTTP 401/403 status codes and common error message patterns.
 */
function isAuthenticationError(error: unknown, errorMessage: string): boolean {
  // Check for HTTP status codes in the error object
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    const status =
      err.status ??
      err.statusCode ??
      (err.response as Record<string, unknown>)?.status;
    if (status === 401 || status === 403) {
      return true;
    }
  }

  // Check for common authentication error patterns in the message
  const lowerMsg = errorMessage.toLowerCase();
  const authPatterns = [
    'invalid api key',
    'incorrect api key',
    'invalid_api_key',
    'unauthorized',
    'authentication failed',
    'api key is invalid',
    'api key not found',
    'invalid authorization',
    'invalid credentials',
    'access denied',
    '401',
    '403',
  ];

  return authPatterns.some((pattern) => lowerMsg.includes(pattern));
}
