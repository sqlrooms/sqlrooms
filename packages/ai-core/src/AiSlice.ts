import {createId} from '@paralleldrive/cuid2';
import {
  AiSliceConfig,
  AiSessionForkOrigin,
  AnalysisResultSchema,
  ChatSessionSchema,
  createDefaultAiConfig,
} from '@sqlrooms/ai-config';
import type {AiRunContext} from '@sqlrooms/ai-config';
import {
  BaseRoomStoreState,
  createSlice,
  registerCommandsForOwner,
  RoomCommand,
  unregisterCommandsForOwner,
  useBaseRoomStore,
  type StateCreator,
} from '@sqlrooms/room-store';
import {generateUniqueName} from '@sqlrooms/utils';
import {Chat} from '@ai-sdk/react';
import {produce} from 'immer';
import {
  UIMessage,
  DefaultChatTransport,
  LanguageModel,
  FileUIPart,
  generateText,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  ToolSet,
} from 'ai';
import {
  createChatHandlers,
  createLocalChatTransportFactory,
  createRemoteChatTransportFactory,
  writeAgentDebugStateToSession,
  writeToolTimingsToMetadata,
} from './chatTransport';
import {
  ANALYSIS_CANCELLED,
  SESSION_DELETED,
  TOOL_CALL_CANCELLED,
} from './constants';
import {hasAiSettingsConfig} from './hasAiSettingsConfig';
import {cloneBoundedAgentSnapshot} from './devtools/agentSnapshots';
import type {
  AiDevtoolsState,
  AgentProgressSnapshot,
  AgentSnapshot,
  ProviderContextDiagnostic,
  AgentToolCall,
  GetProviderOptions,
  PendingSubAgentApproval,
  StoredToolSet,
  ToolRenderer,
  ToolRendererRegistry,
  ToolRenderers,
  ToolTimingEntry,
  AssistantMessageMetadata,
} from './types';
import {
  mergeLatestProviderContextMetricsForSession,
  tryMeasureProviderContext,
} from './devtools/providerContextDiagnostics';
import {
  fixIncompleteToolCalls,
  isModelInSettings,
  normalizeAiConfig,
  ToolAbortError,
} from './utils';
import {
  getAnalysisResultsFromUiMessages,
  setChatRequestErrorMessage,
  uiMessagesHaveChatRequestError,
} from './chatTurns';
import {
  cleanupSessionForks,
  createForkedChatSessionFromMessage,
  type ForkSessionFromMessageArgs,
} from './chatSessionForking';

import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {z} from 'zod';
import {
  createRunTimeoutError,
  getConfiguredTimeoutMs,
  getTimedOutSessionAgentState,
  type AiTimeoutOptions,
} from './timeouts';
import {createSessionChatRuntime} from './sessionChatRuntime';

const AI_COMMAND_OWNER = '@sqlrooms/ai-core';

export type {ForkSessionFromMessageArgs} from './chatSessionForking';

/** A resolved provider/model pair — what the next send would actually use. */
export type ModelSelection = {modelProvider: string; model: string};

export type AiSliceState = {
  ai: {
    initialize?: () => Promise<void>;
    destroy?: () => Promise<void>;
    config: AiSliceConfig;
    promptSuggestionsVisible: boolean;
    /** Transient composer prompt used before the first session is created. */
    draftPrompt: string;
    /** Tracks API key errors per provider (e.g., 401/403 responses) */
    apiKeyErrors: Record<string, boolean>;
    tools: StoredToolSet;
    toolRenderers: ToolRendererRegistry;
    /** Executable local tools that await browser output with remote chat. */
    remoteClientToolNames: string[];
    /** Opt-in timeout policy for chat runs and tool execution. */
    timeouts: AiTimeoutOptions;
    getProviderOptions?: GetProviderOptions;
    setConfig: (config: AiSliceConfig) => void;
    setPromptSuggestionsVisible: (visible: boolean) => void;
    /** Update the transient composer prompt used when no session is active. */
    setDraftPrompt: (prompt: string) => void;
    /** Set API key error flag for a provider */
    setApiKeyError: (provider: string, hasError: boolean) => void;
    /** Check if there's an API key error for the current provider */
    hasApiKeyError: () => boolean;
    getAbortController: (sessionId: string) => AbortController | undefined;
    setAbortController: (
      sessionId: string,
      controller: AbortController | undefined,
    ) => void;
    /** Return the ephemeral AI SDK chat for a session. */
    getSessionChat: (sessionId: string) => Chat<UIMessage> | undefined;
    /** Map toolCallId -> sessionId for long-running tool streams (e.g. agent tools) */
    setToolCallSession: (
      toolCallId: string,
      sessionId: string | undefined,
    ) => void;
    getToolCallSession: (toolCallId: string) => string | undefined;
    /** Live progress for sub-agent tool calls, keyed by parent toolCallId */
    agentProgress: Record<string, AgentToolCall[]>;
    updateAgentProgress: (
      parentToolCallId: string,
      toolCalls: AgentToolCall[],
    ) => void;
    clearAgentProgress: (parentToolCallId: string) => void;
    /** Devtools-only agent snapshot state and controls. */
    devtools: AiDevtoolsState;
    /** Pending approval requests from sub-agent tools with needsApproval */
    pendingSubAgentApprovals: Record<string, PendingSubAgentApproval>;
    requestSubAgentApproval: (approval: PendingSubAgentApproval) => void;
    resolveSubAgentApproval: (approvalId: string, approved: boolean) => void;
    clearSubAgentApproval: (approvalId: string) => void;
    /** Transient abort snapshots for nested agent progress propagation */
    writeAbortSnapshot: (
      toolCallId: string,
      snapshot: AgentProgressSnapshot,
    ) => void;
    readAbortSnapshot: (
      toolCallId: string,
    ) => AgentProgressSnapshot | undefined;
    clearAbortSnapshots: () => void;
    /** True while "summarize and continue" is in progress */
    isSummarizing: boolean;
    setIsSummarizing: (value: boolean) => void;
    /** Per-tool-call timing entries, keyed by toolCallId */
    toolTimings: Record<string, ToolTimingEntry>;
    setToolTiming: (toolCallId: string, entry: ToolTimingEntry) => void;
    getToolTimings: () => Record<string, ToolTimingEntry>;
    setPrompt: (sessionId: string, prompt: string) => void;
    getPrompt: (sessionId: string) => string;
    setIsRunning: (sessionId: string, isRunning: boolean) => void;
    getIsRunning: (sessionId: string) => boolean;
    addAnalysisResult: (message: UIMessage) => void;
    sendPrompt: (
      prompt: string,
      options?: {
        systemInstructions?: string;
        modelProvider?: string;
        modelName?: string;
        baseUrl?: string;
        abortSignal?: AbortSignal;
        useTools?: boolean;
        /** Stable diagnostics label for this provider caller. */
        role?: string;
        /** Names of the request-assembly sources, never source content. */
        contextSources?: string[];
        contextMetrics?: Record<string, number>;
        sessionId?: string;
      },
    ) => Promise<string>;
    startAnalysis: (
      sessionId: string,
      attachments?: FileUIPart[],
    ) => Promise<void>;
    /** Compatibility entry point; session controllers are ready synchronously. */
    startAnalysisWhenReady: (
      sessionId: string,
      attachments?: FileUIPart[],
    ) => Promise<boolean>;
    startNewSession: (name: string, prompt: string) => Promise<void>;
    cancelAnalysis: (sessionId: string) => void;
    setAiModel: (modelProvider: string, model: string) => void;
    /**
     * Resolve the model/provider that would be used right now: the current
     * session's selection when a session exists, otherwise the default that a
     * lazily created session would receive. Useful before any session exists,
     * e.g. to know which provider a first-time API key belongs to.
     */
    getSelectedModel: () => ModelSelection;
    /**
     * Whether a model is resolvable by *any* configured path: a custom-model
     * factory supplied to {@link AiSliceOptions.getCustomModel}, or — once a
     * session exists — its provider/model pair being present in the
     * `@sqlrooms/ai-settings` model list. With no session yet, the resolved
     * default is assumed available.
     *
     * Only checks that a factory **was configured**; never calls it, since
     * invoking it may have side effects and a factory returning `undefined`
     * means "configured but not currently ready".
     *
     * Prefer this over re-deriving readiness from `aiSettings.config`, so UI
     * and runtime agree on one source of truth.
     */
    hasResolvableModel: () => boolean;
    /**
     * Whether the model resolution path in effect needs a browser-held API key.
     *
     * `false` only when a `chatEndPoint` is configured (the request is sent
     * server-side), or when {@link AiSliceOptions.getCustomModel} is configured
     * *and currently returns a model*, which carries its own credentials. A
     * factory returning `undefined` still needs one: the transport then falls
     * back to the built-in OpenAI-compatible client.
     *
     * Unlike {@link AiSliceState.ai.hasResolvableModel} this **invokes the
     * factory**, so keep it cheap — it is called during render. The result is
     * cached per selection and retired when the AI settings change.
     */
    requiresApiKey: () => boolean;
    /**
     * Create a new chat session, make it the current session, and open it in a
     * tab. When `modelProvider`/`model` are omitted the current selection (or
     * configured defaults) are used.
     *
     * @returns The id of the newly created session.
     */
    createSession: (
      name?: string,
      modelProvider?: string,
      model?: string,
    ) => string;
    forkSessionFromMessage: (
      args: ForkSessionFromMessageArgs,
    ) => string | undefined;
    getSessionForkOrigin: (
      sessionId: string,
    ) => AiSessionForkOrigin | undefined;
    switchSession: (sessionId: string) => void;
    /**
     * Clear the current session selection (sets `currentSessionId` to
     * `undefined`) without deleting any session, returning the UI to the
     * start/new-chat state. A fresh session is created lazily on the next
     * message.
     */
    resetCurrentSession: () => void;
    renameSession: (sessionId: string, name: string) => void;
    deleteSession: (sessionId: string) => void;
    setOpenSessionTabs: (tabs: string[]) => void;
    /**
     * Toggle the pinned state of a session. Pinning an unknown session id is a
     * no-op; unpinning is always allowed (also used to drop stale ids).
     */
    togglePinSession: (sessionId: string) => void;
    /** @returns `true` when the session is currently pinned. */
    isPinnedSession: (sessionId: string) => boolean;
    getCurrentSession: () => ChatSessionSchema | undefined;
    getSessionRunContext: (sessionId: string) => AiRunContext | undefined;
    setSessionRunContext: (
      sessionId: string,
      runContext: AiRunContext | undefined,
    ) => void;
    getSessionDraftContextItemIds: (sessionId: string) => string[] | undefined;
    setSessionDraftContextItemIds: (
      sessionId: string,
      itemIds: string[] | undefined,
    ) => void;
    setSessionUiMessages: (
      sessionId: string,
      uiMessages: UIMessage[],
    ) => boolean;
    /** Persist a terminal timeout result and force the chat runtime to reload. */
    persistTimedOutSession: (
      sessionId: string,
      uiMessages: UIMessage[],
      timeoutMessage: string,
    ) => void;
    getAnalysisResults: () => AnalysisResultSchema[] | undefined;
    deleteAnalysisResult: (sessionId: string, resultId: string) => void;
    getAssistantMessageParts: (analysisResultId: string) => UIMessage['parts'];
    findToolRenderer: (toolName: string) => ToolRenderer | undefined;
    /**
     * Resolve the API key for the outbound provider. When `provider`/`model`
     * are omitted the current session's provider (or the default) is used;
     * callers targeting a specific provider (e.g. one-shot `sendPrompt`) must
     * pass it so the key matches the endpoint the request is sent to.
     */
    getApiKeyFromSettings: (provider?: string, model?: string) => string;
    /**
     * Resolve the base URL for the outbound provider. See
     * {@link AiSliceState.ai.getApiKeyFromSettings} for the `provider`/`model`
     * override semantics.
     */
    getBaseUrlFromSettings: (
      provider?: string,
      model?: string,
    ) => string | undefined;
    getMaxStepsFromSettings: () => number;
    getFullInstructions: (sessionId?: string) => string;
    getLocalChatTransport: (
      sessionId: string,
    ) => DefaultChatTransport<UIMessage>;
    /** Optional remote endpoint to use for chat; if empty, local transport is used */
    chatEndPoint: string;
    chatHeaders: Record<string, string>;
    getRemoteChatTransport: (
      sessionId: string,
      endpoint: string,
      headers?: Record<string, string>,
    ) => DefaultChatTransport<UIMessage>;
    onChatFinish: (args: {
      sessionId: string;
      messages: UIMessage[];
      isError?: boolean;
    }) => void;
    onChatError: (
      sessionId: string,
      error: unknown,
      messages?: UIMessage[],
    ) => void;
  };
};

