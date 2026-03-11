import type {InferToolInput, InferToolOutput, ToolSet} from 'ai';
import type {ToolRenderer} from './types';

type AnyTool = ToolSet[string];

/**
 * App-level pairing of an AI SDK tool with the React renderer used to display
 * its results in the chat UI.
 */
export type ToolWithRenderer<TTool extends AnyTool> = {
  tool: TTool;
  renderer: ToolRenderer<InferToolOutput<TTool>, InferToolInput<TTool>>;
};

/**
 * Entry accepted by {@link createAiTools}.
 * Supports either a plain AI SDK tool or a tool paired with a renderer.
 */
export type AiToolEntry<TTool extends AnyTool = AnyTool> =
  | TTool
  | ToolWithRenderer<TTool>;

/**
 * Map of named tool entries accepted by {@link createAiTools}.
 */
export type AiToolEntries = Record<string, AiToolEntry>;

type ExtractTool<TEntry> =
  TEntry extends ToolWithRenderer<infer TTool>
    ? TTool
    : Extract<TEntry, AnyTool>;

export type CreateAiToolsResult<TEntries extends AiToolEntries> = {
  tools: {[K in keyof TEntries]: ExtractTool<TEntries[K]>};
  toolRenderers: {
    [K in keyof TEntries as TEntries[K] extends ToolWithRenderer<any>
      ? K
      : never]: TEntries[K] extends ToolWithRenderer<infer TTool>
      ? ToolRenderer<InferToolOutput<TTool>, InferToolInput<TTool>>
      : never;
  };
};

function isToolWithRenderer(
  entry: AiToolEntry,
): entry is ToolWithRenderer<AnyTool> {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'tool' in entry &&
    'renderer' in entry
  );
}

/**
 * Pairs a tool definition with the renderer used to display its result.
 */
export function toolWithRenderer<TTool extends AnyTool>(
  tool: TTool,
  renderer: ToolRenderer<InferToolOutput<TTool>, InferToolInput<TTool>>,
): ToolWithRenderer<TTool> {
  return {tool, renderer};
}

/**
 * Builds the `{tools, toolRenderers}` shape expected by `createAiSlice`.
 *
 * This keeps the low-level `createAiSlice({tools, toolRenderers})` API explicit
 * while letting consumers define each tool only once.
 */
export function createAiTools<TEntries extends AiToolEntries>(
  entries: TEntries,
): CreateAiToolsResult<TEntries> {
  const tools: ToolSet = {};
  const toolRenderers: Record<string, ToolRenderer<any>> = {};

  for (const [toolName, entry] of Object.entries(entries)) {
    if (isToolWithRenderer(entry)) {
      tools[toolName] = entry.tool;
      toolRenderers[toolName] = entry.renderer;
      continue;
    }

    tools[toolName] = entry;
  }

  return {
    tools: tools as CreateAiToolsResult<TEntries>['tools'],
    toolRenderers:
      toolRenderers as CreateAiToolsResult<TEntries>['toolRenderers'],
  };
}
