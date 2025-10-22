import {
  DefaultChatTransport,
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import type {LanguageModel, ToolSet} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {convertToVercelAiToolV5, OpenAssistantTool} from '@openassistant/utils';
import {produce} from 'immer';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {AiSliceState} from './AiSlice';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';
import {AddToolResult} from './hooks/useAiChat';
import type {StoreApi} from '@sqlrooms/room-store';

type ToolCall = {
  input: string;
  toolCallId: string;
  toolName: string;
  type: 'tool-input-available';
};

export type ChatTransportConfig = {
  store: StoreApi<AiSliceState>;
  defaultProvider: string;
  defaultModel: string;
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  getInstructions: () => string;
  /**
   * Optional: supply a pre-configured custom model.
   * e.g. import {xai} from "@ai-sdk/xai";
   * getCustomModel: () => xai('grok-4')
   * If provided, this model will be used instead of the default OpenAI-compatible client.
   */
  getCustomModel?: () => LanguageModel | undefined;
};

/**
 * Creates a handler for tool completion that updates the tool additional data in the store
 */
function createOnToolCompletedHandler(store: StoreApi<AiSliceState>) {
  return (toolCallId: string, additionalData: unknown) => {
    const sessionId = store.getState().ai.config.currentSessionId;
    if (!sessionId) return;

    store
      .getState()
      .ai.setSessionToolAdditionalData(sessionId, toolCallId, additionalData);
  };
}

/**
 * Converts OpenAssistant tools to Vercel AI SDK tools with onToolCompleted handler
 */
function convertToAiSDKTools(
  tools: Record<string, OpenAssistantTool>,
  onToolCompleted: (toolCallId: string, additionalData: unknown) => void,
): ToolSet {
  return Object.entries(tools || {}).reduce(
    (acc: ToolSet, [name, tool]: [string, OpenAssistantTool]) => {
      acc[name] = convertToVercelAiToolV5({
        ...tool,
        onToolCompleted,
      });
      return acc;
    },
    {},
  );
}

export function createLocalChatTransportFactory({
  store,
  defaultProvider,
  defaultModel,
  apiKey,
  baseUrl,
  headers,
  getInstructions,
  getCustomModel,
}: ChatTransportConfig) {
  return () => {
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      // Resolve provider/model and client at call time to pick up latest settings
      const state = store.getState();
      const currentSession = state.ai.getCurrentSession();
      const provider = currentSession?.modelProvider || defaultProvider;
      const modelId = currentSession?.model || defaultModel;

      // Prefer a user-supplied model if available
      let model: LanguageModel | undefined = getCustomModel?.();

      // Fallback to OpenAI-compatible if no custom model provided
      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl || 'https://api.openai.com/v1',
          headers,
        });
        model = openai.chatModel(modelId);
      }

      const body = init?.body as string;
      const parsed = body ? JSON.parse(body) : {};
      const messagesCopy = JSON.parse(JSON.stringify(parsed.messages || []));

      const onToolCompleted = createOnToolCompletedHandler(store);
      const tools = convertToAiSDKTools(state.ai.tools || {}, onToolCompleted);

      // get system instructions dynamically at request time to ensure fresh table schema
      const systemInstructions = getInstructions();

      const result = streamText({
        model,
        messages: convertToModelMessages(messagesCopy),
        tools,
        system: systemInstructions,
        abortSignal: state.ai.analysisAbortController?.signal,
      });

      return result.toUIMessageStreamResponse();
    };

    return new DefaultChatTransport({fetch: fetchImpl});
  };
}

export function createRemoteChatTransportFactory(params: {
  store: StoreApi<AiSliceState>;
  defaultProvider: string;
  defaultModel: string;
}) {
  return (endpoint: string, headers?: Record<string, string>) => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Get current session's model and provider at request time
      const state = params.store.getState();
      const currentSession = state.ai.getCurrentSession();
      const modelProvider =
        currentSession?.modelProvider || params.defaultProvider;
      const model = currentSession?.model || params.defaultModel;

      // Parse the existing body and add model information
      const body = init?.body as string;
      const parsed = body ? JSON.parse(body) : {};

      const enhancedBody = {
        ...parsed,
        modelProvider,
        model,
      };

      // Make the request with enhanced body
      return fetch(input, {
        ...init,
        body: JSON.stringify(enhancedBody),
      });
    };

    return new DefaultChatTransport({
      api: endpoint,
      credentials: 'include',
      headers,
      fetch: fetchImpl,
    });
  };
}

