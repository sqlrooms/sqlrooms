import {
  createAssistant,
  rebuildMessages,
  StreamMessage,
} from '@openassistant/core';
import {convertToCoreMessages} from 'ai';
import {AiSliceTool} from './AiSlice';
import {AnalysisResultSchema} from './schemas';

/**
 * Configuration options for running an AI analysis session
 */
type AnalysisParameters = {
  /** Assistant instance identifier (default: 'sqlrooms-ai') */
  name?: string;

  /** AI model provider (e.g., 'openai', 'anthropic') */
  modelProvider: string;

  /** Model identifier (e.g., 'gpt-4', 'claude-3') */
  model: string;

  /** Authentication key for the model provider's API */
  apiKey: string;

  /** Analysis prompt or question to be processed */
  prompt: string;

  /** Optional controller for canceling the analysis operation */
  abortController?: AbortController;

  /** Maximum number of analysis steps allowed (default: 100) */
  maxSteps?: number;

  /** The history of analysis results (e.g. saved in localStorage) */
  historyAnalysis?: AnalysisResultSchema[];

  /** Tools to use in the analysis */
  tools?: Record<string, AiSliceTool>;

  /** Base URL for Ollama provider (required when modelProvider is 'ollama') */
  baseUrl?: string;

  /**
   * Function to get custom instructions for the AI assistant
   * @returns The instructions string to use
   */
  getInstructions: () => string;

  /**
   * Callback for handling streaming results
   * @param isCompleted - Indicates if this is the final message in the stream
   * @param streamMessage - Current message content being streamed
   */
  onStreamResult: (isCompleted: boolean, streamMessage?: StreamMessage) => void;
};

/**
 * Executes an AI analysis session on the room data
 *
 * @param config - Analysis configuration options. See {@link AnalysisParameters} for more details.
 * @returns Object containing tool calls executed and the final analysis result
 */
export async function runAnalysis({
  name = 'sqlrooms-ai',
  modelProvider,
  model,
  apiKey,
  prompt,
  abortController,
  historyAnalysis,
  onStreamResult,
  maxSteps = 5,
  tools = {},
  getInstructions,
  baseUrl,
}: AnalysisParameters) {
  // get the singleton assistant instance
  const assistant = await createAssistant({
    name,
    modelProvider,
    model,
    apiKey,
    version: 'v1',
    instructions: getInstructions(),
    tools: tools,
    temperature: 0,
    toolChoice: 'auto', // this will enable streaming
    maxSteps,
    ...(abortController ? {abortController} : {}),
    baseUrl, // ollama base url or LLM proxy server url
  });

  // restore ai messages from historyAnalysis?
  if (historyAnalysis) {
    const historyMessages = historyAnalysis.map((analysis) => ({
      prompt: analysis.prompt,
      response: analysis.streamMessage as StreamMessage,
    }));
    const initialMessages = rebuildMessages(historyMessages);
    assistant.setMessages(convertToCoreMessages(initialMessages));
  }

  // process the prompt
  const newMessages = await assistant.processTextMessage({
    textMessage: prompt,
    streamMessageCallback: ({
      isCompleted,
      message,
    }: {
      isCompleted?: boolean;
      message?: StreamMessage;
    }) => {
      onStreamResult(isCompleted ?? false, message);
    },
  });

  return newMessages;
}
