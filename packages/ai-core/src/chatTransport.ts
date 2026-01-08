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
import {ToolAbortError} from './utils';
import {AI_DEFAULT_TEMPERATURE} from './constants';

/**
 * Validates and completes UIMessages to ensure all tool-call parts have corresponding tool-result parts.
 * This is important when canceling with AbortController, which may leave incomplete tool-calls.
 * Assumes sequential tool execution (only one tool runs at a time).
 *
 * @param messages - The messages to validate and complete
 * @returns Cleaned messages with completed tool-call/result pairs
 */
export function completeIncompleteToolCalls(
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant' || !message.parts) {
      return message;
    }

    // Walk backward and complete any TRAILING tool parts that lack output.
    // This covers multi-tool-step aborts where several tool calls were started
    // but the stream was cancelled before the outputs were emitted.
    type ToolPart = {
      type: string;
      toolCallId: string;
      toolName?: string;
      input?: unknown;
      state?: string;
    };
    const isToolPart = (part: unknown): part is ToolPart => {
      if (typeof part !== 'object' || part === null) return false;
      const p = part as Record<string, unknown> & {type?: unknown};
      const typeVal =
        typeof p.type === 'string' ? (p.type as string) : undefined;
      return (
        !!typeVal &&
        'toolCallId' in p &&
        (typeVal === 'dynamic-tool' || typeVal.startsWith('tool-'))
      );
    };

    const updatedParts = [...message.parts];
    let sawAnyTool = false;
    for (let i = updatedParts.length - 1; i >= 0; i--) {
      const current = updatedParts[i] as unknown;
      if (!isToolPart(current)) {
        // Stop once we exit the trailing tool region
        if (sawAnyTool) break;
        continue;
      }
      sawAnyTool = true;
      const toolPart = current as ToolPart;
      const hasOutput = toolPart.state?.startsWith('output');
      if (hasOutput) {
        // Completed tool; continue checking earlier parts just in case
        continue;
      }

      // Synthesize a completed error result for the incomplete tool call
      const base = {
        toolCallId: toolPart.toolCallId,
        state: 'output-error' as const,
        input: toolPart.input ?? {},
        errorText: 'Operation cancelled by user',
        providerExecuted: false,
      };

      const syntheticPart =
        toolPart.type === 'dynamic-tool'
          ? {
              type: 'dynamic-tool' as const,
              toolName: toolPart.toolName || 'unknown',
              ...base,
            }
          : {type: toolPart.type as string, ...base};

      updatedParts[i] =
        syntheticPart as unknown as (typeof message.parts)[number];
    }

    return {
      ...message,
      parts: updatedParts,
    };
  });
}

export type ToolCall = {
  input: string;
  toolCallId: string;
  toolName: string;
  type: 'tool-input-available';
};

export type ChatTransportConfig = {
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
) {
  return (toolCallId: string, additionalData: unknown) => {
    const sessionId = store.getState().ai.config.currentSessionId;
    if (!sessionId) return;

    store
      .getState()
      .ai.setSessionToolAdditionalData(sessionId, toolCallId, additionalData);
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
  // Fallback: derive from useChat request id when we embed sessionId as `${sessionId}::${revision}`
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
    s.addEventListener('abort', abort, {once: true});
  }
  return controller.signal;
}

export function createOnToolCompletedHandlerForSession(
  store: StoreApi<AiSliceStateForTransport>,
  sessionId: string,
) {
  return (toolCallId: string, additionalData: unknown) => {
    if (!sessionId) return;
    store.getState().ai.setSessionToolAdditionalData(sessionId, toolCallId, additionalData);
  };
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
  store,
  defaultProvider,
  defaultModel,
  apiKey,
  baseUrl,
  headers,
  getInstructions,
  getCustomModel,
}: ChatTransportConfig) {
  return createLocalChatTransportFactoryForSession({
    store,
    defaultProvider,
    defaultModel,
    apiKey,
    baseUrl,
    headers,
    getInstructions,
    getCustomModel,
  });
}

