import {z} from 'zod';
import {
  convertToVercelAiToolV5,
  OpenAssistantTool,
  OpenAssistantToolSet,
  ToolCache,
} from '@openassistant/utils';
import WebSearchToolResult from '@/components/WebSearchToolResult';
import {ToolSet} from 'ai';

// Define the web search tool (server side tool)
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
        datasetName: 'webSearchResults',
        webSearchResults: {
          type: 'string',
          content: `Web search results for: ${query}`,
        },
      },
    };
  },
  component: WebSearchToolResult,
};

// Define the weather tool (client side tool)
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

export const tools = {
  serverTools: [webSearchTool],
  clientTools: [weatherTool],
};

const allTools = [...tools.serverTools, ...tools.clientTools];

const toolCache = ToolCache.getInstance();

const onToolCompleted = async (toolCallId: string, additionalData: unknown) => {
  toolCache.addDataset(toolCallId, additionalData);
};

export function getServerAiSDKTools(): ToolSet {
  const aiSDKTools = allTools.reduce((acc, tool) => {
    tool.onToolCompleted = onToolCompleted;
    const converted = convertToVercelAiToolV5(tool);
    // Only keep execute function for server tools
    if (!tools.serverTools.includes(tool)) {
      // Avoid mutating a potentially non-writable `execute` property.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {execute: _execute, ...rest} = converted as unknown as Record<
        string,
        unknown
      >;
      acc[tool.name] = rest as unknown as ToolSet[string];
    } else {
      acc[tool.name] = converted;
    }
    return acc;
  }, {} as ToolSet);

  return aiSDKTools;
}

export function getClientTools(): OpenAssistantToolSet {
  return allTools.reduce((acc, tool) => {
    acc[tool.name] = tool;
    return acc;
  }, {} as OpenAssistantToolSet);
}

export function getToolAdditionalData(toolCallId: string): unknown {
  return toolCache.getDataset(toolCallId);
}
