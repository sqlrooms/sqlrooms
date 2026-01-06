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
  /**
   * Session id that the currently in-flight chat run is pinned to.
   * This prevents streamed message/tool updates from being written into a different
   * session if the user switches sessions mid-stream.
   */
  activeChatSessionId?: string;
  analysisAbortController?: AbortController;
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
    toolCallId: string,
    abortSignal?: AbortSignal,
  ) => Promise<void>;
  getFullInstructions: () => string;
}

/**
 * Minimal state interface for chat transport.
 */
export interface AiSliceStateForTransport {
  ai: AiStateForTransport;
}
