import {z} from 'zod';
import {
  convertToVercelAiToolV5,
  OpenAssistantTool,
  OpenAssistantToolSet,
  ToolCache,
} from '@openassistant/utils';
import WebSearchToolResult from '@/components/WebSearchToolResult';
import {ToolSet} from 'ai';

// Define the web search tool
const webSearchSchema = z.object({
  query: z.string().describe('The search query'),
});

// open questions
// testings
// ui,

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
        datasetName: 'webSearchResults',
        webSearchResults: {
          type: 'string',
          content: `Web search results for: ${query}`,
        },
      },
    };
  },
  component: WebSearchToolResult,
  // @ts-ignore TODO: fix this
  isServerTool: true,
};

// Define the weather tool
const weatherSchema = z.object({
  cityName: z.string().describe('The name of the city'),
});

const weatherTool: OpenAssistantTool = {
  name: 'weather',
  description: 'Get the weather in a city from a weather station',
  parameters: weatherSchema,
  execute: async ({cityName}: any) => {
    return {
      llmResult: {
        success: true,
        details: `The weather in ${cityName} is sunny.`,
      },
      additionalData: {
        datasetName: 'weatherResults',
        weatherResults: {
          type: 'string',
          content: `The weather in ${cityName} is sunny.`,
        },
      },
    };
  },
};

export const tools = [webSearchTool, weatherTool];

const toolCache = ToolCache.getInstance();

const onToolCompleted = async (toolCallId: string, additionalData: unknown) => {
  toolCache.addDataset(toolCallId, additionalData);
};

export function getServerAiSDKTools(): ToolSet {
  const aiSDKTools = tools.reduce((acc, tool) => {
    tool.onToolCompleted = onToolCompleted;
    acc[tool.name] = convertToVercelAiToolV5(tool);
    // @ts-ignore TODO: fix this
    if (!tool.isServerTool) {
      acc[tool.name].execute = undefined;
    }
    return acc;
  }, {} as ToolSet);

  return aiSDKTools;
}

export function getClientTools(): OpenAssistantToolSet {
  // @ts-ignore TODO: fix this
  const clientTools = tools;
  return clientTools.reduce((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {} as OpenAssistantToolSet);
}

export function getToolAdditionalData(toolCallId: string): unknown {
  return toolCache.getDataset(toolCallId);
}
