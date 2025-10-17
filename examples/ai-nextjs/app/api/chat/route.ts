import {openai} from '@ai-sdk/openai';
import {
  streamText,
  type LanguageModel,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  convertToModelMessages,
} from 'ai';
import {
  ConversationCache,
  OpenAssistantTool,
  ToolOutputManager,
  convertToVercelAiToolV5,
} from '@openassistant/utils';
import {z} from 'zod';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

// Create a conversation cache instance with custom configuration
const conversationCache = new ConversationCache({
  maxConversations: 100,
  ttlMs: 1000 * 60 * 60 * 2, // 2 hours
  cleanupProbability: 0.1, // 10%
  enableLogging: true, // Enable logging for debugging
});

const systemPrompt = `You are a helpful assistant that can answer questions and help with tasks.`;

// Define the web search tool
const webSearchSchema = z.object({
  query: z.string().describe('The search query'),
});

const webSearchTool: OpenAssistantTool = {
  name: 'webSearch',
  description: 'Search the web for information',
  parameters: webSearchSchema,
  execute: async ({query}: any) => {
    // This is a toy implementation for demo purposes
    console.log(`Web search executed for query: ${query}`);

    return {
      llmResult: {
        success: true,
        details: `Web search results for: ${query}`,
      },
      additionalData: {
        query,
      },
    };
  },
};

function createTools(toolOutputManager: ToolOutputManager) {
  const webSearchToolWithOnToolCompleted = {
    ...webSearchTool,
    onToolCompleted: toolOutputManager.createOnToolCompletedCallback(),
  };

  return {
    webSearch: convertToVercelAiToolV5(webSearchToolWithOnToolCompleted),
  };
}

export async function POST(req: Request) {
  try {
    const {id: requestId, messages, modelProvider, model} = await req.json();

    console.log(`Processing chat request ${requestId}`, {
      modelProvider,
      model,
    });

    const toolOutputManager =
      await conversationCache.getToolOutputManager(requestId);

    const stream = createUIMessageStream({
      execute: async ({writer}) => {
        // Start a new session to track tool outputs for this specific request
        const sessionId = await toolOutputManager.startSession();

        // Log cache status for this conversation
        const cacheInfo = await toolOutputManager.getAllToolOutputs();
        console.log(
          `Conversation ${requestId}: Found ${cacheInfo.length} cached tool outputs`,
        );

        // Create all tools using the tools utility
        const tools = createTools(toolOutputManager);

        // use openai compatible client for different models
        const modelClient = createOpenAICompatible({
          apiKey: process.env.LITELLM_API_KEY,
          name: modelProvider,
          // baseURL: 'https://api.openai.com/v1',
          baseURL:
            'https://spatial-workbench-data-api-staging.foursquare.com/v1/liteLLM/v1',
        });
        const languageModel = modelClient.chatModel(model);

        const result = streamText({
          model: languageModel,
          messages: convertToModelMessages(messages),
          system: systemPrompt,
          tools,
          async onFinish({response}) {
            // Check if there are tool calls in the response
            const toolCalls = response.messages
              .filter((msg) => msg.role === 'assistant')
              .flatMap((msg: any) => msg.toolInvocations || []);

            // Get tool outputs from the session
            const toolOutputs =
              await toolOutputManager.getToolOutputsFromCurrentSession();

            console.log('Stream finished', {
              sessionId,
              messageCount: response.messages.length,
              toolCallCount: toolCalls.length,
              toolOutputCount: toolOutputs.length,
            });

            // Only write tool data to client if tools were actually called in THIS request
            const hasToolOutputsInSession =
              await toolOutputManager.hasToolOutputsInCurrentSession();
            if (hasToolOutputsInSession) {
              const lastToolData =
                await toolOutputManager.getLastToolOutputFromCurrentSession();
              if (lastToolData) {
                console.log('write toolData back to client', lastToolData);
                // Write message annotation as a data part
                writer.write({
                  type: 'data-additional-output',
                  id: generateId(),
                  data: lastToolData,
                });
              }
            }

            // End the session when request is complete
            await toolOutputManager.endSession();
          },
        });

        // Merge the streamText result into the UI message stream
        writer.merge(result.toUIMessageStream());
      },
    });

    return createUIMessageStreamResponse({stream});
  } catch (error) {
    console.error('Request processing error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {'Content-Type': 'application/json'},
      },
    );
  }
}
