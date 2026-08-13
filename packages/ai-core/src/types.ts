import type {ComponentType, ExoticComponent} from 'react';
import type {
  AiRunContext,
  AiRunContextItem,
  AiSliceConfig,
  ChatSessionSchema,
} from '@sqlrooms/ai-config';
import type {
  UIMessage,
  ToolSet,
  Tool,
  InferToolOutput,
  InferToolInput,
  ToolLoopAgentSettings,
} from 'ai';
/**
 * Represents the state of a single tool call made by an agent.
 * When the tool is itself an agent, `agentToolCalls` contains the
 * nested sub-agent's tool calls so the UI can render them recursively.
 */
export type AgentToolCall = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state: 'pending' | 'success' | 'error' | 'approval-requested';
  agentToolCalls?: AgentToolCall[];
  approvalId?: string;
  startedAt?: number;
  completedAt?: number;
};

/**
 * Additional data associated with an agent tool call, used by renderers.
 */
export type AgentToolCallAdditionalData = {
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

/**
 * Return type from streamSubAgent containing both final text and tool call data.
 */
export type AgentStreamOutput = {
  finalOutput: string;
  agentToolCalls: AgentToolCall[];
};

/**
 * Pending approval request for a sub-agent tool.
 * Stored in the AI slice state so the UI can render approval prompts.
 */
export type PendingSubAgentApproval = {
  toolCallId: string;
  approvalId: string;
  toolName: string;
  input: unknown;
  resolve: (approved: boolean) => void;
};

/**
 * Structured snapshot of a sub-agent's progress at the time of abort.
 * Captured recursively: when a child tool is itself an agent, its
 * `childSnapshot` contains the nested agent's own progress.
 * Used to give the parent orchestrator enough context to resume
 * intelligently when the user types "continue".
 */
export type AgentProgressSnapshot = {
  agentName: string;
  completedTools: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    childSnapshot?: AgentProgressSnapshot;
  }>;
  failedTools: Array<{
    toolName: string;
    input: unknown;
    errorText: string;
    childSnapshot?: AgentProgressSnapshot;
  }>;
  pendingTools: Array<{
    toolName: string;
    input: unknown;
    childSnapshot?: AgentProgressSnapshot;
  }>;
  partialText: string;
};

/**
 * Serializable agent metadata captured for AI devtools.
 *
 * Snapshot capture is optional and intentionally stores descriptions, names,
 * capability flags, and bounded settings only. It must not contain executable
 * tool objects, closures, API keys, or unbounded prompt/output content.
 */
export type AgentSnapshot = {
  agentName?: string;
  parentToolCallId: string;
  availableTools: Array<{
    name: string;
    description?: string;
    /** Whether the captured tool exposed an execute function. */
    hasExecute?: boolean;
    /** Whether the captured tool exposed a renderer-like function. */
    hasRenderer?: boolean;
    needsApproval?: boolean;
  }>;
  settings?: {
    maxSteps?: number;
    model?: string;
    provider?: string;
  };
  startedAt: number;
};

/** Metadata-only measurement of one outbound provider step. */
export type ProviderContextDiagnostic = {
  id: string;
  recordedAt: number;
  /** Stable caller-assigned role label, e.g. `chat-coordinator`. */
  role: string;
  provider: string;
  model: string;
  /** Zero-based provider invocation within the owning request. */
  step: number;
  instructions: {chars: number; bytes: number};
  messages: {count: number; bytes: number};
  tools: Array<{name: string; schemaBytes: number}>;
  toolSchemaBytes: number;
  /** Names of request-assembly sources; never their content. */
  sources: string[];
  /** Provider-reported input tokens, populated after the step completes. */
  inputTokens?: number;
};

/** Devtools-only state and controls nested under the AI slice. */
export type AiDevtoolsState = {
  /** Optional devtools snapshots for agent metadata, keyed by parent toolCallId. */
  agentSnapshots: Record<string, AgentSnapshot>;
  /** Whether agent metadata snapshots should be captured in memory. */
  shouldCaptureAgentSnapshots: () => boolean;
  /** Whether captured agent metadata snapshots should be persisted to sessions. */
  shouldPersistAgentSnapshots: () => boolean;
  /** Writes a bounded serializable snapshot for a parent agent tool call. */
  writeAgentSnapshot: (
    parentToolCallId: string,
    snapshot: AgentSnapshot,
  ) => void;
  /** Clears all captured agent metadata snapshots. */
  clearAgentSnapshots: () => void;
  /** Bounded, transient, metadata-only provider request measurements. */
  providerContexts: ProviderContextDiagnostic[];
  shouldCaptureProviderContexts: () => boolean;
  writeProviderContext: (diagnostic: ProviderContextDiagnostic) => void;
  setProviderContextInputTokens: (id: string, inputTokens: number) => void;
  clearProviderContexts: () => void;
};

