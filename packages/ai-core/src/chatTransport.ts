import {
  DefaultChatTransport,
  UIMessage,
  convertToModelMessages,
  streamText,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {DataUIPart, LanguageModel, ToolSet, UIDataTypes} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {convertToVercelAiToolV5, OpenAssistantTool} from '@openassistant/utils';
import {produce} from 'immer';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';
import {AddToolResult} from './types';
import type {AiSliceStateForTransport} from './types';
import type {StoreApi} from '@sqlrooms/room-store';
import {
  mergeAbortSignals,
  ToolAbortError,
  fixIncompleteToolCalls,
} from './utils';
import {
  AI_DEFAULT_TEMPERATURE,
  ANALYSIS_PENDING_ID,
  TOOL_CALL_CANCELLED,
} from './constants';

export type ToolCall = {
  input: string;
  toolCallId: string;
  toolName: string;
  type: 'tool-input-available';
};

export type ChatTransportConfig = {
  sessionId: string;
  store: StoreApi<AiSliceStateForTransport>;
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
export function createOnToolCompletedHandler(
  store: StoreApi<AiSliceStateForTransport>,
  sessionId?: string,
) {
  return (toolCallId: string, additionalData: unknown) => {
    // Prefer explicit sessionId if provided, otherwise attempt to resolve from toolCallId.
    const toolCallSessionId = store.getState().ai.getToolCallSession(toolCallId);
    const resolvedSessionId =
      sessionId ||
      toolCallSessionId ||
      store.getState().ai.config.currentSessionId;
    if (!resolvedSessionId) return;

    store
      .getState()
      .ai.setSessionToolAdditionalData(
        resolvedSessionId,
        toolCallId,
        additionalData,
      );
  };
}

function getSessionById(
  store: StoreApi<AiSliceStateForTransport>,
  sessionId: string | undefined,
): AnalysisSessionSchema | undefined {
  if (!sessionId) return undefined;
  return store
    .getState()
    .ai.config.sessions.find((s: AnalysisSessionSchema) => s.id === sessionId);
}

/**
 * Converts OpenAssistant tools to Vercel AI SDK tools with onToolCompleted handler
 */
export function convertToAiSDKTools(
  tools: Record<string, OpenAssistantTool>,
  onToolCompleted?: OpenAssistantTool['onToolCompleted'],
): ToolSet {
  return Object.entries(tools || {}).reduce(
    (acc: ToolSet, [name, tool]: [string, OpenAssistantTool]) => {
      acc[name] = convertToVercelAiToolV5({
        ...tool,
        onToolCompleted: (toolCallId: string, additionalData: unknown) => {
          if (tool.onToolCompleted) {
            // Call the onToolCompleted handler provided by the tool if it exists
            tool.onToolCompleted(toolCallId, additionalData);
          }
          // Call the onToolCompleted handler provided by the caller if it exists
          onToolCompleted?.(toolCallId, additionalData);
        },
      });
      return acc;
    },
    {},
  );
}

export function createLocalChatTransportFactory({
  sessionId,
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
      // Parse caller-supplied body defensively to avoid breaking the stream
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        parsed = {};
      }
      const parsedObj = (parsed as {messages?: unknown}) || {};

      // Resolve provider/model and client at call time to pick up latest settings.
      const state = store.getState();
      const sessionFromBody = getSessionById(store, sessionId);
      const provider = sessionFromBody?.modelProvider || defaultProvider;
      const modelId = sessionFromBody?.model || defaultModel;

      // Prefer a user-supplied model if available
      let model: LanguageModel | undefined = getCustomModel?.();

      // Fallback to OpenAI-compatible if no custom model provided
      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl ?? '',
          headers,
        });
        model = openai.chatModel(modelId);
      }

      const messagesCopy = Array.isArray(parsedObj.messages)
        ? (parsedObj.messages as UIMessage[])
        : [];

      const onToolCompleted = createOnToolCompletedHandler(store, sessionId);
      const tools = convertToAiSDKTools(state.ai.tools || {}, onToolCompleted);
      // Remove execute from tools for the model call so tool invocations are
      // handled exclusively by onChatToolCall. convertToAiSDKTools is expected
      // to return fresh tool objects; if that ever changes, clone before mutate.
      Object.values(tools).forEach((tool) => {
        tool.execute = undefined;
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

      const result = streamText({
        model,
        messages: convertToModelMessages(messagesCopy),
        tools,
        system: systemInstructions,
        abortSignal,
        temperature: AI_DEFAULT_TEMPERATURE,
        ...(providerOptions ? {providerOptions} : {}),
      });

      return result.toUIMessageStreamResponse();
    };

    return new DefaultChatTransport({fetch: fetchImpl});
  };
}