export function createLocalChatTransportFactoryForSession({
  store,
  defaultProvider,
  defaultModel,
  apiKey,
  baseUrl,
  headers,
  getInstructions,
  getCustomModel,
  sessionId,
}: ChatTransportConfig & {sessionId?: string}) {
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
      const parsedObj = (parsed as {messages?: unknown; sessionId?: unknown}) || {};
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

      const onToolCompleted = requestSessionId
        ? createOnToolCompletedHandlerForSession(store, requestSessionId)
        : createOnToolCompletedHandler(store);
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
        ? state.ai.getSessionAbortController(requestSessionId)?.signal
        : state.ai.getCurrentSession()?.id
          ? state.ai.getSessionAbortController(state.ai.getCurrentSession()!.id)
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
}) {
  return createRemoteChatTransportFactoryForSession(params);
}

export function createRemoteChatTransportFactoryForSession(
  params: {
    store: StoreApi<AiSliceStateForTransport>;
    defaultProvider: string;
    defaultModel: string;
  },
  sessionId?: string,
) {
  return (endpoint: string, headers?: Record<string, string>) => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Get current session's model and provider at request time
      const state = params.store.getState();

      // Parse the existing body and add model information (defensive parsing)
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        parsed = {};
      }

      const requestSessionId = sessionId || getSessionIdFromRequestBody(parsed);
      const sessionFromBody = getSessionById(params.store, requestSessionId);
      const currentSession = state.ai.getCurrentSession();
      const session = sessionFromBody || currentSession;

      const modelProvider =
        session?.modelProvider || params.defaultProvider;
      const model = session?.model || params.defaultModel;

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
        ? state.ai.getSessionAbortController(requestSessionId)?.signal
        : currentSession?.id
          ? state.ai.getSessionAbortController(currentSession.id)?.signal
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
  const resolveSessionId = (sessionIdOverride?: string) =>
    sessionIdOverride || store.getState().ai.config.currentSessionId;

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
        const currentSession = state.ai.getCurrentSession();
        const currentSessionId = currentSession?.id;
        if (currentSessionId) {
          state.ai.setToolCallSession(toolCallId, currentSessionId);
        }

        // Check if the stream was aborted before executing tool
        const abortController = currentSessionId
          ? state.ai.getSessionAbortController(currentSessionId)
          : undefined;
        if (abortController?.signal.aborted) {
          if (addToolResult) {
            addToolResult({
              tool: toolName,
              toolCallId,
              state: 'output-error',
              errorText: 'Operation cancelled by user',
            });
          }
          return;
        }

        const onToolCompleted = createOnToolCompletedHandler(store);
        const tools = convertToAiSDKTools(
          state.ai.tools || {},
          onToolCompleted,
        );

        // find tool from tools using toolName
        const tool = tools[toolName];
        if (tool && state.ai.tools[toolName]?.execute && tool.execute) {
          // Always provide a defined messages array to the tool runtime
          const sessionMessages = (currentSession?.uiMessages ??
            []) as UIMessage[];
          const llmResult = await tool.execute(input, {
            toolCallId,
            messages: convertToModelMessages(sessionMessages),
            abortSignal: abortController?.signal,
          });

          if (addToolResult) {
            // Note: When using sendAutomaticallyWhen, avoid awaiting addToolResult to prevent deadlocks
            addToolResult({
              tool: toolName,
              toolCallId,
              output: llmResult,
            });
          }
          // execution finished; clear mapping
          state.ai.setToolCallSession(toolCallId, undefined);
        } else {
          // Tool has no execute function - wait for UI component to call addToolResult
          // Check if there's a ToolComponent for this tool
          const hasToolComponent = !!state.ai.findToolComponent(toolName);
          if (hasToolComponent && state.ai.waitForToolResult) {
            try {
              // Wait for the UI component to call addToolResult
              if (!currentSessionId) {
                throw new Error('No active session found for tool result');
              }
              await state.ai.waitForToolResult(
                currentSessionId,
                toolCallId,
                abortController?.signal,
              );
            } catch (error) {
              // If waiting was cancelled or failed, ensure we add an error result
              if (addToolResult && error instanceof Error) {
                addToolResult({
                  tool: toolName,
                  toolCallId,
                  state: 'output-error',
                  errorText: error.message,
                });
              }
              // Re-throw to let the outer catch handle it
              throw error;
            }
          }
          // If no ToolComponent, we still return (no-op) - the UI won't render anything
          // and the tool call will remain incomplete, which is fine for error handling
        }
      } catch (error) {
        // Check if this is an abort error
        const isAbortError = error instanceof ToolAbortError;

        if (addToolResult) {
          addToolResult({
            tool: toolName,
            toolCallId,
            state: 'output-error',
            errorText: isAbortError
              ? 'Operation cancelled by user'
              : getErrorMessageForDisplay(error),
          });
        }
      }
    },
    onChatToolCallForSession: async (
      sessionId: string,
      {
        toolCall,
        addToolResult,
      }: {
        toolCall: ToolCall;
        addToolResult?: AddToolResult;
      },
    ) => {
      const {input, toolCallId, toolName} = toolCall;
      try {
        const state = store.getState();
        const session = getSessionById(store, sessionId);
        state.ai.setToolCallSession(toolCallId, sessionId);

        const abortController = sessionId
          ? state.ai.getSessionAbortController(sessionId)
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

        const onToolCompleted = createOnToolCompletedHandlerForSession(
          store,
          sessionId,
        );
        const tools = convertToAiSDKTools(state.ai.tools || {}, onToolCompleted);

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
        try {
          store.getState().ai.setToolCallSession(toolCallId, undefined);
        } catch {
          // no-op
        }
      }
    },
    onChatData: (dataPart: DataUIPart<UIDataTypes>) => {
      if (
        dataPart.type === 'data-tool-additional-output' &&
        dataPart.data &&
        (dataPart.data as {toolCallId?: unknown}).toolCallId != null
      ) {
        const {toolCallId, output} = dataPart.data as {
          toolCallId: string;
          output: unknown;
        };

        // Store the additional data in the session
        const currentSessionId = resolveSessionId();
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
    onChatDataForSession: (sessionId: string, dataPart: DataUIPart<UIDataTypes>) => {
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
          store.getState().ai.setSessionToolAdditionalData(sessionId, toolCallId, output);
        }
      }
    },
    onChatFinish: ({messages}: {messages: UIMessage[]}) => {
      try {
        const currentSessionId = resolveSessionId();
        if (!currentSessionId) return;

        const state = store.getState();
        const abortController =
          state.ai.getSessionAbortController(currentSessionId);

        // If the analysis has been aborted, force-complete and clean up immediately
        const aborted = !!abortController?.signal.aborted;
        if (aborted) {
          // If messages are empty (possible when stopping immediately), fall back to existing session messages
          const sessionMessages =
            (getSessionById(store, currentSessionId)?.uiMessages as UIMessage[]) ||
            [];
          const sourceMessages =
            messages && messages.length > 0 ? messages : sessionMessages;

          const completedMessages = completeIncompleteToolCalls(sourceMessages);
          state.ai.setSessionUiMessages(currentSessionId, completedMessages);

          // Update per-session state
          state.ai.setSessionIsRunningAnalysis(currentSessionId, false);
          state.ai.setSessionAbortController(currentSessionId, undefined);

          // Ensure an analysis result exists and is marked as cancelled
          store.setState((stateToUpdate: AiSliceStateForTransport) =>
            produce(stateToUpdate, (draft: AiSliceStateForTransport) => {
              const targetSession = draft.ai.config.sessions.find(
                (s: AnalysisSessionSchema) => s.id === currentSessionId,
              );
              if (!targetSession) return;

              // Find the last user message
              const lastUserMessage = completedMessages
                .filter((msg) => msg.role === 'user')
                .slice(-1)[0];
              if (!lastUserMessage) return;

              const promptText = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => (part as {text: string}).text)
                .join('');

              const pendingIndex = targetSession.analysisResults.findIndex(
                (result) => result.id === '__pending__',
              );

              if (pendingIndex !== -1) {
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  errorMessage: {error: 'Operation cancelled by user'},
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
                    errorMessage: {error: 'Operation cancelled by user'},
                    isCompleted: true,
                  });
                }
              }
            }),
          );
          return;
        }

        // Complete any incomplete tool-calls before saving (can happen with AbortController)
        const completedMessages = completeIncompleteToolCalls(messages);

        store
          .getState()
          .ai.setSessionUiMessages(currentSessionId, completedMessages);

        // Create or update analysis result with the user message ID for proper correlation
        store.setState((state: AiSliceStateForTransport) =>
          produce(state, (draft: AiSliceStateForTransport) => {
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === currentSessionId,
            );
            if (!targetSession) return;

            // Find the last user message to get its ID and prompt
            const lastUserMessage = completedMessages
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
                (result) => result.id === '__pending__',
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
                  (result) => result.id === lastUserMessage.id,
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

        // Determine if SDK wants to auto-send a follow-up turn (i.e., more steps pending)
        const shouldAutoSendNext = lastAssistantMessageIsCompleteWithToolCalls({
          messages: completedMessages,
        });

        // Step-aware completion: look only at parts after the most recent step-start
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

        // End analysis when there is no autosend and there are no pending tool parts
        // even if the assistant didn't emit additional text (e.g., tool-only tails).
        const shouldEndAnalysis =
          (isLastMessageAssistant && !shouldAutoSendNext && !tailHasTool) ||
          (!shouldAutoSendNext && !isLastMessageAssistant);

        if (shouldEndAnalysis) {
          // Update per-session state
          store
            .getState()
            .ai.setSessionIsRunningAnalysis(currentSessionId, false);
          store
            .getState()
            .ai.setSessionAbortController(currentSessionId, undefined);
        }
      } catch (err) {
        console.error('onChatFinish error:', err);
        throw err;
      }
    },
    onChatFinishForSession: (
      sessionId: string,
      {messages}: {messages: UIMessage[]},
    ) => {
      // Delegate to onChatFinish with an override resolved by closure.
      // We inline the minimal necessary override behavior by temporarily resolving sessionId.
      const currentSessionId = sessionId;
      if (!currentSessionId) return;
      try {
        const state = store.getState();
        const abortController =
          state.ai.getSessionAbortController(currentSessionId);

        const aborted = !!abortController?.signal.aborted;
        if (aborted) {
          const sessionMessages =
            (getSessionById(store, currentSessionId)?.uiMessages as UIMessage[]) ||
            [];
          const sourceMessages =
            messages && messages.length > 0 ? messages : sessionMessages;
          const completedMessages = completeIncompleteToolCalls(sourceMessages);
          state.ai.setSessionUiMessages(currentSessionId, completedMessages);

          state.ai.setSessionIsRunningAnalysis(currentSessionId, false);
          state.ai.setSessionAbortController(currentSessionId, undefined);

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
                (result) => result.id === '__pending__',
              );

              if (pendingIndex !== -1) {
                targetSession.analysisResults[pendingIndex] = {
                  id: lastUserMessage.id,
                  prompt: promptText,
                  errorMessage: {error: 'Operation cancelled by user'},
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
                    errorMessage: {error: 'Operation cancelled by user'},
                    isCompleted: true,
                  });
                }
              }
            }),
          );
          return;
        }

        const completedMessages = completeIncompleteToolCalls(messages);
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
                (result) => result.id === '__pending__',
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
          state.ai.setSessionIsRunningAnalysis(currentSessionId, false);
          state.ai.setSessionAbortController(currentSessionId, undefined);
        }
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
        const currentSessionId = resolveSessionId();
        store.setState((state: AiSliceStateForTransport) =>
          produce(state, (draft: AiSliceStateForTransport) => {
            if (!currentSessionId) return;
            const targetSession = draft.ai.config.sessions.find(
              (s: AnalysisSessionSchema) => s.id === currentSessionId,
            );
            if (targetSession) {
              // Ensure message structure is valid even on errors
              const existingMessages = (targetSession.uiMessages ||
                []) as UIMessage[];
              targetSession.uiMessages = completeIncompleteToolCalls(
                existingMessages,
              ) as unknown as AnalysisSessionSchema['uiMessages'];

              // Find the last user message to create analysis result with correct ID
              const uiMessages = targetSession.uiMessages as UIMessage[];
              const lastUserMessage = uiMessages
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
                  (result) => result.id === '__pending__',
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
                    (result) => result.id === lastUserMessage.id,
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
          }),
        );

        // Update per-session state outside the produce block
        if (currentSessionId) {
          store
            .getState()
            .ai.setSessionIsRunningAnalysis(currentSessionId, false);
          store
            .getState()
            .ai.setSessionAbortController(currentSessionId, undefined);
        }
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
    onChatErrorForSession: (sessionId: string, error: unknown) => {
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
              const existingMessages = (targetSession.uiMessages ||
                []) as UIMessage[];
              targetSession.uiMessages = completeIncompleteToolCalls(
                existingMessages,
              ) as unknown as AnalysisSessionSchema['uiMessages'];

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
                  (result) => result.id === '__pending__',
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
          store.getState().ai.setSessionIsRunningAnalysis(currentSessionId, false);
          store
            .getState()
            .ai.setSessionAbortController(currentSessionId, undefined);
        }
      } catch (err) {
        console.error('Failed to store chat error:', err);
        throw err;
      }
    },
  };
}
