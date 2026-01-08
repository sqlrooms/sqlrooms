import {StoreApi} from '@sqlrooms/room-store';
import {Experimental_Agent as Agent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {AiSliceState, processAgentStream} from '@sqlrooms/ai-core';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

export function weatherAgentTool(store: StoreApi<AiSliceState>) {
  return {
    name: 'agent-weather',
    description: 'My weather agent',
    parameters: z.object({
      prompt: z.string().describe('The prompt to the agent'),
    }),
    execute: async (
      {prompt}: {prompt: string},
      options?: {toolCallId?: string; abortSignal?: AbortSignal},
    ) => {
      const state = store.getState();
      const currentSession = state.ai.getCurrentSession();
      const provider = currentSession?.modelProvider || 'openai';
      const modelId = currentSession?.model || 'gpt-4.1';

      const model = createOpenAICompatible({
        apiKey: state.ai.getApiKeyFromSettings(),
        name: provider || '',
        baseURL:
          state.ai.getBaseUrlFromSettings() || 'https://api.openai.com/v1',
      }).chatModel(modelId);

      const weatherAgent = new Agent({
        model,
        abortSignal: state.ai.getSessionAbortController(
          currentSession?.id ?? '',
        )?.signal,
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

      const agentResult = await weatherAgent.stream({
        prompt: prompt,
      });

      // Process the agent stream and get the final result
      const resultText = await processAgentStream(
        agentResult,
        store,
        options?.toolCallId || '',
      );

      return {
        llmResult: {
          success: true,
          details: resultText,
        },
      };
    },
  };
}
