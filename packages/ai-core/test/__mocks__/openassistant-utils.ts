export type OpenAssistantTool = {
  name?: string;
  description?: string;
  parameters?: unknown;
  execute?: (input: unknown, context: unknown) => unknown;
  onToolCompleted?: (toolCallId: string, additionalData: unknown) => void;
};

export type OpenAssistantToolSet = Record<string, OpenAssistantTool>;

export function convertToVercelAiToolV5(tool: OpenAssistantTool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.parameters,
    execute: async (input: unknown, context: unknown) => {
      return tool.execute?.(input, context);
    },
  };
}
