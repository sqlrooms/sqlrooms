import {createAgentUIStreamResponse, stepCountIs, ToolLoopAgent} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {getServerAiSDKTools} from '@/app/lib/tools';

const DEFAULT_INSTRUCTIONS = `You are a helpful assistant that can answer questions and help with tasks.`;
const DEFAULT_MAX_STEPS = 10;
const DEFAULT_TEMPERATURE = 0;

export async function POST(req: Request) {
  try {
    // Security: only accept messages, modelProvider, and model from the client.
    // instructions, maxSteps, and temperature are server-controlled to prevent
    // malicious clients from overriding the system prompt or resource limits.
    const {messages, modelProvider, model} = await req.json();

    const modelClient = createOpenAICompatible({
      apiKey: process.env.OPENAI_API_KEY,
      name: modelProvider,
      baseURL: 'https://api.openai.com/v1',
    });
    const languageModel = modelClient.chatModel(model);

    const tools = getServerAiSDKTools();

    const agent = new ToolLoopAgent({
      model: languageModel,
      instructions: DEFAULT_INSTRUCTIONS,
      tools,
      stopWhen: stepCountIs(DEFAULT_MAX_STEPS),
      temperature: DEFAULT_TEMPERATURE,
    });

    return createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      abortSignal: req.signal,
    });
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
