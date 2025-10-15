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

type GetAiSliceState = () => AiSliceState;
type SetAiSliceState = <T>(
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: false | undefined,
  action?: string,
) => void;

export type ChatTransportConfig = {
  get: GetAiSliceState;
  defaultProvider: string;
  defaultModel: string;
  apiKey: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  getInstructions: () => string;
  /**
   * Optional: supply a pre-configured custom model.
   * e.g. import {xai} from "@ai-sdk/xai";
   * getCustomModel: () => xai('grok-4', {apiKey: 'your-api-key'})
   * If provided, this model will be used instead of the default OpenAI-compatible client.
   */
  getCustomModel?: () => LanguageModel | undefined;
};

export function createLocalChatTransportFactory({
  get,
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
      const state = get();
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

      // update the onToolCompleted handler to update the tool additional data in the store
      const onToolCompleted = (toolCallId: string, additionalData: unknown) => {
        const sessionId = get().ai.config.currentSessionId;
        if (!sessionId) return;
        get().ai.setSessionToolAdditionalData(
          sessionId,
          (prev: Record<string, unknown>) => ({
            ...prev,
            [toolCallId]: additionalData,
          }),
        );
      };

      const tools = Object.entries(state.ai.tools || {}).reduce(
        (acc: ToolSet, [name, tool]: [string, OpenAssistantTool]) => {
          acc[name] = convertToVercelAiToolV5({
            ...tool,
            onToolCompleted,
          });
          return acc;
        },
        {},
      );

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

export function createRemoteChatTransportFactory() {
  return (endpoint: string, headers?: Record<string, string>) =>
    new DefaultChatTransport({
      api: endpoint,
      credentials: 'include',
      headers,
    });
}

export function createChatHandlers({
  get,
  set,
}: {
  get: GetAiSliceState;
  set: SetAiSliceState;
}) {
  return {
    onChatToolCall: async ({toolCall}: {toolCall: unknown}) => {
      void toolCall;
      // no-op for now; UI messages are synced on finish via useChat
    },
    onChatFinish: ({
      message,
      messages,
    }: {
      message: UIMessage;
      messages: UIMessage[];
    }) => {
      try {
        void message; // kept for potential analytics; we store full messages
        const currentSessionId = get().ai.config.currentSessionId;
        if (!currentSessionId) return;
        get().ai.setSessionUiMessages(currentSessionId, messages);

        // Create analysis result with the user message ID for proper correlation
        set((state: AiSliceState) =>
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
              // Check if analysis result already exists for this user message
              const existingResult = targetSession.analysisResults.find(
                (result: any) => result.id === lastUserMessage.id,
              );

              if (!existingResult) {
                // Extract text content from user message
                const promptText = lastUserMessage.parts
                  .filter((part) => part.type === 'text')
                  .map((part) => (part as {text: string}).text)
                  .join('');

                // Create analysis result with the same ID as the user message
                targetSession.analysisResults.push({
                  id: lastUserMessage.id,
                  prompt: promptText,
                  response: [],
                  isCompleted: true,
                });
              }
            }
          }),
        );
        set((state: AiSliceState) =>
          produce(state, (draft: AiSliceState) => {
            draft.ai.isRunningAnalysis = false;
            draft.ai.analysisPrompt = '';
            draft.ai.analysisAbortController = undefined;
          }),
        );
      } catch (err) {
        console.error('onChatFinish error:', err);
      }
    },
    onChatError: (error: unknown) => {
      try {
        let errMsg = getErrorMessageForDisplay(error);
        if (!errMsg || errMsg.trim().length === 0) {
          errMsg = 'Unknown error';
        }
        const currentSessionId = get().ai.config.currentSessionId;
        set((state: AiSliceState) =>
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
                // Check if analysis result already exists for this user message
                const existingResult = targetSession.analysisResults.find(
                  (result: any) => result.id === lastUserMessage.id,
                );

                if (!existingResult) {
                  // Extract text content from user message
                  const promptText = lastUserMessage.parts
                    .filter((part: any) => part.type === 'text')
                    .map((part: any) => (part as {text: string}).text)
                    .join('');

                  // Create analysis result with the same ID as the user message
                  targetSession.analysisResults.push({
                    id: lastUserMessage.id,
                    prompt: promptText,
                    response: [],
                    errorMessage: {error: errMsg},
                    isCompleted: true,
                  });
                } else {
                  // Update existing result with error message
                  existingResult.errorMessage = {error: errMsg};
                }
              }
            }
            draft.ai.isRunningAnalysis = false;
            draft.ai.analysisAbortController = undefined;
          }),
        );
      } catch (e) {
        console.error('Failed to store chat error:', e);
      }
    },
  };
}
