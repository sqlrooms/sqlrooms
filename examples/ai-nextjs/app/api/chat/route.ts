import {
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {getServerAiSDKTools, getToolAdditionalData} from '@/app/lib/tools';

const systemPrompt = `You are a helpful assistant that can answer questions and help with tasks.`;

export async function POST(req: Request) {
  try {
    const {id: requestId, messages, modelProvider, model} = await req.json();

    console.log(`Processing chat request ${requestId}`, {
      modelProvider,
      model,
    });

    const stream = createUIMessageStream({
      execute: async ({writer}) => {
        // use openai compatible client for different models
        const modelClient = createOpenAICompatible({
          apiKey: process.env.OPENAI_API_KEY,
          name: modelProvider,
          baseURL: 'https://api.openai.com/v1',
        });
        const languageModel = modelClient.chatModel(model);

        const modelMessages = convertToModelMessages(messages);

        const tools = getServerAiSDKTools();

        const result = streamText({
          model: languageModel,
          messages: modelMessages,
          system: systemPrompt,
          tools,
          async onChunk({chunk}) {
            switch (chunk.type) {
              case 'tool-result':
                // Send tool additional data as a data part that will be handled by onData callback
                // This data will be sent to the client but not included in UIMessages
                writer.write({
                  type: 'data-tool-additional-output',
                  transient: true, // Won't be added to message history
                  data: {
                    toolCallId: chunk.toolCallId,
                    toolName: chunk.toolName,
                    output: getToolAdditionalData(chunk.toolCallId),
                    timestamp: new Date().toISOString(),
                  },
                });
                break;
            }
          },
        });

        // Merge the streamText result into the UI message stream
        writer.merge(
          result.toUIMessageStream({
            originalMessages: messages,
            // onFinish: ({messages, responseMessage}) => {
            //   // Save the complete UIMessage array - your full source of truth
            //   saveChat({chatId, messages});
            //   // Or save just the response message
            //   saveMessage({chatId, message: responseMessage});
            // },
          }),
        );
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
