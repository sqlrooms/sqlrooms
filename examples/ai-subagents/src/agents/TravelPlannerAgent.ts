import {StoreApi} from '@sqlrooms/room-store';
import {LanguageModel, ToolLoopAgent, stepCountIs, tool} from 'ai';
import {z} from 'zod';
import {AiSliceState, streamSubAgent} from '@sqlrooms/ai-core';
import {createOpenAICompatible} from '@ai-sdk/openai-compatible';

// ---------------------------------------------------------------------------
// Schema for the hotel booking tool (exported for use in the renderer)
// ---------------------------------------------------------------------------

export const bookHotelInputSchema = z.object({
  reasoning: z.string().describe('Reasoning for why this tool is being called'),
  hotelName: z.string().describe('Name of the hotel to book'),
  city: z.string().describe('City where the hotel is located'),
  checkIn: z.string().describe('Check-in date, e.g. "2025-08-01"'),
  checkOut: z.string().describe('Check-out date, e.g. "2025-08-03"'),
  pricePerNight: z.number().describe('Price per night in USD'),
});

export type BookHotelInput = z.infer<typeof bookHotelInputSchema>;

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
// Sub-agent: weather lookup + unit conversion
// ---------------------------------------------------------------------------

export function weatherAgentTool(store: StoreApi<AiSliceState>) {
  return tool({
    description:
      'An agent that retrieves the current weather for one or more locations and can convert temperatures between Fahrenheit and Celsius.',
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

// ---------------------------------------------------------------------------
// Sub-agent: activity / point-of-interest suggestions
// ---------------------------------------------------------------------------

export function activitiesAgentTool(store: StoreApi<AiSliceState>) {
  return tool({
    description:
      'An agent that suggests activities and points of interest for a given location.',
    inputSchema: z.object({
      reasoning: z
        .string()
        .describe('Reasoning for why this tool is being called'),
      prompt: z.string().describe('The prompt to the activities agent'),
    }),
    execute: async (
      {prompt},
      options?: {toolCallId?: string; abortSignal?: AbortSignal},
    ) => {
      const activitiesAgent = new ToolLoopAgent({
        model: getModel(store),
        tools: {
          searchAttractions: tool({
            description:
              'Search for popular attractions and things to do in a city',
            inputSchema: z.object({
              reasoning: z
                .string()
                .describe('Reasoning for why this tool is being called'),
              city: z.string().describe('City name to search attractions for'),
              category: z
                .enum(['outdoors', 'culture', 'food', 'nightlife', 'family'])
                .optional()
                .describe('Optional category filter'),
            }),
            execute: async ({city, category}) => {
              const attractions: Record<string, string[]> = {
                outdoors: ['Hiking trail', 'Botanical garden', 'Beach walk'],
                culture: ['Art museum', 'Historic district tour', 'Theater'],
                food: ['Food market', 'Cooking class', 'Wine tasting'],
                nightlife: ['Jazz club', 'Rooftop bar', 'Comedy show'],
                family: ['Zoo', 'Science museum', 'Amusement park'],
              };
              const cats = category
                ? [category]
                : (Object.keys(attractions) as (keyof typeof attractions)[]);
              return {
                city,
                suggestions: cats.flatMap((c) =>
                  (attractions[c] ?? []).map((a) => ({
                    name: `${a} in ${city}`,
                    category: c,
                  })),
                ),
              };
            },
          }),
          getEventCalendar: tool({
            description: 'Get upcoming events in a city for the next 7 days',
            inputSchema: z.object({
              reasoning: z
                .string()
                .describe('Reasoning for why this tool is being called'),
              city: z.string().describe('City to look up events for'),
            }),
            execute: async ({city}) => ({
              city,
              events: [
                {name: 'Music Festival', date: 'Saturday', type: 'music'},
                {name: 'Street Food Fair', date: 'Sunday', type: 'food'},
                {name: 'Art Walk', date: 'Friday', type: 'culture'},
              ],
            }),
          }),
        },
        stopWhen: stepCountIs(10),
      });

      const result = await streamSubAgent(
        activitiesAgent,
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

// ---------------------------------------------------------------------------
// Approval-gated tool: hotel booking (needsApproval)
// ---------------------------------------------------------------------------

/**
 * A tool that requires explicit user approval before executing.
 *
 * When the LLM decides to call this tool the agent loop pauses, the UI
 * receives an `approval-requested` state, and the tool only runs once the
 * user confirms. If the user denies, the tool is skipped with an
 * `output-denied` state.
 *
 * A matching `toolRenderer` is required so the UI can show the approval
 * prompt — see the `BookHotelApprovalRenderer` component registered in
 * `store.ts`.
 */
export function bookHotelTool() {
  return tool({
    description:
      'Book a hotel room for the given dates. This tool is approval-gated: the ' +
      'system will automatically prompt the user for confirmation before executing.',
    inputSchema: bookHotelInputSchema,
    needsApproval: true,
    execute: async ({hotelName, city, checkIn, checkOut, pricePerNight}) => {
      const nights =
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
        (1000 * 60 * 60 * 24);
      const total = nights * pricePerNight;
      const confirmationCode = `HTL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      return {
        confirmationCode,
        hotelName,
        city,
        checkIn,
        checkOut,
        nights,
        totalPrice: total,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Sub-agent: hotel booking (wraps bookHotel + searchHotels)
// Demonstrates needsApproval flowing from a sub-tool inside a sub-agent.
// ---------------------------------------------------------------------------

export function hotelBookingAgentTool(store: StoreApi<AiSliceState>) {
  return tool({
    description:
      'An agent that searches for hotels and books rooms. The booking step ' +
      'requires user approval before it is executed (needsApproval demo).',
    inputSchema: z.object({
      reasoning: z
        .string()
        .describe('Reasoning for why this tool is being called'),
      prompt: z
        .string()
        .describe(
          'The hotel booking request, e.g. "Find and book a hotel in Tokyo for Aug 1-3"',
        ),
    }),
    execute: async (
      {prompt},
      options?: {toolCallId?: string; abortSignal?: AbortSignal},
    ) => {
      const hotelAgent = new ToolLoopAgent({
        model: getModel(store),
        instructions:
          'You are a hotel booking assistant. First use searchHotels to find ' +
          'available options, then immediately call bookHotel to reserve a room. ' +
          'Do NOT ask the user to confirm — the system handles approval automatically. ' +
          'Always pick the best matching hotel from the search results and book it.',
        tools: {
          searchHotels: tool({
            description:
              'Search for available hotels in a city for given dates',
            inputSchema: z.object({
              reasoning: z
                .string()
                .describe('Reasoning for why this tool is being called'),
              city: z.string().describe('City to search hotels in'),
              checkIn: z.string().describe('Check-in date, e.g. "2025-08-01"'),
              checkOut: z
                .string()
                .describe('Check-out date, e.g. "2025-08-03"'),
            }),
            execute: async ({city, checkIn, checkOut}) => ({
              city,
              checkIn,
              checkOut,
              hotels: [
                {name: `Grand ${city} Hotel`, pricePerNight: 189, rating: 4.5},
                {name: `${city} Budget Inn`, pricePerNight: 79, rating: 3.8},
                {
                  name: `The ${city} Luxury Suites`,
                  pricePerNight: 349,
                  rating: 4.9,
                },
              ],
            }),
          }),
          bookHotel: bookHotelTool(),
        },
        stopWhen: stepCountIs(10),
      });

      const result = await streamSubAgent(
        hotelAgent,
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

// ---------------------------------------------------------------------------
// Top-level agent: travel planner that delegates to sub-agents
// ---------------------------------------------------------------------------

export function travelPlannerAgentTool(store: StoreApi<AiSliceState>) {
  return tool({
    description:
      'A travel planning agent that coordinates weather checks, activity suggestions, ' +
      'and hotel booking to create a comprehensive travel plan. It delegates to ' +
      'weather, activities, and hotel booking sub-agents.',
    inputSchema: z.object({
      reasoning: z
        .string()
        .describe('Reasoning for why this tool is being called'),
      prompt: z
        .string()
        .describe(
          'The travel planning request, e.g. "Plan a weekend trip to San Francisco"',
        ),
    }),
    execute: async (
      {prompt},
      options?: {toolCallId?: string; abortSignal?: AbortSignal},
    ) => {
      const travelAgent = new ToolLoopAgent({
        model: getModel(store),
        instructions:
          'You are a travel planner. Use the checkWeather tool to look up weather, ' +
          'the findActivities tool to discover things to do, and the bookHotel tool ' +
          'to reserve accommodation. Always call bookHotel when the user requests ' +
          'hotel booking — do NOT ask the user to choose or confirm, the system ' +
          'handles approval automatically. Combine the results to produce a concise travel plan.',
        tools: {
          checkWeather: weatherAgentTool(store),
          findActivities: activitiesAgentTool(store),
          bookHotel: hotelBookingAgentTool(store),
        },
        stopWhen: stepCountIs(10),
      });

      const result = await streamSubAgent(
        travelAgent,
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
