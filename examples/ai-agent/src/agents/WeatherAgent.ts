import {StoreApi} from '@sqlrooms/room-store';
import {LanguageModel, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {AiSliceState, streamSubAgent} from '@sqlrooms/ai-core';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

/**
 * Helper to resolve the current model from the store.
 */
function getModel(store: StoreApi<AiSliceState>): LanguageModel {
  const state = store.getState();
  const currentSession = state.ai.getCurrentSession();
  const provider = currentSession?.modelProvider || 'openai';
  const modelId = currentSession?.model || 'gpt-4.1';

  return createOpenAICompatible({
    apiKey: state.ai.getApiKeyFromSettings(),
    name: provider || '',
    baseURL: state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
  }).chatModel(modelId);
}

// ---------------------------------------------------------------------------
// Simple agent: weather lookup + unit conversion
// ---------------------------------------------------------------------------

export function weatherAgentTool(store: StoreApi<AiSliceState>) {
  return tool({
    description:
      'An agent that retrieves the current weather for one or more locations and can convert temperatures between Fahrenheit and Celsius. Call both tools in sequence to get the weather and the temperature conversion.',
    inputSchema: z.object({
      reasoning: z
        .string()
        .describe('Reasoning for why this tool is being called'),
      prompt: z.string().describe('The prompt to the weather agent'),
    }),
    execute: async (
      {prompt},
      options?: {toolCallId?: string; abortSignal?: AbortSignal},
    ) => {
      const weatherAgent = new ToolLoopAgent({
        model: getModel(store),
        tools: {
          weather: tool({
            description: 'Get the weather in a location (in Fahrenheit)',
            inputSchema: z.object({
              reasoning: z
                .string()
                .describe('Reasoning for why this tool is being called'),
              location: z
                .string()
                .describe('The location to get the weather for'),
            }),
            execute: async ({location}) => ({
              location,
              temperature: 72 + Math.floor(Math.random() * 21) - 10,
            }),
          }),
          convertFahrenheitToCelsius: tool({
            description: 'Convert temperature from Fahrenheit to Celsius',
            inputSchema: z.object({
              reasoning: z
                .string()
                .describe('Reasoning for why this tool is being called'),
              temperature: z.number().describe('Temperature in Fahrenheit'),
            }),
            execute: async ({temperature}) => ({
              celsius: Math.round((temperature - 32) * (5 / 9)),
            }),
          }),
        },
        stopWhen: stepCountIs(10),
      });

      const result = await streamSubAgent(
        weatherAgent,
        prompt,
        store,
        options?.toolCallId || '',
        options?.abortSignal,
      );

      return {
        success: true,
        finalOutput: result.finalOutput,
      };
    },
  });
}
