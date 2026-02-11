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

export type AiChatSendMessage = (message: {text: string}) => void;

/**
 * Minimal interface for the AI state accessed by chat transport functions.
 * This allows chatTransport.ts to avoid importing from AiSlice.ts directly.
 */
export interface AiStateForTransport {
  config: AiSliceConfig;
  tools: OpenAssistantToolSet;
  getProviderOptions?: GetProviderOptions;
  getCurrentSession: () => AnalysisSessionSchema | undefined;
  getAbortController: (sessionId: string) => AbortController | undefined;
  setAbortController: (
    sessionId: string,
    controller: AbortController | undefined,
  ) => void;
  getIsRunning: (sessionId: string) => boolean;
  setIsRunning: (sessionId: string, isRunning: boolean) => void;
  setSessionToolAdditionalData: (
    sessionId: string,
    toolCallId: string,
    additionalData: unknown,
  ) => void;
  setSessionUiMessages: (sessionId: string, uiMessages: UIMessage[]) => void;
  findToolComponent: (toolName: string) => React.ComponentType | undefined;
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
}

/**
 * Minimal state interface for chat transport.
 */
export interface AiSliceStateForTransport {
  ai: AiStateForTransport;
}