/**
 * Per-tool-call timing entry stored in assistant message metadata.
 */
export type ToolTimingEntry = {
  startedAt: number;
  completedAt?: number;
};

/**
 * Accumulated token usage for an assistant message, sourced from the AI SDK's
 * LanguageModelUsage reported at the end of each step.
 */
export type MessageTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /** Input tokens from the last step only (approximates current context fill). */
  lastStepInputTokens?: number;
  inputTokenDetails?: {
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  outputTokenDetails?: {
    reasoningTokens?: number;
  };
};

/**
 * Shape of custom metadata stored on assistant UIMessages.
 */
export type AssistantMessageMetadata = {
  toolTimings?: Record<string, ToolTimingEntry>;
  tokenUsage?: MessageTokenUsage;
};

/**
 * Shallow tool representation stored in state.
 *
 * The AI SDK's `ToolSet` type contains deeply recursive Zod generics that
 * exceed TypeScript's type-instantiation depth when wrapped in Immer's
 * `Draft<>` (TS2589). This interface preserves the properties consumers
 * need to read from state while keeping the type shallow enough for Immer.
 *
 * Tools are still accepted as the full `ToolSet` in `AiSliceOptions` for
 * type-safe tool creation. Internal call-sites that pass tools to
 * `ToolLoopAgent` cast back to `ToolSet`.
 */
export interface StoredTool {
  description?: string;
  execute?: (args: any, options?: any) => PromiseLike<unknown>;
  [key: string]: unknown;
}

/**
 * Immer-safe tool map stored in AI slice state.
 * @see {@link StoredTool} for why this exists instead of `ToolSet`.
 */
export type StoredToolSet = Record<string, StoredTool>;

/**
 * Provide provider-specific options for the underlying AI SDK call.
 */
export type GetProviderOptions = (args: {
  provider: string;
  modelId: string;
}) => ToolLoopAgentSettings['providerOptions'];

/**
 * Type for adding tool outputs to the chat.
 * Defined here (in types.ts) to avoid circular dependencies.
 */
export type AddToolOutput = (
  options:
    | {tool: string; toolCallId: string; output: unknown}
    | {
        tool: string;
        toolCallId: string;
        state: 'output-error';
        errorText: string;
      },
) => void;

export type AddToolApprovalResponse = (options: {
  id: string;
  approved: boolean;
}) => void;

export type AiChatSendMessage = (message: {text: string}) => void;

export type AiToolExecutionContext = {
  sessionId?: string;
  aiRunContext?: AiRunContext;
  getAiRunContext?: () => AiRunContext | undefined;
  setAiRunContext?: (runContext: AiRunContext | undefined) => void;
  setPrimaryRunContextItem?: (item: AiRunContextItem) => void;
};

/**
 * Minimal interface for the AI state accessed by chat transport functions.
 * This allows chatTransport.ts to avoid importing from AiSlice.ts directly.
 */
export interface AiStateForTransport {
  config: AiSliceConfig;
  tools: StoredToolSet;
  getProviderOptions?: GetProviderOptions;
  getCurrentSession: () => ChatSessionSchema | undefined;
  getSessionRunContext: (sessionId: string) => AiRunContext | undefined;
  setSessionRunContext: (
    sessionId: string,
    runContext: AiRunContext | undefined,
  ) => void;
  getAbortController: (sessionId: string) => AbortController | undefined;
  setAbortController: (
    sessionId: string,
    controller: AbortController | undefined,
  ) => void;
  getIsRunning: (sessionId: string) => boolean;
  setIsRunning: (sessionId: string, isRunning: boolean) => void;
  setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => boolean;
  toolRenderers: ToolRendererRegistry;
  findToolRenderer: (toolName: string) => ToolRenderer | undefined;
  /** Map toolCallId -> sessionId for long-running tool streams (e.g. agents) */
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
  writeAbortSnapshot?: (
    toolCallId: string,
    snapshot: AgentProgressSnapshot,
  ) => void;
  readAbortSnapshot?: (toolCallId: string) => AgentProgressSnapshot | undefined;
  clearAbortSnapshots?: () => void;
  getFullInstructions: (sessionId?: string) => string;
  /**
   * Get API key from settings. Defaults to the current session's provider;
   * pass `provider`/`model` to resolve the key for a specific outbound provider.
   */
  getApiKeyFromSettings: (provider?: string, model?: string) => string;
  /**
   * Get base URL from settings. Defaults to the current session's provider;
   * pass `provider`/`model` to resolve the URL for a specific outbound provider.
   */
  getBaseUrlFromSettings: (
    provider?: string,
    model?: string,
  ) => string | undefined;
  /** Set API key error flag for a provider */
  setApiKeyError: (provider: string, hasError: boolean) => void;
  /** Get the maximum number of agent steps from settings */
  getMaxStepsFromSettings: () => number;
  /** Per-tool-call timing entries, keyed by toolCallId */
  toolTimings: Record<string, ToolTimingEntry>;
  setToolTiming: (toolCallId: string, entry: ToolTimingEntry) => void;
  getToolTimings: () => Record<string, ToolTimingEntry>;
}

