export type OpenAssistantTool = {
  onToolCompleted?: (toolCallId: string, additionalData: unknown) => void;
};

export type OpenAssistantToolSet = Record<string, OpenAssistantTool>;

export function convertToVercelAiToolV5(tool: OpenAssistantTool) {
  return tool;
}