/**
 * Configuration options for creating an AI slice.
 *
 * `TTools` is inferred from the `tools` value and constrains `toolRenderers`:
 * - Keys must be present in `tools`
 * - Each renderer's `output` prop is typed to that tool's return type
 *
 * @example
 * ```ts
 * createAiSlice({
 *   tools: {query: createQueryTool(store), chart: createVegaChartTool()},
 *   toolRenderers: {
 *     query: QueryToolResult,        // ToolRenderer<QueryToolOutput>
 *     chart: VegaChartToolResult,    // ToolRenderer<VegaChartToolOutput>
 *     TYPO: SomeRenderer,            // compile error — not a key of tools
 *   },
 * })
 * ```
 */
export interface AiSliceOptions<TTools extends ToolSet = ToolSet> {
  config?: Partial<AiSliceConfig>;
  initialPrompt?: string;
  tools: TTools;
  toolRenderers?: ToolRenderers<TTools>;
  getInstructions: (args?: {
    session?: ChatSessionSchema;
    runContext?: AiRunContext;
  }) => string;
  getRunContext?: (sessionId: string) => AiRunContext | undefined;
  formatRunContextInstructions?: (args: {
    runContext: AiRunContext;
    session?: ChatSessionSchema;
  }) => string;
  defaultProvider?: string;
  defaultModel?: string;
  getAvailableModels?: () => Array<{provider: string; value: string}>;
  /** Provide a pre-configured model client for a provider (e.g., Azure). */
  getCustomModel?: () => LanguageModel | undefined;
  getProviderOptions?: GetProviderOptions;
  maxSteps?: number;
  /**
   * Optional timeout safety limits. All timeouts are disabled unless set.
   * These are runtime behavior and are not persisted in workspace config.
   */
  timeouts?: AiTimeoutOptions;
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string;
  /** Optional remote endpoint to use for chat; if empty, local transport is used */
  chatEndPoint?: string;
  /** Optional headers to send with remote endpoint */
  chatHeaders?: Record<string, string>;
  /**
   * Locally executable tools whose remote definitions omit `execute` and wait
   * for browser-provided output. Used to distinguish hybrid client tools from
   * tools that the remote endpoint executes server-side.
   */
  remoteClientToolNames?: ReadonlyArray<Extract<keyof TTools, string>>;
  /**
   * Called after a non-aborted chat turn has been persisted and fully ended.
   *
   * Host apps can use this to compose AI turns with app-level behavior such as
   * creating a follow-up session from a completed assistant message.
   */
  onChatFinish?: (args: {sessionId: string; messages: UIMessage[]}) => void;
  /** Optional devtools-only capture controls. Defaults are all disabled. */
  devtools?: {
    captureAgentSnapshots?: boolean;
    persistAgentSnapshots?: boolean;
    maxAgentSnapshotBytes?: number;
    captureProviderContexts?: boolean;
    maxProviderContextRecords?: number;
  };
}

/**
 * Caches `getCustomModel` per resolved selection, for the settings it was
 * probed under.
 *
 * `requiresApiKey()` is read from a selector that re-runs once per streamed
 * token, and the apps configuring a factory are exactly the ones with no API
 * key, so no key-based short-circuit covers them. A zero-argument factory can
 * only vary on the selection and on the settings it reads, so those are the
 * cache key. A throwing factory caches as `undefined` ("a key is needed") —
 * this must never throw out of a selector.
 */
function createCustomModelProbe(
  getCustomModel: (() => LanguageModel | undefined) | undefined,
) {
  // Keyed, not single-slot: A -> B -> A must not re-invoke the factory for A.
  const cache = new Map<string, LanguageModel | undefined>();
  let probedSettings: unknown;

  return (selection: ModelSelection, settingsConfig: unknown) => {
    if (!getCustomModel) return undefined;
    // A conditional factory reads the settings — a key entered later, a
    // provider reconfigured — so a new settings object retires every answer.
    // Streaming mutates sessions, not settings, so the per-token case still
    // hits the cache.
    if (settingsConfig !== probedSettings) {
      cache.clear();
      probedSettings = settingsConfig;
    }
    const key = `${selection.modelProvider}\u0000${selection.model}`;
    // `has`, not a truthiness check: `undefined` is a cached answer ("a key is
    // needed"), not a cache miss.
    if (!cache.has(key)) {
      try {
        cache.set(key, getCustomModel());
      } catch {
        cache.set(key, undefined);
      }
    }
    return cache.get(key);
  };
}

