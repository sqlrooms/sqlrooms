import {createAgentUIStreamResponse, stepCountIs, ToolLoopAgent} from 'ai';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';
import {getServerAiSDKTools} from '@/app/lib/tools';

const DEFAULT_INSTRUCTIONS = `You are a helpful assistant that can answer questions and help with tasks.`;
const DEFAULT_MAX_STEPS = 10;
const DEFAULT_TEMPERATURE = 0;

export async function POST(req: Request) {
  try {
    const {
      messages,
      modelProvider,
      model,
      instructions,
      maxSteps,
      temperature,
    } = await req.json();

    const modelClient = createOpenAICompatible({
      apiKey: process.env.OPENAI_API_KEY,
      name: modelProvider,
      baseURL: 'https://api.openai.com/v1',
    });
    const languageModel = modelClient.chatModel(model);

    const tools = getServerAiSDKTools();

    const agent = new ToolLoopAgent({
      model: languageModel,
      instructions: instructions || DEFAULT_INSTRUCTIONS,
      tools,
      stopWhen: stepCountIs(maxSteps ?? DEFAULT_MAX_STEPS),
      temperature: temperature ?? DEFAULT_TEMPERATURE,
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
