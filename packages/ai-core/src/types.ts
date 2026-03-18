import type {ComponentType} from 'react';
import type {AiSliceConfig, AnalysisSessionSchema} from '@sqlrooms/ai-config';
import type {
  UIMessage,
  ToolSet,
  Tool,
  InferToolOutput,
  InferToolInput,
} from 'ai';
import {streamText} from 'ai';

export type ProviderOptions = NonNullable<
  Parameters<typeof streamText>[0]['providerOptions']
>;

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
 * `streamText()` / `generateText()` cast back to `ToolSet`.
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
}) => ProviderOptions | null | undefined;

/**
 * Type for adding tool results to the chat.
 * Extracted to a separate file to avoid circular dependencies.
 */
export type AddToolResult = (
  options:
    | {tool: string; toolCallId: string; output: unknown}
    | {
        tool: string;
        toolCallId: string;
        state: 'output-error';
        errorText: string;
      },
) => void;

export type AiChatSendMessage = (message: {text: string}) => void;

/**
 * Minimal interface for the AI state accessed by chat transport functions.
 * This allows chatTransport.ts to avoid importing from AiSlice.ts directly.
 */
export interface AiStateForTransport {
  config: AiSliceConfig;
  tools: StoredToolSet;
  getProviderOptions?: GetProviderOptions;
  getCurrentSession: () => AnalysisSessionSchema | undefined;
  getAbortController: (sessionId: string) => AbortController | undefined;
  setAbortController: (
    sessionId: string,
    controller: AbortController | undefined,
  ) => void;
  getIsRunning: (sessionId: string) => boolean;
  setIsRunning: (sessionId: string, isRunning: boolean) => void;
  setToolEditState: (
    sessionId: string,
    toolCallId: string,
    editState: unknown,
  ) => void;
  setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
  toolRenderers: ToolRendererRegistry;
  findToolRenderer: (toolName: string) => ToolRenderer | undefined;
  /** Map toolCallId -> sessionId for long-running tool streams (e.g. agents) */
  setToolCallSession: (
    toolCallId: string,
    sessionId: string | undefined,
  ) => void;
  getToolCallSession: (toolCallId: string) => string | undefined;
  waitForToolResult: (
    sessionId: string,
    toolCallId: string,
    abortSignal?: AbortSignal,
  ) => Promise<void>;
  getFullInstructions: () => string;
  /** Get API key from settings for the current session's provider */
  getApiKeyFromSettings: () => string;
  /** Get base URL from settings for the current session's provider */
  getBaseUrlFromSettings: () => string | undefined;
  /** Set API key error flag for a provider */
  setApiKeyError: (provider: string, hasError: boolean) => void;
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
    | 'output-error';
  errorText?: string;
};

/**
 * A React component that renders the result of a tool call.
 *
 * ```ts
 * ToolRenderer<ReturnType<typeof myTool>>    // infers output/input from Tool
 * ToolRenderer<MyOutput, MyInput>            // explicit output/input
 * ```
 */
export type ToolRenderer<
  TToolOrOutput = unknown,
  TInput = unknown,
> = TToolOrOutput extends Tool
  ? ComponentType<
      ToolRendererProps<
        InferToolOutput<TToolOrOutput>,
        InferToolInput<TToolOrOutput>
      >
    >
  : ComponentType<ToolRendererProps<TToolOrOutput, TInput>>;

/** Registry mapping tool names to their renderer components. */
export type ToolRendererRegistry = Record<string, ToolRenderer<any>>;

/**
 * Typed renderer map for a given `ToolSet`.
 * Keys constrained to tool names; values typed via `ToolRenderer<TTools[K]>`.
 */
export type ToolRenderers<TTools extends ToolSet> = {
  [K in keyof TTools]?: ToolRenderer<TTools[K]>;
};