export function createRemoteChatTransportFactory(params: {
  store: StoreApi<AiSliceStateForTransport>;
  defaultProvider: string;
  defaultModel: string;
  sessionId: string;
}) {
  return (endpoint: string, headers?: Record<string, string>) => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const {store, defaultProvider, defaultModel, sessionId} = params;
      // Get current session's model and provider at request time
      const state = store.getState();

      // Parse the existing body and add model information (defensive parsing)
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        parsed = {};
      }

      const sessionFromBody = getSessionById(store, sessionId);
      const modelProvider = sessionFromBody?.modelProvider || defaultProvider;
      const model = sessionFromBody?.model || defaultModel;

      const parsedObj =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      const enhancedBody = {
        ...parsedObj,
        modelProvider,
        model,
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
        signal: abortSignal,
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

export function createChatHandlers({
  store,
}: {
  store: StoreApi<AiSliceStateForTransport>;
}) {
  return {
    onChatToolCall: async ({
      sessionId,
      toolCall,
      addToolResult,
    }: {
      sessionId: string;
      toolCall: ToolCall;
      addToolResult?: AddToolResult;
    }) => {
      const {input, toolCallId, toolName} = toolCall;
      try {
        const state = store.getState();
        const session = getSessionById(store, sessionId);
        state.ai.setToolCallSession(toolCallId, sessionId);

        const abortController = sessionId
          ? state.ai.getAbortController(sessionId)
          : undefined;
        if (abortController?.signal.aborted) {
          addToolResult?.({
            tool: toolName,
            toolCallId,
            state: 'output-error',
            errorText: TOOL_CALL_CANCELLED,
          });
          return;
        }

        const onToolCompleted = createOnToolCompletedHandler(store, sessionId);
        const tools = convertToAiSDKTools(
          state.ai.tools || {},
          onToolCompleted,
        );

        const tool = tools[toolName];
        if (tool && state.ai.tools[toolName]?.execute && tool.execute) {
          const sessionMessages = (session?.uiMessages ?? []) as UIMessage[];
          const llmResult = await tool.execute(input, {
            toolCallId,
            messages: convertToModelMessages(sessionMessages),
            abortSignal: abortController?.signal,
          });

          addToolResult?.({
            tool: toolName,
            toolCallId,
            output: llmResult,
          });
          state.ai.setToolCallSession(toolCallId, undefined);
        } else {
          // Tool has no execute function - wait for UI component to call addToolResult
          const hasToolComponent = !!state.ai.findToolComponent(toolName);
          if (hasToolComponent && state.ai.waitForToolResult) {
            try {
              await state.ai.waitForToolResult(
                sessionId,
                toolCallId,
                abortController?.signal,
              );
              state.ai.setToolCallSession(toolCallId, undefined);
            } catch (error) {
              if (addToolResult && error instanceof Error) {
                addToolResult({
                  tool: toolName,
                  toolCallId,
                  state: 'output-error',
                  errorText: error.message,
                });
              }
              throw error;
            }
          }
        }
        // If no ToolComponent, we still return (no-op) - the UI won't render anything
        // and the tool call will remain incomplete, which is fine for error handling
      } catch (error) {
        const isAbortError = error instanceof ToolAbortError;
        addToolResult?.({
          tool: toolName,
          toolCallId,
          state: 'output-error',
          errorText: isAbortError
            ? TOOL_CALL_CANCELLED
            : getErrorMessageForDisplay(error),
        });
        // ensure mapping cleared on error too
        store.getState().ai.setToolCallSession(toolCallId, undefined);
      }
    },
    onChatData: (sessionId: string, dataPart: DataUIPart<UIDataTypes>) => {
      if (
        dataPart.type === 'data-tool-additional-output' &&
        dataPart.data &&
        (dataPart.data as {toolCallId?: unknown}).toolCallId != null
      ) {
        const {toolCallId, output} = dataPart.data as {
          toolCallId: string;
          output: unknown;
        };
        if (sessionId) {
          store
            .getState()
            .ai.setSessionToolAdditionalData(sessionId, toolCallId, output);
        }
      }
    },
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
          const completedMessages = fixIncompleteToolCalls(sourceMessages);
          state.ai.setSessionUiMessages(sessionId, completedMessages);

          state.ai.setIsRunning(sessionId, false);
          state.ai.setAbortController(sessionId, undefined);

          // Ensure an analysis result exists and is marked as cancelled
          store.setState((stateToUpdate: AiSliceStateForTransport) =>
            produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
              const targetSession = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === sessionId,
              );
              if (!targetSession) return;

              const lastUserMessage = completedMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];
              if (!lastUserMessage) return;

              const promptText = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => (part as {text: string}).text)
                .join('');

              const pendingIndex = targetSession.analysisResults.findIndex(
                (result) => result.id === ANALYSIS_PENDING_ID,
              );

              if (pendingIndex !== -1) {
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  errorMessage: {error: TOOL_CALL_CANCELLED},
                  isCompleted: true,
                };
              } else {
                const existing = targetSession.analysisResults.find(
                  (r) => r.id === lastUserMessage.id,
                );
                if (!existing) {
                  targetSession.analysisResults.push({
                    id: lastUserMessage.id,
                    prompt: promptText,
                    errorMessage: {error: TOOL_CALL_CANCELLED},
                    isCompleted: true,
                  });
                }
              }
            }),
          );
          return;
        }

        // fix any incomplete tool-calls before saving (can happen with AbortController)
        const completedMessages = fixIncompleteToolCalls(messages);
        state.ai.setSessionUiMessages(sessionId, completedMessages);

        store.setState((stateToUpdate: AiSliceStateForTransport) =>
          produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === sessionId,
            );
            if (!targetSession) return;

            const lastUserMessage = completedMessages
              .filter((msg) => msg.role === 'user')
              .slice(-1)[0];

            if (lastUserMessage) {
              const promptText = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => (part as {text: string}).text)
                .join('');

              const pendingIndex = targetSession.analysisResults.findIndex(
                (result) => result.id === ANALYSIS_PENDING_ID,
              );

              if (pendingIndex !== -1) {
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  isCompleted: true,
                };
              } else {
                const existingResult = targetSession.analysisResults.find(
                  (result) => result.id === lastUserMessage.id,
                );
                if (!existingResult) {
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

        const shouldAutoSendNext = lastAssistantMessageIsCompleteWithToolCalls({
          messages: completedMessages,
        });

        const lastMessage = completedMessages[completedMessages.length - 1];
        const isLastMessageAssistant = lastMessage?.role === 'assistant';
        let tailHasTool = false;
        if (isLastMessageAssistant) {
          const parts = lastMessage?.parts ?? [];
          let lastStepStartIndex = -1;
          for (let i = parts.length - 1; i >= 0; i--) {
            if (parts[i]?.type === 'step-start') {
              lastStepStartIndex = i;
              break;
            }
          }
          const tailParts = parts.slice(lastStepStartIndex + 1);
          tailHasTool = tailParts.some(
            (part) =>
              typeof part?.type === 'string' &&
              (part.type.startsWith('tool-') || part.type === 'dynamic-tool'),
          );
        }

        const shouldEndAnalysis =
          (isLastMessageAssistant && !shouldAutoSendNext && !tailHasTool) ||
          (!shouldAutoSendNext && !isLastMessageAssistant);

        if (shouldEndAnalysis) {
          state.ai.setIsRunning(sessionId, false);
          state.ai.setAbortController(sessionId, undefined);
        }
      } catch (err) {
        console.error('onChatFinish error:', err);
        throw err;
      }
    },
    onChatError: (sessionId: string, error: unknown) => {
      try {
        let errMsg = getErrorMessageForDisplay(error);
        if (!errMsg || errMsg.trim().length === 0) {
          errMsg = 'Unknown error';
        }
        store.setState((state: AiSliceStateForTransport) =>
          produce(state, (draft: AiSliceStateForTransport) => {
            if (!sessionId) return;
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === sessionId,
            );
            if (targetSession) {
              // fix any incomplete tool-calls before saving (can happen with AbortController)
              const existingMessages = (targetSession.uiMessages ||
                []) as UIMessage[];
              targetSession.uiMessages = fixIncompleteToolCalls(
                existingMessages,
              ) as AnalysisSessionSchema['uiMessages'];

              const uiMessages = targetSession.uiMessages as UIMessage[];
              const lastUserMessage = uiMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];

              if (lastUserMessage) {
                const promptText = lastUserMessage.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => (part as {text: string}).text)
                  .join('');

                const pendingIndex = targetSession.analysisResults.findIndex(
                  (result) => result.id === ANALYSIS_PENDING_ID,
                );

                if (pendingIndex !== -1) {
                  targetSession.analysisResults[pendingIndex] = {
                    id: lastUserMessage.id,
                    prompt: promptText,
                    errorMessage: {error: errMsg},
                    isCompleted: true,
                  };
                } else {
                  const existingResult = targetSession.analysisResults.find(
                    (result) => result.id === lastUserMessage.id,
                  );

                  if (!existingResult) {
                    targetSession.analysisResults.push({
                      id: lastUserMessage.id,
                      prompt: promptText,
                      errorMessage: {error: errMsg},
                      isCompleted: true,
                    });
                  } else {
                    existingResult.errorMessage = {error: errMsg};
                  }
                }
              }
            }
          }),
        );

        store.getState().ai.setIsRunning(sessionId, false);
        store.getState().ai.setAbortController(sessionId, undefined);
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
  };
}