export function createChatHandlers({store}: {store: StoreApi<AiSliceState>}) {
  return {
    onChatToolCall: async ({
      toolCall,
      addToolResult,
    }: {
      toolCall: ToolCall;
      addToolResult?: AddToolResult;
    }) => {
      const {input, toolCallId, toolName} = toolCall;
      try {
        // handle client tools
        const state = store.getState();

        const onToolCompleted = createOnToolCompletedHandler(store);
        const tools = convertToAiSDKTools(
          state.ai.tools || {},
          onToolCompleted,
        );

        // find tool from tools using toolName
        const tool = tools[toolName];
        if (tool && tool.execute) {
          const llmResult = await tool.execute(input, {
            toolCallId,
            messages: [],
          });

          if (addToolResult) {
            // Note: When using sendAutomaticallyWhen, avoid awaiting addToolResult to prevent deadlocks
            addToolResult({
              tool: toolName,
              toolCallId,
              output: llmResult,
            });
          }
        }
      } catch (error) {
        if (addToolResult) {
          addToolResult({
            tool: toolName,
            toolCallId,
            state: 'output-error',
            errorText: getErrorMessageForDisplay(error),
          });
        }
      }
    },
    onChatData: (dataPart: any) => {
      // Handle additional tool output data from the backend
      if (dataPart.type === 'data-tool-additional-output') {
        const {toolCallId, output} = dataPart.data;

        // Store the additional data in the session
        const currentSessionId = store.getState().ai.config.currentSessionId;
        if (currentSessionId) {
          store
            .getState()
            .ai.setSessionToolAdditionalData(
              currentSessionId,
              toolCallId,
              output,
            );
        }
      }
    },
    onChatFinish: ({messages}: {messages: UIMessage[]}) => {
      try {
        const currentSessionId = store.getState().ai.config.currentSessionId;
        if (!currentSessionId) return;

        store.getState().ai.setSessionUiMessages(currentSessionId, messages);

        // Create or update analysis result with the user message ID for proper correlation
        store.setState((state: AiSliceState) =>
          produce(state, (draft: AiSliceState) => {
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === currentSessionId,
            );
            if (!targetSession) return;

            // Find the last user message to get its ID and prompt
            const lastUserMessage = messages
              .filter((msg) => msg.role === 'user')
              .slice(-1)[0];

            if (lastUserMessage) {
              // Extract text content from user message
              const promptText = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => (part as {text: string}).text)
                .join('');

              // Check if there's a pending analysis result
              const pendingIndex = targetSession.analysisResults.findIndex(
                (result: any) => result.id === '__pending__',
              );

              if (pendingIndex !== -1) {
                // Update the pending result with actual data
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  isCompleted: true,
                };
              } else {
                // Check if analysis result already exists for this user message
                const existingResult = targetSession.analysisResults.find(
                  (result: any) => result.id === lastUserMessage.id,
                );

                if (!existingResult) {
                  // Create analysis result with the same ID as the user message
                  targetSession.analysisResults.push({
                    id: lastUserMessage.id,
                    prompt: promptText,
                    isCompleted: true,
                  });
                }
              }
            }
          }),
        );
        store.setState((state: AiSliceState) =>
          produce(state, (draft: AiSliceState) => {
            draft.ai.isRunningAnalysis = false;
            draft.ai.analysisPrompt = '';
            draft.ai.analysisAbortController = undefined;
          }),
        );
      } catch (err) {
        console.error('onChatFinish error:', err);
        throw err;
      }
    },
    onChatError: (error: unknown) => {
      try {
        let errMsg = getErrorMessageForDisplay(error);
        if (!errMsg || errMsg.trim().length === 0) {
          errMsg = 'Unknown error';
        }
        const currentSessionId = store.getState().ai.config.currentSessionId;
        store.setState((state: AiSliceState) =>
          produce(state, (draft: AiSliceState) => {
            if (!currentSessionId) return;
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === currentSessionId,
            );
            if (targetSession) {
              // Find the last user message to create analysis result with correct ID
              const uiMessages = targetSession.uiMessages as UIMessage[];
              const lastUserMessage = uiMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];

              if (lastUserMessage) {
                // Extract text content from user message
                const promptText = lastUserMessage.parts
                  .filter((part: any) => part.type === 'text')
                  .map((part: any) => (part as {text: string}).text)
                  .join('');

                // Check if there's a pending analysis result
                const pendingIndex = targetSession.analysisResults.findIndex(
                  (result: any) => result.id === '__pending__',
                );

                if (pendingIndex !== -1) {
                  // Update the pending result with error
                  targetSession.analysisResults[pendingIndex] = {
                    id: lastUserMessage.id,
                    prompt: promptText,
                    errorMessage: {error: errMsg},
                    isCompleted: true,
                  };
                } else {
                  // Check if analysis result already exists for this user message
                  const existingResult = targetSession.analysisResults.find(
                    (result: any) => result.id === lastUserMessage.id,
                  );

                  if (!existingResult) {
                    // Create analysis result with the same ID as the user message
                    targetSession.analysisResults.push({
                      id: lastUserMessage.id,
                      prompt: promptText,
                      errorMessage: {error: errMsg},
                      isCompleted: true,
                    });
                  } else {
                    // Update existing result with error message
                    existingResult.errorMessage = {error: errMsg};
                  }
                }
              }
            }
            draft.ai.isRunningAnalysis = false;
            draft.ai.analysisAbortController = undefined;
          }),
        );
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
  };
}
