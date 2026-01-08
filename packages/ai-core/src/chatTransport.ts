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
import {ToolAbortError, fixIncompleteToolCalls} from './utils';
import {
  ABORT_EVENT,
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
    const currentSessionId =
      sessionId || store.getState().ai.config.currentSessionId;
    if (!currentSessionId) return;

    store
      .getState()
      .ai.setSessionToolAdditionalData(
        currentSessionId,
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

function getSessionIdFromRequestBody(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.sessionId === 'string' && obj.sessionId.length > 0) {
    return obj.sessionId;
  }
  // derive sessionId from useChat request id when we embed it as `${sessionId}::${revision}`
  if (typeof obj.id === 'string') {
    const id = obj.id;
    const delimiter = '::';
    const idx = id.indexOf(delimiter);
    if (idx > 0) return id.slice(0, idx);
  }
  return undefined;
}

function mergeAbortSignals(
  signals: Array<AbortSignal | undefined>,
): AbortSignal | undefined {
  const present = signals.filter(Boolean) as AbortSignal[];
  if (present.length === 0) return undefined;
  if (present.length === 1) return present[0];

  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort();
  };

  for (const s of present) {
    if (s.aborted) {
      abort();
      break;
    }
    // once:true to avoid accumulating listeners on long-lived signals
    s.addEventListener(ABORT_EVENT, abort, {once: true});
  }
  return controller.signal;
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
      const parsedObj =
        (parsed as {messages?: unknown; sessionId?: unknown}) || {};
      const requestSessionId = sessionId || getSessionIdFromRequestBody(parsed);

      // Resolve provider/model and client at call time to pick up latest settings.
      // IMPORTANT: scope to the session that owns this request, not the currentSessionId
      // (users may switch sessions while a stream is in-flight).
      const state = store.getState();
      const sessionFromBody = getSessionById(store, requestSessionId);
      const currentSession = state.ai.getCurrentSession();
      const session = sessionFromBody || currentSession;
      const provider = session?.modelProvider || defaultProvider;
      const modelId = session?.model || defaultModel;

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

      const messagesCopy = Array.isArray(parsedObj.messages)
        ? (parsedObj.messages as UIMessage[])
        : [];

      const onToolCompleted = createOnToolCompletedHandler(
        store,
        requestSessionId,
      );
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
      const sessionAbortSignal = requestSessionId
        ? state.ai.getAbortController(requestSessionId)?.signal
        : state.ai.getCurrentSession()?.id
          ? state.ai.getAbortController(state.ai.getCurrentSession()!.id)
              ?.signal
          : undefined;
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
  sessionId?: string;
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

      const requestSessionId = sessionId || getSessionIdFromRequestBody(parsed);
      const sessionFromBody = getSessionById(store, requestSessionId);
      const currentSession = state.ai.getCurrentSession();
      const session = sessionFromBody || currentSession;

      const modelProvider = session?.modelProvider || defaultProvider;
      const model = session?.model || defaultModel;

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
      const sessionAbortSignal = requestSessionId
        ? state.ai.getAbortController(requestSessionId)?.signal
        : currentSession?.id
          ? state.ai.getAbortController(currentSession.id)?.signal
          : undefined;
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
            errorText: 'Operation cancelled by user',
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
            ? 'Operation cancelled by user'
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
      // Delegate to onChatFinish with an override resolved by closure.
      // We inline the minimal necessary override behavior by temporarily resolving sessionId.
      const currentSessionId = sessionId;
      if (!currentSessionId) return;
      try {
        const state = store.getState();
        const abortController = state.ai.getAbortController(currentSessionId);

        // check if the analysis has been aborted, force-complete and clean up immediately
        const aborted = !!abortController?.signal.aborted;
        if (aborted) {
          const sessionMessages =
            (getSessionById(store, currentSessionId)
              ?.uiMessages as UIMessage[]) || [];
          const sourceMessages =
            messages && messages.length > 0 ? messages : sessionMessages;
          const completedMessages = fixIncompleteToolCalls(sourceMessages);
          state.ai.setSessionUiMessages(currentSessionId, completedMessages);

          state.ai.setIsRunningAnalysis(currentSessionId, false);
          state.ai.setAbortController(currentSessionId, undefined);

          // Ensure an analysis result exists and is marked as cancelled
          store.setState((stateToUpdate: AiSliceStateForTransport) =>
            produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
              const targetSession = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === currentSessionId,
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
        state.ai.setSessionUiMessages(currentSessionId, completedMessages);

        store.setState((stateToUpdate: AiSliceStateForTransport) =>
          produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === currentSessionId,
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
          state.ai.setIsRunningAnalysis(currentSessionId, false);
          state.ai.setAbortController(currentSessionId, undefined);
        }
      } catch (err) {
        console.error('onChatFinish error:', err);
        throw err;
      }
    },
    onChatError: (sessionId: string, error: unknown) => {
      // Reuse the existing logic but scoped to sessionId
      const currentSessionId = sessionId;
      try {
        let errMsg = getErrorMessageForDisplay(error);
        if (!errMsg || errMsg.trim().length === 0) {
          errMsg = 'Unknown error';
        }
        store.setState((state: AiSliceStateForTransport) =>
          produce(state, (draft: AiSliceStateForTransport) => {
            if (!currentSessionId) return;
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === currentSessionId,
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

        if (currentSessionId) {
          store.getState().ai.setIsRunningAnalysis(currentSessionId, false);
          store.getState().ai.setAbortController(currentSessionId, undefined);
        }
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
  };
}
