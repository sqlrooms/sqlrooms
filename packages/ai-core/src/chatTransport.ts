import {
  DefaultChatTransport,
  UIMessage,
  convertToModelMessages,
  streamText,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import type {DataUIPart, LanguageModel} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {produce} from 'immer';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';
import {AddToolResult} from './types';
import type {AiSliceStateForTransport} from './types';
import type {StoreApi} from '@sqlrooms/room-store';
import {ToolAbortError} from './utils';
import {AI_DEFAULT_TEMPERATURE} from './constants';

export type CustomUIDataType = {
  'tool-additional-output': {toolCallId: string; output: unknown};
};

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
      const state = store.getState();
      const currentSession = state.ai.getCurrentSession();
      const provider = currentSession?.modelProvider || defaultProvider;
      const modelId = currentSession?.model || defaultModel;

      let model: LanguageModel | undefined = getCustomModel?.();

      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl || 'https://api.openai.com/v1',
          headers,
        });
        model = openai.chatModel(modelId);
      }

      // Parse caller-supplied body defensively to avoid breaking the stream
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        parsed = {};
      }
      const parsedObj = (parsed as {messages?: unknown}) || {};
      const messagesCopy = Array.isArray(parsedObj.messages)
        ? (parsedObj.messages as UIMessage[])
        : [];

      // const onToolCompleted = createOnToolCompletedHandler(store);
      const tools = state.ai.tools;

      // Build a non-mutating toolset for the model call.
      // Tool invocations are handled exclusively by onChatToolCall, so we omit `execute` here.
      const toolsForModel = Object.fromEntries(
        Object.entries(tools).map(([name, tool]) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const {execute: _execute, ...rest} = tool as unknown as Record<
            string,
            unknown
          >;
          return [name, rest];
        }),
      ) as typeof tools;

      const systemInstructions = getInstructions();

      const result = streamText({
        model,
        messages: convertToModelMessages(messagesCopy),
        tools: toolsForModel,
        system: systemInstructions,
        abortSignal: state.ai.analysisAbortController?.signal,
        temperature: AI_DEFAULT_TEMPERATURE,
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
  return (endpoint: string, headers?: Record<string, string>) => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      // Get current session's model and provider at request time
      const state = params.store.getState();
      const currentSession = state.ai.getCurrentSession();
      const modelProvider =
        currentSession?.modelProvider || params.defaultProvider;
      const model = currentSession?.model || params.defaultModel;

      // Parse the existing body and add model information (defensive parsing)
      const body = init?.body as string;
      let parsed: unknown = {};
      try {
        parsed = body ? JSON.parse(body) : {};
      } catch {
        parsed = {};
      }

      const parsedObj =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>)
          : {};
      const enhancedBody = {
        ...parsedObj,
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

export function createChatHandlers({
  store,
}: {
  store: StoreApi<AiSliceStateForTransport>;
}) {
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

        // Check if the stream was aborted before executing tool
        if (state.ai.analysisAbortController?.signal.aborted) {
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

        const tool = state.ai.tools[toolName];
        if (tool && state.ai.tools[toolName]?.execute && tool.execute) {
          const sessionMessages = (state.ai.getCurrentSession()?.uiMessages ??
            []) as UIMessage[];
          const llmResult = await tool.execute(input, {
            toolCallId,
            messages: convertToModelMessages(sessionMessages),
            abortSignal: state.ai.analysisAbortController?.signal,
          });

          if (addToolResult) {
            // Note: When using sendAutomaticallyWhen, avoid awaiting addToolResult to prevent deadlocks
            addToolResult({
              tool: toolName,
              toolCallId,
              output: llmResult,
            });
          }
        } else {
          // Tool has no execute function - wait for UI component to call addToolResult
          // Check if there's a ToolComponent for this tool
          const hasToolComponent = !!state.ai.findToolComponent(toolName);
          if (hasToolComponent && state.ai.waitForToolResult) {
            try {
              // Wait for the UI component to call addToolResult
              await state.ai.waitForToolResult(
                toolCallId,
                state.ai.analysisAbortController?.signal,
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
    // when data-tool-additional-output data part is received from server side from server side from server side
    onChatData: (dataPart: DataUIPart<CustomUIDataType>) => {
      if (
        dataPart.type === 'data-tool-additional-output' &&
        dataPart.data &&
        (dataPart.data as {toolCallId?: unknown}).toolCallId != null
      ) {
        const {toolCallId, output} = dataPart.data as {
          toolCallId: string;
          output: unknown;
        };
        // NOTE: This used to persist per-tool-call additional output into session state.
        // The current public session schema no longer exposes a dedicated field for it,
        // so we keep the hook as a no-op (while preserving type-level wiring).
        void toolCallId;
        void output;
      }
    },
    onChatFinish: ({messages}: {messages: UIMessage[]}) => {
      try {
        const currentSessionId = store.getState().ai.config.currentSessionId;
        if (!currentSessionId) return;

        // If the analysis has been aborted, force-complete and clean up immediately
        const aborted =
          !!store.getState().ai.analysisAbortController?.signal.aborted;
        if (aborted) {
          // If messages are empty (possible when stopping immediately), fall back to existing session messages
          const sessionMessages = (store.getState().ai.getCurrentSession()
            ?.uiMessages ?? []) as UIMessage[];
          const sourceMessages =
            messages && messages.length > 0 ? messages : sessionMessages;

          const completedMessages = completeIncompleteToolCalls(sourceMessages);
          store
            .getState()
            .ai.setSessionUiMessages(currentSessionId, completedMessages);

          // Ensure an analysis result exists and is marked as cancelled
          store.setState((state) =>
            produce(state, (draft) => {
              draft.ai.isRunningAnalysis = false;
              draft.ai.analysisAbortController = undefined;

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
        store.setState((state) =>
          produce(state, (draft) => {
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
          store.setState((state) =>
            produce(state, (draft) => {
              draft.ai.isRunningAnalysis = false;
              draft.ai.analysisPrompt = '';
              draft.ai.analysisAbortController = undefined;
            }),
          );
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
        const currentSessionId = store.getState().ai.config.currentSessionId;
        store.setState((state) =>
          produce(state, (draft) => {
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
