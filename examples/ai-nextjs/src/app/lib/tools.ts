import {z} from 'zod';
import {tool, ToolSet} from 'ai';
import type {ToolRendererRegistry} from '@sqlrooms/ai-core';
import WebSearchToolResult from '@/components/WebSearchToolResult';

// Define the web search tool (server side tool)
const webSearchTool = tool({
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({query}) => {
    // This is a toy implementation for demo purposes
    console.log(`Web search executed for query: ${query}`);

    return {
      success: true,
      details: `Web search results for: ${query}`,
    };
  },
});

// Define the weather tool (client side tool - no execute on server)
const weatherTool = tool({
  description: 'Get the weather in a city from a weather station',
  inputSchema: z.object({
    cityName: z.string().describe('The name of the city'),
  }),
  execute: async ({cityName}) => {
    return {
      success: true,
      details: `The weather in ${cityName} is sunny.`,
    };
  },
});

const allTools = {
  webSearch: webSearchTool,
  weather: weatherTool,
};

export function getServerAiSDKTools(): ToolSet {
  // Return all tools but strip execute from client-only tools
  return {
    webSearch: allTools.webSearch,
    weather: {
      ...allTools.weather,
      execute: undefined,
    },
  } as ToolSet;
}

export function getClientTools(): ToolSet {
  return allTools;
}

export function getClientToolRenderers(): ToolRendererRegistry {
  return {
    webSearch: WebSearchToolResult,
  };
}
