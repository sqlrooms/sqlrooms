import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';
import type {StoreApi} from '@sqlrooms/room-store';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {LanguageModel, ToolSet} from 'ai';
import {
  convertToModelMessages,
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  streamText,
  UIMessage,
} from 'ai';
import {produce} from 'immer';
import {
  AI_DEFAULT_TEMPERATURE,
  ANALYSIS_PENDING_ID,
  TOOL_CALL_CANCELLED,
} from './constants';
import type {
  AiSliceStateForTransport,
  ToolTimingEntry,
  AssistantMessageMetadata,
} from './types';
import {AddToolResult} from './types';
import {
  fixIncompleteToolCalls,
  mergeAbortSignals,
  sanitizeMessagesForLLM,
  ToolAbortError,
} from './utils';

export type ToolCall = {
  input: string;
  toolCallId: string;
  toolName: string;
  type: 'tool-input-available';
};

/**
 * Write tool timings from the store into assistant message metadata so they
 * survive serialization.
 */
function writeToolTimingsToMetadata(
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
      if (entry) {
        timings[id] = entry;
      }
    }

    if (Object.keys(timings).length > 0) {
      const existing = (msg.metadata ?? {}) as AssistantMessageMetadata;
      msg.metadata = {
        ...existing,
        toolTimings: {...existing.toolTimings, ...timings},
      };
    }
  }
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
};

function getSessionById(
  store: StoreApi<AiSliceStateForTransport>,
  sessionId: string | undefined,
): AnalysisSessionSchema | undefined {
  if (!sessionId) return undefined;

  const sessions = store.getState().ai.config.sessions;
  const session = sessions.find(
    (s: AnalysisSessionSchema) => s.id === sessionId,
  );

  if (!session) {
    return undefined;
  }

  if (session.id !== sessionId) {
    return undefined;
  }

  return session;
}

export function createLocalChatTransportFactory({
  sessionId,
  store,
  defaultProvider,
  defaultModel,
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

      // Resolve provider/model/apiKey/baseUrl at call time to pick up latest settings.
      const state = store.getState();
      const sessionFromBody = getSessionById(store, sessionId);
      const provider = sessionFromBody?.modelProvider || defaultProvider;
      const modelId = sessionFromBody?.model || defaultModel;

      // Fetch API key and base URL dynamically to pick up settings changes
      const apiKey = state.ai.getApiKeyFromSettings();
      const baseUrl = state.ai.getBaseUrlFromSettings();

      // Prefer a user-supplied model if available
      let model: LanguageModel | undefined = getCustomModel?.();

      // Fallback to OpenAI-compatible if no custom model provided
      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl ?? 'https://api.openai.com/v1',
          headers,
        });
        model = openai.chatModel(modelId);
      }

      const messagesCopy = Array.isArray(parsedObj.messages)
        ? (parsedObj.messages as UIMessage[])
        : [];

      // Clone tools without execute for the model call.
      // Tool invocations are handled exclusively by onChatToolCall.
      // Cast: state.ai.tools holds real AI SDK tools behind StoredToolSet.
      const tools = Object.fromEntries(
        Object.entries(state.ai.tools || {}).map(([name, t]) => [
          name,
          {...t, execute: undefined},
        ]),
      ) as ToolSet;

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
        messages: convertToModelMessages(sanitizeMessagesForLLM(messagesCopy)),
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

        const tool = state.ai.tools[toolName];
        if (tool?.execute) {
          const sessionMessages = (session?.uiMessages ?? []) as UIMessage[];
          const startedAt = Date.now();
          state.ai.setToolTiming(toolCallId, {startedAt});

          const result = await tool.execute(input, {
            toolCallId,
            messages: convertToModelMessages(
              sanitizeMessagesForLLM(sessionMessages),
            ),
            abortSignal: abortController?.signal,
          });

          const completedAt = Date.now();
          state.ai.setToolTiming(toolCallId, {startedAt, completedAt});

          addToolResult?.({
            tool: toolName,
            toolCallId,
            output: result,
          });
          state.ai.setToolCallSession(toolCallId, undefined);
        } else {
          // Tool has no execute function - wait for UI component to call addToolResult
          const hasToolRenderer = !!state.ai.findToolRenderer(toolName);
          if (hasToolRenderer && state.ai.waitForToolResult) {
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
          writeToolTimingsToMetadata(
            completedMessages,
            state.ai.getToolTimings(),
          );
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
        writeToolTimingsToMetadata(
          completedMessages,
          state.ai.getToolTimings(),
        );
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

        // Detect API key errors (401/403 or common error messages)
        const isApiKeyError = isAuthenticationError(error, errMsg);
        if (isApiKeyError) {
          const session = getSessionById(store, sessionId);
          const provider = session?.modelProvider || 'openai';
          store.getState().ai.setApiKeyError(provider, true);
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