/**
 * Minimal state interface for chat transport.
 */
export interface AiSliceStateForTransport {
  ai: AiStateForTransport;
}

/**
 * Props passed to tool renderer components.
 */
export type ToolRendererProps<TOutput = unknown, TInput = unknown> = {
  output: TOutput | undefined;
  input: TInput;
  toolCallId: string;
  state:
    | 'input-streaming'
    | 'input-available'
    | 'output-available'
    | 'output-error'
    | 'approval-requested'
    | 'approval-responded'
    | 'output-denied';
  errorText?: string;
  /**
   * Approval ID for tools with `needsApproval`.
   * Always defined when `state` is `'approval-requested'`, `'approval-responded'`,
   * or `'output-denied'`. Renderers handling those states can safely assert
   * this value is a `string` without additional null checks.
   */
  approvalId?: string;
};

type IsAny<T> = 0 extends 1 & T ? true : false;

type RenderableComponent<TProps> =
  | ComponentType<TProps>
  | ExoticComponent<TProps>;

/**
 * Component type inferred from a tool or from explicit output/input.
 * Tuple-wrapped so a union tool type does not distribute into a bare
 * `FunctionComponent` union that drops {@link ToolRendererShouldHoist}.
 * `any` is treated as an explicit output type so registries stay writable.
 */
type ToolRendererComponent<TToolOrOutput, TInput> =
  IsAny<TToolOrOutput> extends true
    ? RenderableComponent<ToolRendererProps<any, any>>
    : [TToolOrOutput] extends [Tool]
      ? RenderableComponent<
          ToolRendererProps<
            InferToolOutput<Extract<TToolOrOutput, Tool>>,
            InferToolInput<Extract<TToolOrOutput, Tool>>
          >
        >
      : RenderableComponent<ToolRendererProps<TToolOrOutput, TInput>>;

/**
 * A React component that renders the result of a tool call.
 *
 * ```ts
 * ToolRenderer<ReturnType<typeof myTool>>    // infers output/input from Tool
 * ToolRenderer<MyOutput, MyInput>            // explicit output/input
 * ```
 *
 * Dispatcher tools that only sometimes produce UI (e.g. `executeApi`) may
 * attach an optional static `shouldHoist` predicate. When it returns false,
 * ChatTurnView keeps the call in the activity timeline and does not emit an
 * empty hoisted slot in the turn body.
 */
export type ToolRenderer<
  TToolOrOutput = unknown,
  TInput = unknown,
> = ToolRendererComponent<TToolOrOutput, TInput> & {
  shouldHoist?: ToolRendererShouldHoist;
};

/**
 * Optional static predicate on a {@link ToolRenderer}. Return false when this
 * particular call has no visible UI so it is not collected into the hoisted
 * turn-body slot list.
 */
export type ToolRendererShouldHoist = (args: {
  output: unknown;
  input: unknown;
  /** Normalized tool-call state shared by top-level and nested calls. */
  state: AgentToolCall['state'];
}) => boolean;

/** Registry mapping tool names to their renderer components. */
export type ToolRendererRegistry = Record<string, ToolRenderer<any>>;

/**
 * Typed renderer map for a given `ToolSet`.
 * Keys constrained to tool names; values typed via `ToolRenderer<TTools[K]>`.
 */
export type ToolRenderers<TTools extends ToolSet> = {
  [K in keyof TTools]?: ToolRenderer<TTools[K]>;
};
