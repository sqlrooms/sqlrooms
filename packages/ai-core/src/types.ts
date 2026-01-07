import type {UIMessage} from 'ai';
import {streamText} from 'ai';
import type {AnalysisSessionSchema, AiSliceConfig} from '@sqlrooms/ai-config';
import type {OpenAssistantToolSet} from '@openassistant/utils';

export type ProviderOptions = NonNullable<
  Parameters<typeof streamText>[0]['providerOptions']
>;

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

/**
 * Minimal interface for the AI state accessed by chat transport functions.
 * This allows chatTransport.ts to avoid importing from AiSlice.ts directly.
 */
export interface AiStateForTransport {
  config: AiSliceConfig;
  tools: OpenAssistantToolSet;
  /** @deprecated Use getSessionAbortController(sessionId) instead */
  analysisAbortController?: AbortController;
  /** @deprecated Use isSessionRunning(sessionId) instead */
  isRunningAnalysis: boolean;
  analysisPrompt: string;
  getProviderOptions?: GetProviderOptions;
  getCurrentSession: () => AnalysisSessionSchema | undefined;
  setSessionToolAdditionalData: (
    sessionId: string,
    toolCallId: string,
    additionalData: unknown,
  ) => void;
  setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
  findToolComponent: (toolName: string) => React.ComponentType | undefined;
  waitForToolResult: (
    sessionId: string,
    toolCallId: string,
    abortSignal?: AbortSignal,
  ) => Promise<void>;
  getFullInstructions: () => string;
  // Per-session state accessors (Maps are kept outside Zustand state to avoid Immer freezing)
  isSessionRunning: (sessionId: string) => boolean;
  getSessionAbortSignal: (sessionId: string) => AbortSignal | undefined;
  getSessionAbortController: (sessionId: string) => AbortController | undefined;
  /** Mark a session as running */
  setSessionRunning: (sessionId: string, running: boolean) => void;
  /** Clean up session abort controller */
  clearSessionAbortController: (sessionId: string) => void;
}

/**
 * Minimal state interface for chat transport.
 */
export interface AiSliceStateForTransport {
  ai: AiStateForTransport;
}
