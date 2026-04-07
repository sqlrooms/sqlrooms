import {StoreApi} from '@sqlrooms/room-store';
import {ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {AiSliceState, streamSubAgent} from '@sqlrooms/ai-core';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

export function weatherAgentTool(store: StoreApi<AiSliceState>) {
  return tool({
    description: 'My weather agent',
    inputSchema: z.object({
      prompt: z.string().describe('The prompt to the agent'),
    }),
    execute: async (
      {prompt},
      options?: {toolCallId?: string; abortSignal?: AbortSignal},
    ) => {
      const state = store.getState();
      const currentSession = state.ai.getCurrentSession();
      const provider = currentSession?.modelProvider || 'openai';
      const modelId = currentSession?.model || 'gpt-5.2';

      const model = createOpenAICompatible({
        apiKey: state.ai.getApiKeyFromSettings(),
        name: provider || '',
        baseURL:
          state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
      }).chatModel(modelId);

      const weatherAgent = new ToolLoopAgent({
        model,
        tools: {
          weather: tool({
            description: 'Get the weather in a location (in Fahrenheit)',
            inputSchema: z.object({
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
              temperature: z.number().describe('Temperature in Fahrenheit'),
            }),
            execute: async ({temperature}) => {
              const celsius = Math.round((temperature - 32) * (5 / 9));
              return {celsius};
            },
          }),
        },
        stopWhen: stepCountIs(20),
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
        details: result.finalOutput,
        agentToolCalls: result.agentToolCalls,
        finalOutput: result.finalOutput,
      };
    },
  });
}