export function createAiSlice<TTools extends ToolSet = ToolSet>(
  params: AiSliceOptions<TTools>,
): StateCreator<AiSliceState> {
  const {
    initialPrompt = '',
    tools,
    getApiKey,
    getBaseUrl,
    maxSteps,
    timeouts = {},
    getInstructions,
    defaultProvider = 'openai',
    defaultModel = 'gpt-4.1',
    getAvailableModels,
    getCustomModel,
    getProviderOptions,
    chatEndPoint = '',
    chatHeaders = {},
    remoteClientToolNames = [],
    getRunContext,
    formatRunContextInstructions,
  } = params;
  const devtoolsOptions = {
    captureAgentSnapshots: params.devtools?.captureAgentSnapshots ?? false,
    persistAgentSnapshots: params.devtools?.persistAgentSnapshots ?? false,
    maxAgentSnapshotBytes: params.devtools?.maxAgentSnapshotBytes ?? 64_000,
    captureProviderContexts: params.devtools?.captureProviderContexts ?? false,
    maxProviderContextRecords:
      params.devtools?.maxProviderContextRecords ?? 100,
  };

  return createSlice<AiSliceState>((set, get, store) => {
    const analysisResultsCache = new WeakMap<
      UIMessage[],
      {isRunning: boolean; results: AnalysisResultSchema[]}
    >();

    const cleanedConfig = normalizeAiConfig(params.config);

    /**
     * Extract toolTimings from UIMessage metadata and agentProgress from
     * the session field so the UI can render elapsed times and nested
     * sub-agent trees after reload.
     */
    function rehydrateFromSessions(config: AiSliceConfig) {
      const timings: Record<string, ToolTimingEntry> = {};
      const progress: Record<string, AgentToolCall[]> = {};
      const snapshots: Record<string, AgentSnapshot> = {};

      for (const session of config.sessions) {
        // Restore agentProgress from the session-level field
        if (session.agentProgress) {
          Object.assign(
            progress,
            session.agentProgress as Record<string, AgentToolCall[]>,
          );
        }

        if (session.agentSnapshots) {
          for (const [toolCallId, snapshot] of Object.entries(
            session.agentSnapshots as Record<string, AgentSnapshot>,
          )) {
            const clonedSnapshot = cloneBoundedAgentSnapshot(
              snapshot,
              devtoolsOptions.maxAgentSnapshotBytes,
            );
            if (clonedSnapshot) {
              snapshots[toolCallId] = clonedSnapshot;
            }
          }
        }

        // Restore toolTimings from assistant message metadata
        const msgs = (session.uiMessages ?? []) as UIMessage[];
        for (const msg of msgs) {
          if (msg.role !== 'assistant') continue;
          const meta = msg.metadata as AssistantMessageMetadata | undefined;
          if (meta?.toolTimings) {
            Object.assign(timings, meta.toolTimings);
          }
        }
      }

      return {timings, progress, snapshots};
    }

    // Create persistent Maps (outside of immer draft)
    const toolCallToSessionId = new Map<string, string>();
    const sessionAbortControllers = new Map<string, AbortController>();
    const sessionRunTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    type SessionChatRuntime = ReturnType<typeof createSessionChatRuntime>;
    const sessionChatRuntimes = new Map<
      string,
      {version: string; token: object; runtime: SessionChatRuntime}
    >();
    const pendingApprovalResolvers = new Map<
      string,
      (approved: boolean) => void
    >();
    const abortSnapshotMap = new Map<string, AgentProgressSnapshot>();

    const disposeSessionChatRuntime = (sessionId: string) => {
      const runtime = sessionChatRuntimes.get(sessionId)?.runtime;
      sessionChatRuntimes.delete(sessionId);
      runtime?.dispose();
    };

    const disposeAllSessionChatRuntimes = () => {
      const runtimes = [...sessionChatRuntimes.values()];
      sessionChatRuntimes.clear();
      for (const {runtime} of runtimes) runtime.dispose();
    };

    const clearSessionRuntimeResources = () => {
      disposeAllSessionChatRuntimes();
      for (const controller of sessionAbortControllers.values()) {
        controller.abort(ANALYSIS_CANCELLED);
      }
      sessionAbortControllers.clear();
      for (const timeoutId of sessionRunTimeouts.values()) {
        clearTimeout(timeoutId);
      }
      sessionRunTimeouts.clear();
      for (const resolve of pendingApprovalResolvers.values()) resolve(false);
      pendingApprovalResolvers.clear();
      abortSnapshotMap.clear();
      toolCallToSessionId.clear();
    };

    const getOrCreateSessionChatRuntime = (
      sessionId: string,
    ): SessionChatRuntime | undefined => {
      const session = get().ai.config.sessions.find(
        (candidate) => candidate.id === sessionId,
      );
      if (!session) return undefined;

      const version = String(session.messagesRevision ?? 0);
      const existing = sessionChatRuntimes.get(sessionId);
      if (existing?.version === version) return existing.runtime;

      disposeSessionChatRuntime(sessionId);
      const token = {};
      const isCurrent = () =>
        sessionChatRuntimes.get(sessionId)?.token === token;
      const release = () => {
        if (isCurrent()) sessionChatRuntimes.delete(sessionId);
      };

      const trimmedEndpoint = chatEndPoint.trim();
      const usesRemoteTransport = trimmedEndpoint.length > 0;
      const transport = usesRemoteTransport
        ? get().ai.getRemoteChatTransport(
            sessionId,
            trimmedEndpoint,
            chatHeaders,
          )
        : get().ai.getLocalChatTransport(sessionId);
      const chat = new Chat<UIMessage>({
        id: `${sessionId}::${version}`,
        transport,
        messages: fixIncompleteToolCalls(
          (session.uiMessages ?? []) as UIMessage[],
        ),
        sendAutomaticallyWhen: (options) => {
          const controller = get().ai.getAbortController(sessionId);
          if (controller?.signal.aborted) return false;
          return (
            lastAssistantMessageIsCompleteWithToolCalls(options) ||
            lastAssistantMessageIsCompleteWithApprovalResponses(options)
          );
        },
        onFinish: ({messages}) => {
          if (!isCurrent()) return;
          get().ai.onChatFinish({sessionId, messages});
          if (isCurrent()) {
            getOrCreateSessionChatRuntime(sessionId);
          }
        },
        onError: (error) => {
          if (!isCurrent()) return;
          get().ai.onChatError(sessionId, error, chat.messages);
          if (isCurrent()) {
            getOrCreateSessionChatRuntime(sessionId);
          }
        },
      });

      const runtime = createSessionChatRuntime({
        chat,
        usesRemoteTransport,
        getState: () => {
          const state = get().ai;
          return {
            isRunning: state.getIsRunning(sessionId),
            abortController: state.getAbortController(sessionId),
            tools: state.tools,
            remoteClientToolNames: state.remoteClientToolNames,
            timeouts: state.timeouts,
            agentProgress: state.agentProgress,
            pendingSubAgentApprovals: state.pendingSubAgentApprovals,
          };
        },
        subscribeToStateChanges: (onChange) =>
          store.subscribe(() => onChange()),
        onMessagesChange: (messages) => {
          if (!isCurrent()) return;
          get().ai.setSessionUiMessages(sessionId, messages);
        },
        onIdleTimeout: (messages, error) => {
          get().ai.persistTimedOutSession(sessionId, messages, error.message);
        },
        onDeactivate: release,
      });
      sessionChatRuntimes.set(sessionId, {version, token, runtime});
      return runtime;
    };

    const getResolvedModelSelection = (
      candidateProvider?: string,
      candidateModel?: string,
    ): ModelSelection => {
      const availableModels = getAvailableModels?.() ?? [];
      const modelIsAvailable = (
        provider: string | undefined,
        model: string | undefined,
      ) =>
        Boolean(
          provider &&
          model &&
          (availableModels.length === 0 ||
            availableModels.some(
              (candidate) =>
                candidate.provider === provider && candidate.value === model,
            )),
        );

      if (modelIsAvailable(candidateProvider, candidateModel)) {
        return {modelProvider: candidateProvider!, model: candidateModel!};
      }

      // A provider-only request is authoritative even when it omits the model.
      // Select that provider's first available model instead of silently
      // reverting to the default provider/model pair.
      if (candidateProvider) {
        const firstProviderModel = availableModels.find(
          (candidate) => candidate.provider === candidateProvider,
        );
        if (firstProviderModel) {
          return {
            modelProvider: firstProviderModel.provider,
            model: firstProviderModel.value,
          };
        }
      }

      if (modelIsAvailable(defaultProvider, defaultModel)) {
        return {modelProvider: defaultProvider, model: defaultModel};
      }

      const firstAvailableModel = availableModels[0];
      if (firstAvailableModel) {
        return {
          modelProvider: firstAvailableModel.provider,
          model: firstAvailableModel.value,
        };
      }

      return {modelProvider: defaultProvider, model: defaultModel};
    };

    // Initialize base config and ensure the initial session respects default provider/model
    const baseConfig = cleanupSessionForks(
      createDefaultAiConfig(cleanedConfig),
    );
    if (!cleanedConfig?.sessions || cleanedConfig.sessions.length === 0) {
      const firstSession = baseConfig.sessions[0];
      if (firstSession) {
        firstSession.modelProvider = defaultProvider;
        firstSession.model = defaultModel;
        firstSession.prompt = initialPrompt;
        firstSession.isRunning = false;
      }
    }

    // Clean up openSessionTabs for sessions that no longer exist and ensure it's initialized
    const sessionIdSet = new Set(baseConfig.sessions.map((s) => s.id));
    if (
      !baseConfig.currentSessionId ||
      !sessionIdSet.has(baseConfig.currentSessionId)
    ) {
      baseConfig.currentSessionId = baseConfig.sessions[0]?.id;
    }
    if (baseConfig.openSessionTabs && baseConfig.openSessionTabs.length > 0) {
      baseConfig.openSessionTabs = baseConfig.openSessionTabs.filter((id) =>
        sessionIdSet.has(id),
      );
    }
    if (
      baseConfig.currentSessionId &&
      !baseConfig.openSessionTabs?.includes(baseConfig.currentSessionId)
    ) {
      baseConfig.openSessionTabs = [
        baseConfig.currentSessionId,
        ...(baseConfig.openSessionTabs ?? []),
      ];
    }
    // Ensure openSessionTabs is initialized with current session if empty/missing
    if (
      !baseConfig.openSessionTabs ||
      baseConfig.openSessionTabs.length === 0
    ) {
      baseConfig.openSessionTabs = baseConfig.currentSessionId
        ? [baseConfig.currentSessionId]
        : [];
    }

    // Rehydrate toolTimings and agentProgress from persisted messages
    const initialRehydrated = rehydrateFromSessions(baseConfig);

    const customModelProbe = createCustomModelProbe(getCustomModel);

    return {
      ai: {
        initialize: async () => {
          registerCommandsForOwner(store, AI_COMMAND_OWNER, createAiCommands());

          // Recompute derived runtime state after persist hydration.
          const rehydrated = rehydrateFromSessions(get().ai.config);
          set((state) =>
            produce(state, (draft) => {
              draft.ai.toolTimings = rehydrated.timings;
              draft.ai.agentProgress = rehydrated.progress;
              draft.ai.devtools.agentSnapshots = rehydrated.snapshots;
            }),
          );
        },
        destroy: async () => {
          unregisterCommandsForOwner(store, AI_COMMAND_OWNER);
          clearSessionRuntimeResources();
        },
        config: baseConfig,
        promptSuggestionsVisible: true,
        draftPrompt: baseConfig.sessions.length === 0 ? initialPrompt : '',
        apiKeyErrors: {},
        tools,
        toolRenderers: params.toolRenderers ?? {},
        remoteClientToolNames: [...remoteClientToolNames],
        timeouts,
        getProviderOptions,

        setToolCallSession: (
          toolCallId: string,
          sessionId: string | undefined,
        ) => {
          if (!toolCallId) return;
          if (sessionId) {
            toolCallToSessionId.set(toolCallId, sessionId);
          } else {
            toolCallToSessionId.delete(toolCallId);
          }
        },
        getToolCallSession: (toolCallId: string) => {
          if (!toolCallId) return undefined;
          return toolCallToSessionId.get(toolCallId);
        },

        agentProgress: initialRehydrated.progress,
        updateAgentProgress: (
          parentToolCallId: string,
          toolCalls: AgentToolCall[],
        ) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.agentProgress[parentToolCallId] = toolCalls;
            }),
          );
        },
        clearAgentProgress: (parentToolCallId: string) => {
          set((state) =>
            produce(state, (draft) => {
              delete draft.ai.agentProgress[parentToolCallId];
            }),
          );
        },
        devtools: {
          agentSnapshots: initialRehydrated.snapshots,
          shouldCaptureAgentSnapshots: () =>
            devtoolsOptions.captureAgentSnapshots,
          shouldPersistAgentSnapshots: () =>
            devtoolsOptions.persistAgentSnapshots,
          writeAgentSnapshot: (
            parentToolCallId: string,
            snapshot: AgentSnapshot,
          ) => {
            if (!devtoolsOptions.captureAgentSnapshots) return;
            const clonedSnapshot = cloneBoundedAgentSnapshot(
              snapshot,
              devtoolsOptions.maxAgentSnapshotBytes,
            );
            if (!clonedSnapshot) return;

            set((state) =>
              produce(state, (draft) => {
                draft.ai.devtools.agentSnapshots[parentToolCallId] =
                  clonedSnapshot;
              }),
            );
          },
          clearAgentSnapshots: () => {
            set((state) =>
              produce(state, (draft) => {
                draft.ai.devtools.agentSnapshots = {};
              }),
            );
          },
          providerContexts: [],
          shouldCaptureProviderContexts: () =>
            devtoolsOptions.captureProviderContexts,
          measureProviderContext: async (input) => {
            if (!devtoolsOptions.captureProviderContexts) return undefined;
            const diagnostic = await tryMeasureProviderContext(input);
            if (!diagnostic) return undefined;
            get().ai.devtools.writeProviderContext(diagnostic);
            return diagnostic.id;
          },
          writeProviderContext: (diagnostic: ProviderContextDiagnostic) => {
            if (!devtoolsOptions.captureProviderContexts) return;
            set((state) =>
              produce(state, (draft) => {
                draft.ai.devtools.providerContexts.push(diagnostic);
                const overflow =
                  draft.ai.devtools.providerContexts.length -
                  devtoolsOptions.maxProviderContextRecords;
                if (overflow > 0) {
                  draft.ai.devtools.providerContexts.splice(0, overflow);
                }
              }),
            );
          },
          setProviderContextInputTokens: (id: string, inputTokens: number) => {
            if (!devtoolsOptions.captureProviderContexts) return;
            set((state) =>
              produce(state, (draft) => {
                const diagnostic = draft.ai.devtools.providerContexts.find(
                  (entry) => entry.id === id,
                );
                if (diagnostic) diagnostic.inputTokens = inputTokens;
              }),
            );
          },
          mergeLatestProviderContextMetrics: (
            role: string,
            metrics: Record<string, number>,
            sessionId?: string,
          ) => {
            if (!devtoolsOptions.captureProviderContexts) return;
            set((state) =>
              produce(state, (draft) => {
                mergeLatestProviderContextMetricsForSession(
                  draft.ai.devtools.providerContexts,
                  role,
                  metrics,
                  sessionId,
                );
              }),
            );
          },
          clearProviderContexts: () => {
            set((state) =>
              produce(state, (draft) => {
                draft.ai.devtools.providerContexts = [];
              }),
            );
          },
        },

        pendingSubAgentApprovals: {},
        requestSubAgentApproval: (approval: PendingSubAgentApproval) => {
          set((state) =>
            produce(state, (draft) => {
              // Store only serializable fields in state (not the resolve callback)
              draft.ai.pendingSubAgentApprovals[approval.approvalId] = {
                toolCallId: approval.toolCallId,
                approvalId: approval.approvalId,
                toolName: approval.toolName,
                input: approval.input,
                resolve: approval.resolve,
              } as PendingSubAgentApproval;
            }),
          );
          // Store the resolve callback outside of immer (not serializable)
          pendingApprovalResolvers.set(approval.approvalId, approval.resolve);
        },
        resolveSubAgentApproval: (approvalId: string, approved: boolean) => {
          const resolver = pendingApprovalResolvers.get(approvalId);
          if (resolver) {
            resolver(approved);
            pendingApprovalResolvers.delete(approvalId);
          }
          set((state) =>
            produce(state, (draft) => {
              delete draft.ai.pendingSubAgentApprovals[approvalId];
            }),
          );
        },
        clearSubAgentApproval: (approvalId: string) => {
          pendingApprovalResolvers.delete(approvalId);
          set((state) =>
            produce(state, (draft) => {
              delete draft.ai.pendingSubAgentApprovals[approvalId];
            }),
          );
        },

        writeAbortSnapshot: (
          toolCallId: string,
          snapshot: AgentProgressSnapshot,
        ) => {
          abortSnapshotMap.set(toolCallId, snapshot);
        },
        readAbortSnapshot: (toolCallId: string) => {
          return abortSnapshotMap.get(toolCallId);
        },
        clearAbortSnapshots: () => {
          abortSnapshotMap.clear();
        },

        isSummarizing: false,
        setIsSummarizing: (value: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.isSummarizing = value;
            }),
          );
        },

        toolTimings: initialRehydrated.timings,
        setToolTiming: (toolCallId: string, entry: ToolTimingEntry) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.toolTimings[toolCallId] = entry;
            }),
          );
        },
        getToolTimings: () => {
          return get().ai.toolTimings;
        },

        getAbortController: (sessionId: string) => {
          return sessionAbortControllers.get(sessionId);
        },
        setAbortController: (
          sessionId: string,
          controller: AbortController | undefined,
        ) => {
          const timeoutId = sessionRunTimeouts.get(sessionId);
          if (timeoutId) clearTimeout(timeoutId);
          sessionRunTimeouts.delete(sessionId);
          if (controller) {
            sessionAbortControllers.set(sessionId, controller);
          } else {
            sessionAbortControllers.delete(sessionId);
          }
        },

        getSessionChat: (sessionId) =>
          getOrCreateSessionChatRuntime(sessionId)?.chat,

        setConfig: (config: AiSliceConfig) => {
          clearSessionRuntimeResources();
          const normalizedConfig = cleanupSessionForks(
            normalizeAiConfig(config),
          );
          const rehydrated = rehydrateFromSessions(normalizedConfig);

          set((state) =>
            produce(state, (draft) => {
              draft.ai.config = normalizedConfig;
              draft.ai.toolTimings = rehydrated.timings;
              draft.ai.agentProgress = rehydrated.progress;
              draft.ai.devtools.agentSnapshots = rehydrated.snapshots;
            }),
          );
        },

        setPromptSuggestionsVisible: (visible: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.promptSuggestionsVisible = visible;
            }),
          );
        },

        setDraftPrompt: (prompt: string) => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.draftPrompt = prompt;
            }),
          );
        },

        setApiKeyError: (provider: string, hasError: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              if (hasError) {
                draft.ai.apiKeyErrors[provider] = true;
              } else {
                delete draft.ai.apiKeyErrors[provider];
              }
            }),
          );
        },

        hasApiKeyError: () => {
          const state = get();
          const currentSession = state.ai.getCurrentSession();
          const provider = currentSession?.modelProvider || defaultProvider;
          return Boolean(state.ai.apiKeyErrors[provider]);
        },

        setPrompt: (sessionId: string, prompt: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.prompt = prompt;
              }
            }),
          );
        },
        getPrompt: (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: ChatSessionSchema) => s.id === sessionId,
          );
          return session?.prompt || '';
        },

        setIsRunning: (sessionId: string, isRunning: boolean) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.isRunning = isRunning;
              }
            }),
          );
        },
        getIsRunning: (sessionId: string) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: ChatSessionSchema) => s.id === sessionId,
          );
          return session?.isRunning || false;
        },

        /**
         * Set the AI model for the current session
         * @param model - The model to set
         */
        setAiModel: (modelProvider: string, model: string) => {
          set((state) =>
            produce(state, (draft) => {
              const currentSession = getCurrentSessionFromState(draft);
              if (currentSession) {
                currentSession.modelProvider = modelProvider;
                currentSession.model = model;
              }
            }),
          );
        },

        getSelectedModel: () => {
          const currentSession = get().ai.getCurrentSession();
          return getResolvedModelSelection(
            currentSession?.modelProvider,
            currentSession?.model,
          );
        },

        hasResolvableModel: () => {
          // A configured custom-model factory is authoritative and is never
          // invoked here — only its presence is checked.
          if (typeof getCustomModel === 'function') {
            return true;
          }

          const state = get();
          const currentSession = state.ai.getCurrentSession();
          // No session yet: a lazily created session will use the resolved
          // default provider/model, so a model is available.
          if (!currentSession) {
            return true;
          }

          if (hasAiSettingsConfig(state)) {
            return isModelInSettings(
              state.aiSettings.config,
              currentSession.modelProvider,
              currentSession.model,
            );
          }

          return Boolean(currentSession.modelProvider && currentSession.model);
        },

        requiresApiKey: () => {
          // A remote chat endpoint sends requests server-side, so the browser
          // never holds a provider key regardless of how the model resolves.
          if (chatEndPoint.trim().length > 0) return false;
          if (typeof getCustomModel !== 'function') return true;
          const state = get();
          return (
            customModelProbe(
              state.ai.getSelectedModel(),
              hasAiSettingsConfig(state) ? state.aiSettings.config : undefined,
            ) === undefined
          );
        },

        /**
         * Get the current active session
         */
        getCurrentSession: () => {
          const state = get();
          const {currentSessionId, sessions} = state.ai.config;
          return sessions.find((session) => session.id === currentSessionId);
        },

        getSessionRunContext: (sessionId: string) => {
          const state = get();
          return state.ai.config.sessions.find(
            (session: ChatSessionSchema) => session.id === sessionId,
          )?.runContext;
        },

        setSessionRunContext: (
          sessionId: string,
          runContext: AiRunContext | undefined,
        ) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.runContext = runContext;
              }
            }),
          );
        },
        getSessionDraftContextItemIds: (sessionId: string) => {
          const state = get();
          return state.ai.config.sessions.find(
            (session: ChatSessionSchema) => session.id === sessionId,
          )?.draftContextItemIds;
        },
        setSessionDraftContextItemIds: (
          sessionId: string,
          itemIds: string[] | undefined,
        ) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.draftContextItemIds = itemIds
                  ? Array.from(new Set(itemIds))
                  : undefined;
              }
            }),
          );
        },

        /**
         * Create a new session with the given name and model settings
         */
        createSession: (
          name?: string,
          modelProvider?: string,
          model?: string,
        ) => {
          const currentSession = get().ai.getCurrentSession();
          const firstSessionPrompt = currentSession ? '' : get().ai.draftPrompt;
          const modelSelection = getResolvedModelSelection(
            modelProvider ?? currentSession?.modelProvider,
            model ??
              (modelProvider === undefined ? currentSession?.model : undefined),
          );
          const newSessionId = createId();

          // Generate a unique name if none is provided
          let sessionName = name;
          if (!sessionName) {
            const existingNames = get().ai.config.sessions.map(
              (s: ChatSessionSchema) => s.name,
            );
            sessionName = generateUniqueName('Chat', existingNames, ' ');
          }

          set((state) =>
            produce(state, (draft) => {
              const now = Date.now();
              // Add to AI sessions with per-session state
              draft.ai.config.sessions.unshift({
                id: newSessionId,
                name: sessionName,
                modelProvider: modelSelection.modelProvider,
                model: modelSelection.model,
                createdAt: new Date(),
                uiMessages: [],
                messagesRevision: 0,
                prompt: firstSessionPrompt,
                draftContextItemIds: undefined,
                isRunning: false,
                lastOpenedAt: now,
              });
              draft.ai.config.currentSessionId = newSessionId;
              draft.ai.draftPrompt = '';
              // Add new session to open tabs
              if (!draft.ai.config.openSessionTabs) {
                draft.ai.config.openSessionTabs = [];
              }
              draft.ai.config.openSessionTabs.push(newSessionId);
            }),
          );
          return newSessionId;
        },

        forkSessionFromMessage: (args) => {
          const sourceSession = get().ai.config.sessions.find(
            (session: ChatSessionSchema) => session.id === args.sourceSessionId,
          );
          if (!sourceSession) return undefined;

          const now = Date.now();
          const targetSessionId = createId();
          const fork = createForkedChatSessionFromMessage({
            sourceSession,
            args,
            targetSessionId,
            now,
          });
          if (!fork) return undefined;

          set((state) =>
            produce(state, (draft) => {
              draft.ai.config.sessions.unshift(fork.forkedSession);
              draft.ai.config.currentSessionId = targetSessionId;
              if (!draft.ai.config.openSessionTabs) {
                draft.ai.config.openSessionTabs = [];
              }
              draft.ai.config.openSessionTabs.push(targetSessionId);
              draft.ai.config.sessionForks[targetSessionId] = fork.forkOrigin;
            }),
          );

          return targetSessionId;
        },

        getSessionForkOrigin: (sessionId) =>
          get().ai.config.sessionForks[sessionId],

        /**
         * Switch to a different session
         */
        switchSession: (sessionId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const now = Date.now();
              draft.ai.config.currentSessionId = sessionId;
              // Ensure current session is always in openSessionTabs
              if (!draft.ai.config.openSessionTabs) {
                draft.ai.config.openSessionTabs = [];
              }
              if (!draft.ai.config.openSessionTabs.includes(sessionId)) {
                draft.ai.config.openSessionTabs.push(sessionId);
              }
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.lastOpenedAt = now;
              }
            }),
          );
        },

        /**
         * Reset the current session (set currentSessionId to undefined)
         */
        resetCurrentSession: () => {
          set((state) =>
            produce(state, (draft) => {
              draft.ai.config.currentSessionId = undefined;
            }),
          );
        },

        /**
         * Set the list of open session tab IDs
         */
        setOpenSessionTabs: (tabs: string[]) => {
          set((state) =>
            produce(state, (draft) => {
              // Filter out any tabs for sessions that no longer exist
              const sessionIdSet = new Set(
                draft.ai.config.sessions.map((s) => s.id),
              );
              draft.ai.config.openSessionTabs = tabs.filter((id) =>
                sessionIdSet.has(id),
              );
            }),
          );
        },

        /**
         * Rename an existing session
         */
        renameSession: (sessionId: string, name: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.name = name;
              }
            }),
          );
        },

        /**
         * Delete a session and clean up its resources
         */
        deleteSession: (sessionId: string) => {
          // Clean up per-session state
          const abortController = sessionAbortControllers.get(sessionId);
          if (abortController) {
            abortController.abort(SESSION_DELETED);
          }
          sessionAbortControllers.delete(sessionId);
          const runTimeoutId = sessionRunTimeouts.get(sessionId);
          if (runTimeoutId) clearTimeout(runTimeoutId);
          sessionRunTimeouts.delete(sessionId);
          disposeSessionChatRuntime(sessionId);
          const now = Date.now();

          set((state) =>
            produce(state, (draft) => {
              const sessionIndex = draft.ai.config.sessions.findIndex(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (sessionIndex !== -1) {
                draft.ai.config.sessions.splice(sessionIndex, 1);
                delete draft.ai.config.sessionForks[sessionId];
                if (draft.ai.config.pinnedSessionIds) {
                  draft.ai.config.pinnedSessionIds =
                    draft.ai.config.pinnedSessionIds.filter(
                      (id) => id !== sessionId,
                    );
                }
                if (draft.ai.config.openSessionTabs) {
                  draft.ai.config.openSessionTabs =
                    draft.ai.config.openSessionTabs.filter(
                      (id) => id !== sessionId,
                    );
                }
                if (draft.ai.config.currentSessionId === sessionId) {
                  const firstSession = draft.ai.config.sessions[0];
                  if (firstSession) {
                    draft.ai.config.currentSessionId = firstSession.id;
                    firstSession.lastOpenedAt = now;
                    if (
                      !draft.ai.config.openSessionTabs?.includes(
                        firstSession.id,
                      )
                    ) {
                      draft.ai.config.openSessionTabs = [
                        ...(draft.ai.config.openSessionTabs ?? []),
                        firstSession.id,
                      ];
                    }
                  } else {
                    draft.ai.config.currentSessionId = undefined;
                    draft.ai.config.openSessionTabs = [];
                  }
                }
              }
            }),
          );
        },

        /**
         * Toggle pin status for a session
         */
        togglePinSession: (sessionId: string) => {
          set((state) =>
            produce(state, (draft) => {
              if (!draft.ai.config.pinnedSessionIds) {
                draft.ai.config.pinnedSessionIds = [];
              }
              const index = draft.ai.config.pinnedSessionIds.indexOf(sessionId);
              if (index === -1) {
                // Only pin sessions that exist; ignore unknown ids so stale
                // references are not persisted.
                const sessionExists = draft.ai.config.sessions.some(
                  (s: ChatSessionSchema) => s.id === sessionId,
                );
                if (sessionExists) {
                  draft.ai.config.pinnedSessionIds.push(sessionId);
                }
              } else {
                draft.ai.config.pinnedSessionIds.splice(index, 1);
              }
            }),
          );
        },

        /**
         * Check if a session is pinned
         */
        isPinnedSession: (sessionId: string) => {
          const pinnedIds = get().ai.config.pinnedSessionIds ?? [];
          return pinnedIds.includes(sessionId);
        },

        /**
         * Save the Ai SDK UI messages for a session
         */
        setSessionUiMessages: (
          sessionId: string,
          uiMessages: UIMessage[],
        ): boolean => {
          let updated = false;
          try {
            set((state) =>
              produce(state, (draft) => {
                const session = draft.ai.config.sessions.find(
                  (s: ChatSessionSchema) => s.id === sessionId,
                );
                if (session) {
                  const existingMessages = (session.uiMessages ??
                    []) as UIMessage[];
                  const incomingHasError =
                    uiMessagesHaveChatRequestError(uiMessages);
                  const existingHasError =
                    uiMessagesHaveChatRequestError(existingMessages);
                  const staleSyncWouldEraseError =
                    existingHasError &&
                    !incomingHasError &&
                    uiMessages.length <= existingMessages.length;

                  if (staleSyncWouldEraseError) {
                    return;
                  }

                  session.uiMessages = structuredClone(
                    uiMessages,
                  ) as typeof session.uiMessages;
                  updated = true;
                }
              }),
            );
            return updated;
          } catch (error) {
            console.error(
              'Failed to persist UI messages:',
              error instanceof Error ? error.message : error,
            );
            return false;
          }
        },

        persistTimedOutSession: (
          sessionId: string,
          uiMessages: UIMessage[],
          timeoutMessage: string,
        ) => {
          const completedMessages = fixIncompleteToolCalls(
            structuredClone(uiMessages),
            timeoutMessage,
            {completeApprovalRequests: true},
          );
          const lastUserMessage = completedMessages
            .filter((message) => message.role === 'user')
            .at(-1);
          if (lastUserMessage) {
            setChatRequestErrorMessage(lastUserMessage, {
              error: timeoutMessage,
            });
          }

          const currentState = get();
          writeToolTimingsToMetadata(
            completedMessages,
            currentState.ai.getToolTimings(),
          );
          const timedOutAgentState = getTimedOutSessionAgentState(
            completedMessages,
            currentState.ai.agentProgress,
            currentState.ai.pendingSubAgentApprovals,
            timeoutMessage,
          );

          for (const approvalId of timedOutAgentState.approvalIds) {
            pendingApprovalResolvers.get(approvalId)?.(false);
            pendingApprovalResolvers.delete(approvalId);
          }

          const stateForPersistence = {
            ...currentState,
            ai: {
              ...currentState.ai,
              agentProgress: timedOutAgentState.agentProgress,
            },
          };

          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (candidate) => candidate.id === sessionId,
              );
              if (!session) return;
              session.uiMessages =
                completedMessages as ChatSessionSchema['uiMessages'];
              for (const [parentToolCallId, toolCalls] of Object.entries(
                timedOutAgentState.agentProgress,
              )) {
                draft.ai.agentProgress[parentToolCallId] = toolCalls;
              }
              for (const approvalId of timedOutAgentState.approvalIds) {
                delete draft.ai.pendingSubAgentApprovals[approvalId];
              }
              writeAgentDebugStateToSession(session, stateForPersistence);
              session.messagesRevision = (session.messagesRevision || 0) + 1;
              session.isRunning = false;
            }),
          );
        },

        findToolRenderer: (toolName: string) => {
          return get().ai.toolRenderers[toolName];
        },

        getBaseUrlFromSettings: (providerOverride, modelOverride) => {
          // First try the getBaseUrl function if provided
          const baseUrlFromFunction = getBaseUrl?.();
          if (baseUrlFromFunction) {
            return baseUrlFromFunction;
          }

          // Fall back to settings. Resolve the same provider/model a newly
          // created session would use when no current session exists.
          const store = get();
          if (hasAiSettingsConfig(store)) {
            const currentSession = getCurrentSessionFromState(store);
            const selection = getResolvedModelSelection(
              providerOverride ?? currentSession?.modelProvider,
              modelOverride ?? currentSession?.model,
            );
            const provider = providerOverride ?? selection.modelProvider;
            const model = modelOverride ?? selection.model;
            if (provider === 'custom') {
              const customModel = store.aiSettings.config.customModels.find(
                (m: {modelName: string}) => m.modelName === model,
              );
              return customModel?.baseUrl;
            }
            return store.aiSettings.config.providers[provider]?.baseUrl;
          }
          return undefined;
        },

        getApiKeyFromSettings: (providerOverride, modelOverride) => {
          const store = get();
          const currentSession = getCurrentSessionFromState(store);
          const selection = getResolvedModelSelection(
            providerOverride ?? currentSession?.modelProvider,
            modelOverride ?? currentSession?.model,
          );
          // Explicit provider overrides remain authoritative for one-shot
          // calls, while the model falls back to the resolved session default.
          const provider = providerOverride ?? selection.modelProvider;
          const model = modelOverride ?? selection.model;

          // First try the getApiKey function if provided. This must not depend
          // on a current chat session: chat-free flows (e.g. in-place block
          // edits) resolve a key without ever selecting a session.
          const apiKeyFromFunction = getApiKey?.(provider);
          if (apiKeyFromFunction) {
            return apiKeyFromFunction;
          }

          // Fall back to settings for the resolved provider. With lazy session
          // creation the key may be read before any session exists (e.g. the
          // composer's inline API-key prompt); the default provider is used then
          // so users who already saved a key are not asked to re-enter it.
          if (hasAiSettingsConfig(store)) {
            if (provider === 'custom') {
              const customModel = store.aiSettings.config.customModels.find(
                (m: {modelName: string}) => m.modelName === model,
              );
              return customModel?.apiKey || '';
            } else {
              return (
                store.aiSettings.config.providers?.[provider]?.apiKey || ''
              );
            }
          }
          return '';
        },

        getMaxStepsFromSettings: () => {
          const store = get();
          // First try the maxSteps parameter if provided
          if (maxSteps && Number.isFinite(maxSteps) && maxSteps > 0) {
            return maxSteps;
          }

          // Fall back to settings
          if (hasAiSettingsConfig(store)) {
            const settingsMaxSteps =
              store.aiSettings.config.modelParameters.maxSteps;
            if (Number.isFinite(settingsMaxSteps) && settingsMaxSteps > 0) {
              return settingsMaxSteps;
            }
          }
          return 50;
        },

        getFullInstructions: (sessionId?: string) => {
          const store = get();
          const session = sessionId
            ? store.ai.config.sessions.find(
                (candidate: ChatSessionSchema) => candidate.id === sessionId,
              )
            : getCurrentSessionFromState(store);
          const runContext = session?.runContext;

          let instructions = getInstructions({session, runContext});

          if (runContext && formatRunContextInstructions) {
            const contextInstructions = formatRunContextInstructions({
              runContext,
              session,
            });
            if (contextInstructions.trim().length > 0) {
              instructions = `${instructions}\n\n${contextInstructions}`;
            }
          }

          // Fall back to settings
          if (hasAiSettingsConfig(store)) {
            // get additional instructions from settings
            const {additionalInstruction} =
              store.aiSettings.config.modelParameters;
            if (additionalInstruction) {
              instructions = `${instructions}\n\nAdditional Instructions:\n\n${additionalInstruction}`;
            }
          }
          return instructions;
        },

        sendPrompt: async (
          prompt: string,
          options: {
            systemInstructions?: string;
            modelProvider?: string;
            modelName?: string;
            baseUrl?: string;
            useTools?: boolean;
            role?: string;
            contextSources?: string[];
            contextMetrics?: Record<string, number>;
            sessionId?: string;
            abortSignal?: AbortSignal;
          } = {},
        ) => {
          // One-shot generateText path with explicit abort lifecycle management
          const state = get();
          const currentSession = state.ai.getCurrentSession(); // only used when no model provider is provided
          const {
            systemInstructions,
            modelProvider,
            modelName,
            baseUrl,
            abortSignal,
            useTools = false,
            role = 'one-shot-helper',
            contextSources = [
              'explicit-prompt',
              'resolved-system-instructions',
            ],
            contextMetrics,
            sessionId,
          } = options;

          if (abortSignal?.aborted) {
            throw new ToolAbortError(TOOL_CALL_CANCELLED);
          }

          const selectedModel = state.ai.getSelectedModel();
          const provider =
            modelProvider ??
            currentSession?.modelProvider ??
            selectedModel.modelProvider;
          const modelId =
            modelName ?? currentSession?.model ?? selectedModel.model;
          // Resolve the key/base URL for the SAME provider the request targets,
          // so an explicit provider/base URL never receives another provider's
          // credential.
          const baseURL =
            baseUrl ?? state.ai.getBaseUrlFromSettings(provider, modelId) ?? '';
          const tools = state.ai.tools;

          const toolsWithoutExecute = Object.fromEntries(
            Object.entries(tools).filter(([, tool]) => !tool.execute),
          );

          const model = createOpenAICompatible({
            apiKey: state.ai.getApiKeyFromSettings(provider, modelId),
            name: provider,
            baseURL,
            includeUsage: true,
          }).chatModel(modelId);

          const diagnosticsByStep: string[] = [];
          let completedStep = 0;
          const resolvedInstructions =
            systemInstructions ||
            state.ai.getFullInstructions(currentSession?.id);

          try {
            const response = await generateText({
              model,
              messages: [{role: 'user', content: prompt}],
              system: resolvedInstructions,
              abortSignal: abortSignal,
              ...(useTools ? {tools: toolsWithoutExecute as ToolSet} : {}),
              prepareStep: async ({stepNumber, messages}) => {
                if (!state.ai.devtools.shouldCaptureProviderContexts()) {
                  return undefined;
                }
                const diagnostic = await tryMeasureProviderContext({
                  role,
                  provider,
                  model: modelId,
                  sessionId: sessionId ?? currentSession?.id,
                  step: stepNumber,
                  instructions: resolvedInstructions,
                  messages,
                  tools: useTools
                    ? (toolsWithoutExecute as ToolSet)
                    : undefined,
                  sources: contextSources,
                  preparationMetrics: contextMetrics,
                });
                if (!diagnostic) return undefined;
                diagnosticsByStep[stepNumber] = diagnostic.id;
                state.ai.devtools.writeProviderContext(diagnostic);
                return undefined;
              },
              onStepFinish: ({usage}) => {
                const diagnosticId = diagnosticsByStep[completedStep++];
                if (diagnosticId && usage.inputTokens != null) {
                  state.ai.devtools.setProviderContextInputTokens(
                    diagnosticId,
                    usage.inputTokens,
                  );
                }
              },
            });
            return response.text;
          } catch (error) {
            const errorName =
              typeof error === 'object' && error && 'name' in error
                ? String((error as {name?: unknown}).name)
                : '';
            if (abortSignal?.aborted || errorName === 'AbortError') {
              throw new ToolAbortError(TOOL_CALL_CANCELLED);
            }
            console.error('Error generating text:', error);
            return 'error: can not generate response';
          }
        },

        /**
         * Start the analysis for a specific session
         */
        startAnalysis: async (
          sessionId: string,
          attachments: FileUIPart[] = [],
        ) => {
          const state = get();
          const session = state.ai.config.sessions.find(
            (s: ChatSessionSchema) => s.id === sessionId,
          );

          if (!session) {
            console.error('Session not found:', sessionId);
            return;
          }

          const chat = state.ai.getSessionChat(sessionId);
          if (!chat) {
            console.error('Failed to create session chat:', sessionId);
            return;
          }

          const abortController = new AbortController();
          const promptText = session.prompt || '';

          // Store abort controller for this session
          state.ai.setAbortController(sessionId, abortController);

          const runTimeoutMs = getConfiguredTimeoutMs(timeouts.runMs);
          if (runTimeoutMs != null) {
            const timeoutId = setTimeout(() => {
              if (
                get().ai.getAbortController(sessionId) !== abortController ||
                abortController.signal.aborted
              ) {
                return;
              }
              const timeoutError = createRunTimeoutError(runTimeoutMs);
              abortController.abort(timeoutError);

              // A client tool or approval can pause useChat without an active
              // stream, so transport callbacks are not guaranteed to run.
              // Persist the same terminal timeout result immediately.
              const currentMessages = chat.messages;
              get().ai.persistTimedOutSession(
                sessionId,
                currentMessages,
                timeoutError.message,
              );
              disposeSessionChatRuntime(sessionId);
            }, runTimeoutMs);
            sessionRunTimeouts.set(sessionId, timeoutId);
            abortController.signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timeoutId);
                sessionRunTimeouts.delete(sessionId);
              },
              {once: true},
            );
          }

          set((stateToUpdate) =>
            produce(stateToUpdate, (draft) => {
              const draftSession = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (draftSession) {
                draftSession.isRunning = true;
                draftSession.runContext = getRunContext?.(sessionId);
                draftSession.draftContextItemIds = undefined;
                draftSession.prompt = '';
                draft.ai.promptSuggestionsVisible = false;
              }
            }),
          );
          void chat.sendMessage(
            promptText
              ? {
                  text: promptText,
                  ...(attachments.length > 0 ? {files: attachments} : {}),
                }
              : attachments.length > 0
                ? {files: attachments}
                : {text: promptText},
          );
        },

        startAnalysisWhenReady: async (
          sessionId: string,
          attachments: FileUIPart[] = [],
        ) => {
          if (!get().ai.getSessionChat(sessionId)) {
            console.error('Session not found:', sessionId);
            return false;
          }
          await get().ai.startAnalysis(sessionId, attachments);
          return true;
        },

        /**
         * Start a new session with a prompt and automatically begin analysis
         */
        startNewSession: async (name: string, prompt: string) => {
          // Create the session
          get().ai.createSession(name);

          // Get the newly created session
          const session = get().ai.getCurrentSession();
          if (!session) {
            console.error('Failed to create session');
            return;
          }

          // Set the prompt
          get().ai.setPrompt(session.id, prompt);

          void get()
            .ai.startAnalysisWhenReady(session.id)
            .catch((error) => {
              console.error('Failed to start analysis for new session:', error);
            });
        },

        cancelAnalysis: (sessionId: string) => {
          const state = get();
          const abortController = state.ai.getAbortController(sessionId);
          const chat = sessionChatRuntimes.get(sessionId)?.runtime.chat;

          abortController?.abort(ANALYSIS_CANCELLED);

          void chat?.stop();

          set((stateToUpdate) =>
            produce(stateToUpdate, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                session.isRunning = false;
              }
              // Keep abort controller so handlers can check signal.aborted
              // It will be cleared by onChatFinish
            }),
          );
        },

        /**
         * Get the assistant message parts for a given analysis result ID
         * @param analysisResultId - The ID of the analysis result (user message ID)
         * @returns Array of message parts from the assistant's response
         */
        getAssistantMessageParts: (analysisResultId: string) => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) return [];

          const uiMessages = currentSession.uiMessages as UIMessage[];
          // Find the user message with analysisResultId
          const userMessageIndex = uiMessages.findIndex(
            (msg) => msg.id === analysisResultId && msg.role === 'user',
          );
          if (userMessageIndex === -1) return [];

          // Find the next assistant message after this user message
          for (let i = userMessageIndex + 1; i < uiMessages.length; i++) {
            const msg = uiMessages[i];
            if (msg?.role === 'assistant') {
              return msg.parts;
            }
            if (msg?.role === 'user') {
              // Hit next user message without finding assistant response
              break;
            }
          }
          return [];
        },

        /**
         * Delete an analysis result from a session
         * and remove the corresponding prompt-response pair from uiMessages.
         */
        deleteAnalysisResult: (sessionId: string, resultId: string) => {
          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === sessionId,
              );
              if (session) {
                // Remove corresponding prompt-response pair from uiMessages
                const uiMessages = session.uiMessages as UIMessage[];
                const userMessageIndex = uiMessages.findIndex(
                  (msg) => msg.id === resultId && msg.role === 'user',
                );

                if (userMessageIndex !== -1) {
                  // Find the next user message (or end of array) to determine response boundary
                  let nextUserIndex = userMessageIndex + 1;

                  while (
                    nextUserIndex < uiMessages.length &&
                    uiMessages[nextUserIndex]?.role !== 'user'
                  ) {
                    nextUserIndex++;
                  }

                  // Remove the user message and all assistant messages until the next user message
                  session.uiMessages.splice(
                    userMessageIndex,
                    nextUserIndex - userMessageIndex,
                  );

                  // Increment messagesRevision to force useChat reset
                  session.messagesRevision =
                    (session.messagesRevision || 0) + 1;
                }
              }
            }),
          );
          disposeSessionChatRuntime(sessionId);
        },

        /**
         * Get legacy analysis-result-shaped data for the current session by
         * deriving it from UI messages.
         *
         * @returns Array of analysis results for the current session
         */
        getAnalysisResults: () => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) return undefined;

          const uiMessages = currentSession.uiMessages as UIMessage[];
          const cached = analysisResultsCache.get(uiMessages);
          if (cached && cached.isRunning === currentSession.isRunning) {
            return cached.results;
          }

          const results = getAnalysisResultsFromUiMessages(uiMessages, {
            isRunning: currentSession.isRunning,
          });
          analysisResultsCache.set(uiMessages, {
            isRunning: currentSession.isRunning,
            results,
          });
          return results;
        },

        /**
         * @deprecated Legacy compatibility adapter. New chat behavior should
         * update `uiMessages` through the chat transport.
         */
        addAnalysisResult: (message: UIMessage) => {
          const currentSession = get().ai.getCurrentSession();
          if (!currentSession) {
            console.error('No current session found');
            return;
          }

          set((state) =>
            produce(state, (draft) => {
              const session = draft.ai.config.sessions.find(
                (s: ChatSessionSchema) => s.id === currentSession.id,
              );
              if (!session) return;
              session.uiMessages.push(
                structuredClone(
                  message,
                ) as unknown as (typeof session.uiMessages)[number],
              );
            }),
          );
        },

        // Chat transport configuration
        chatEndPoint,
        chatHeaders,

        getLocalChatTransport: (sessionId: string) => {
          return createLocalChatTransportFactory({
            store,
            defaultProvider: defaultProvider,
            defaultModel: defaultModel,
            getInstructions: () =>
              store.getState().ai.getFullInstructions(sessionId),
            getCustomModel,
            sessionId,
            timeouts,
          })();
        },

        getRemoteChatTransport: (
          sessionId: string,
          endpoint: string,
          headers?: Record<string, string>,
        ) =>
          createRemoteChatTransportFactory({
            store,
            defaultProvider,
            defaultModel,
            sessionId,
            getInstructions: () =>
              store.getState().ai.getFullInstructions(sessionId),
          })(endpoint, headers),

        ...createChatHandlers({store, onChatFinish: params.onChatFinish}),
      },
    };
  });
}

