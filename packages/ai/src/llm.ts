import {
  DefaultChatTransport,
  UIMessage,
  convertToModelMessages,
  streamText,
} from 'ai';
import type {LanguageModel} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {DataTable, DuckDbSliceState} from '@sqlrooms/duckdb';
import {getDefaultInstructions} from './analysis';
import {convertToVercelAiTool} from './utils';
import {produce} from 'immer';
import {getErrorMessageForDisplay} from '@sqlrooms/utils';
import type {AiSliceState, AiSliceTool} from './AiSlice';
import type {AnalysisSessionSchema as AnalysisSession} from './schemas';

type GetState = AiSliceState &
  DuckDbSliceState & {
    config: {ai: {currentSessionId?: string; sessions: AnalysisSession[]}};
  };
type GetFn = () => GetState;
type SetFn = <T>(
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: false | undefined,
  action?: string,
) => void;

export type LlmDeps = {
  get: GetFn;
  defaultProvider: string;
  defaultModel: string;
  getApiKey?: (modelProvider: string) => string;
  getBaseUrl?: () => string | undefined;
  getInstructions?: (tablesSchema: DataTable[]) => string;
  /**
   * Optional: supply a pre-configured client for a given provider, e.g. Azure created via createAzure.
   * If provided and returns a client for the active provider, it will be used to create the model
   * instead of the default OpenAI-compatible client.
   */
  getModelClientForProvider?: (
    provider: string,
  ) =>
    | ((modelId: string) => LanguageModel)
    | {chatModel: (modelId: string) => LanguageModel}
    | undefined;
};

export function createLocalChatTransportFactory({
  get,
  defaultProvider,
  defaultModel,
  getApiKey,
  getBaseUrl,
  getInstructions,
  getModelClientForProvider,
}: LlmDeps) {
  return () => {
    const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit) => {
      // Resolve provider/model and client at call time to pick up latest settings
      const state = get();
      const currentSession = state.ai.getCurrentSession();
      const provider = currentSession?.modelProvider || defaultProvider;
      const modelId = currentSession?.model || defaultModel;
      const apiKey = getApiKey?.(provider) || '';
      const baseUrl = getBaseUrl?.();

      // Prefer a user-supplied client for this provider if available
      const customClient = getModelClientForProvider?.(provider);
      let model: LanguageModel | undefined;
      if (customClient) {
        if (typeof customClient === 'function') {
          model = customClient(modelId);
        } else if (
          typeof (customClient as {chatModel?: unknown}).chatModel ===
          'function'
        ) {
          model = (
            customClient as {chatModel: (id: string) => LanguageModel}
          ).chatModel(modelId);
        }
      }
      // Fallback to OpenAI-compatible if no custom client/model resolved
      if (!model) {
        const openai = createOpenAICompatible({
          apiKey,
          name: provider,
          baseURL: baseUrl || 'https://api.openai.com/v1',
        });
        model = openai.chatModel(modelId);
      }

      const body = init?.body as string;
      const parsed = body ? JSON.parse(body) : {};
      const messagesCopy = JSON.parse(JSON.stringify(parsed.messages || []));

      // Build tool wrappers for AI SDK v5 streamText
      const onToolCompleted = (toolCallId: string, additionalData: unknown) => {
        const sessionId = get().config.ai.currentSessionId;
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
        (
          acc: Record<string, ReturnType<typeof convertToVercelAiTool>>,
          [name, tool]: [string, AiSliceTool],
        ) => {
          acc[name] = convertToVercelAiTool({
            tool,
            onToolCompleted,
          });
          return acc;
        },
        {} as Record<string, ReturnType<typeof convertToVercelAiTool>>,
      );

      // get system instructions
      const tableSchemas: DataTable[] = state.db.tables;
      const systemInstructions = getInstructions
        ? getInstructions(tableSchemas)
        : getDefaultInstructions(tableSchemas);

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

export function createChatHandlers({get, set}: {get: GetFn; set: SetFn}) {
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
        const currentSessionId = get().config.ai.currentSessionId;
        if (!currentSessionId) return;
        get().ai.setSessionUiMessages(currentSessionId, messages);
        // mark the current analysis result as completed if present
        set((state: GetState) =>
          produce(state, (draft: GetState) => {
            const targetSession = draft.config.ai.sessions.find(
              (s: AnalysisSession) => s.id === currentSessionId,
            );
            if (!targetSession) return;
            // update the last analysis result
            const lastResult = targetSession.analysisResults.slice(-1)[0];
            if (lastResult) {
              lastResult.isCompleted = true;
            }
          }),
        );
        set((state: GetState) =>
          produce(state, (draft: GetState) => {
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
        const currentSessionId = get().config.ai.currentSessionId;
        set((state: GetState) =>
          produce(state, (draft: GetState) => {
            if (!currentSessionId) return;
            const targetSession = draft.config.ai.sessions.find(
              (s: AnalysisSession) => s.id === currentSessionId,
            );
            if (targetSession) {
              const last = targetSession.analysisResults.slice(-1)[0];
              if (last) {
                last.errorMessage = {error: errMsg};
                last.isCompleted = true;
              }
            }
            draft.ai.isRunningAnalysis = false;
            draft.ai.analysisAbortController = undefined;
          }),
        );
      } catch (e) {
        console.error('Failed to store chat error:', e);
      }
      console.error('Chat error:', error);
    },
  };
}