/**
 * Helper function to get the current session from state
 */
function getCurrentSessionFromState(
  state: AiSliceState,
): ChatSessionSchema | undefined {
  const {currentSessionId, sessions} = state.ai.config;
  return sessions.find((session) => session.id === currentSessionId);
}

type AiCommandStoreState = BaseRoomStoreState & AiSliceState;

const AiCreateSessionInput = z
  .object({
    name: z.string().optional().describe('Optional session name.'),
    modelProvider: z
      .string()
      .optional()
      .describe('Optional model provider ID.'),
    model: z.string().optional().describe('Optional model ID.'),
  })
  .default({});
type AiCreateSessionInput = z.infer<typeof AiCreateSessionInput>;

const AiSessionIdInput = z.object({
  sessionId: z.string().describe('Target AI session ID.'),
});
type AiSessionIdInput = z.infer<typeof AiSessionIdInput>;

const AiRenameSessionInput = z.object({
  sessionId: z.string().describe('Target AI session ID.'),
  name: z.string().min(1).describe('New session name.'),
});
type AiRenameSessionInput = z.infer<typeof AiRenameSessionInput>;

function createAiCommands(): RoomCommand<AiCommandStoreState>[] {
  const ensureSessionExists = (
    state: AiCommandStoreState,
    sessionId: string,
  ) => {
    if (!state.ai.config.sessions.some((session) => session.id === sessionId)) {
      throw new Error(`Unknown AI session "${sessionId}".`);
    }
  };

  return [
    {
      id: 'ai.create-session',
      name: 'Create AI session',
      description: 'Start a new AI chat session',
      group: 'AI',
      keywords: ['ai', 'chat', 'session', 'new'],
      inputSchema: AiCreateSessionInput,
      inputDescription:
        'Optionally provide name, modelProvider, and model for the new session.',
      metadata: {
        readOnly: false,
        idempotent: false,
        riskLevel: 'low',
      },
      execute: ({getState}, input) => {
        const {name, modelProvider, model} =
          (input as AiCreateSessionInput | undefined) ?? {};
        getState().ai.createSession(name, modelProvider, model);
        return {
          success: true,
          commandId: 'ai.create-session',
          message: 'Created AI session.',
        };
      },
    },
    {
      id: 'ai.switch-session',
      name: 'Switch AI session',
      description: 'Switch current AI session by ID',
      group: 'AI',
      keywords: ['ai', 'chat', 'session', 'switch'],
      inputSchema: AiSessionIdInput,
      inputDescription: 'Provide sessionId to activate.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        ensureSessionExists(getState(), (input as AiSessionIdInput).sessionId);
      },
      execute: ({getState}, input) => {
        const {sessionId} = input as AiSessionIdInput;
        getState().ai.switchSession(sessionId);
        return {
          success: true,
          commandId: 'ai.switch-session',
          message: `Switched to AI session "${sessionId}".`,
        };
      },
    },
    {
      id: 'ai.rename-session',
      name: 'Rename AI session',
      description: 'Rename AI session by ID',
      group: 'AI',
      keywords: ['ai', 'chat', 'session', 'rename'],
      inputSchema: AiRenameSessionInput,
      inputDescription: 'Provide sessionId and new name.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      validateInput: (input, {getState}) => {
        ensureSessionExists(
          getState(),
          (input as AiRenameSessionInput).sessionId,
        );
      },
      execute: ({getState}, input) => {
        const {sessionId, name} = input as AiRenameSessionInput;
        getState().ai.renameSession(sessionId, name);
        return {
          success: true,
          commandId: 'ai.rename-session',
          message: `Renamed AI session "${sessionId}".`,
        };
      },
    },
    {
      id: 'ai.delete-session',
      name: 'Delete AI session',
      description: 'Delete AI session by ID',
      group: 'AI',
      keywords: ['ai', 'chat', 'session', 'delete'],
      inputSchema: AiSessionIdInput,
      inputDescription: 'Provide sessionId to delete.',
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'medium',
        requiresConfirmation: true,
      },
      validateInput: (input, {getState}) => {
        const state = getState();
        const {sessionId} = input as AiSessionIdInput;
        ensureSessionExists(state, sessionId);
      },
      execute: ({getState}, input) => {
        const {sessionId} = input as AiSessionIdInput;
        getState().ai.deleteSession(sessionId);
        return {
          success: true,
          commandId: 'ai.delete-session',
          message: `Deleted AI session "${sessionId}".`,
        };
      },
    },
    {
      id: 'ai.cancel-current-analysis',
      name: 'Cancel current AI analysis',
      description: 'Stop the currently running AI response',
      group: 'AI',
      keywords: ['ai', 'chat', 'cancel', 'stop', 'analysis'],
      metadata: {
        readOnly: false,
        idempotent: true,
        riskLevel: 'low',
      },
      isEnabled: ({getState}) => {
        const currentSession = getState().ai.getCurrentSession();
        return Boolean(currentSession?.isRunning);
      },
      execute: ({getState}) => {
        const currentSession = getState().ai.getCurrentSession();
        if (!currentSession) {
          return {
            success: false,
            commandId: 'ai.cancel-current-analysis',
            message: 'No active session.',
            error: 'no active session',
          };
        }
        getState().ai.cancelAnalysis(currentSession.id);
        return {
          success: true,
          commandId: 'ai.cancel-current-analysis',
          message: `Cancelled analysis for session "${currentSession.id}".`,
        };
      },
    },
  ];
}

export function useStoreWithAi<T>(selector: (state: AiSliceState) => T): T {
  return useBaseRoomStore<AiSliceState, T>((state) => selector(state));
}
