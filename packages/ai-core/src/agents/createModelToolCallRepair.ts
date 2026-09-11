import {
  generateText,
  NoSuchToolError,
  type LanguageModel,
  type ToolCallRepairFunction,
  type ToolSet,
} from 'ai';

/**
 * How many times a single tool may be repaired within one agent run before the
 * repair handler gives up and lets the original error surface. A model that
 * keeps emitting the same invalid call should not spend an unbounded number of
 * extra LLM requests trying to heal it.
 */
export const DEFAULT_MAX_REPAIRS_PER_TOOL = 2;

export type ModelToolCallRepairOptions = {
  /**
   * Cap on repair attempts per tool name within the returned handler's lifetime
   * (one agent run). Defaults to {@link DEFAULT_MAX_REPAIRS_PER_TOOL}.
   */
  maxRepairsPerTool?: number;
};

/**
 * Builds an `experimental_repairToolCall` handler that lets a model heal its own
 * invalid tool calls instead of crashing the (sub-)agent run.
 *
 * When the model emits tool-call arguments that fail the tool's input schema,
 * the AI SDK raises `InvalidToolInputError`. Without a repair handler that error
 * aborts the whole (sub-)agent with an opaque failure. This handler re-asks
 * `model` to fix the call: it replays the conversation with the failed tool call
 * and the validation error appended, forcing a fresh call to the SAME tool via
 * `toolChoice`. Normal tool calling is used (not structured output) because some
 * OpenAI-compatible endpoints — including Anthropic-via-LiteLLM proxies — do not
 * support the JSON response-format schema that structured output requires.
 *
 * Boundaries that keep repair safe when enabled by default:
 * - The repair sub-request is a plain `generateText` with NO repair handler of
 *   its own, so repair never recurses into repair.
 * - The failing tool is passed WITHOUT its `execute`, so regenerating the call
 *   only produces arguments and never triggers the tool's side effects.
 * - Repairs are capped per tool ({@link ModelToolCallRepairOptions.maxRepairsPerTool}),
 *   so a persistently-failing tool cannot spend unbounded extra LLM requests.
 * - The outer agent's own step limit is untouched; repair does not add steps.
 *
 * Unknown-tool errors, a missing tool, exceeding the per-tool cap, no
 * regenerated call, or any failure of the repair request return `null`, letting
 * the original error surface.
 *
 * @param model - Model used for the repair sub-request (typically the same model
 *   the agent runs on).
 * @param options - Optional tuning; see {@link ModelToolCallRepairOptions}.
 */
export function createModelToolCallRepair(
  model: LanguageModel,
  options?: ModelToolCallRepairOptions,
): ToolCallRepairFunction<ToolSet> {
  const maxRepairsPerTool =
    options?.maxRepairsPerTool ?? DEFAULT_MAX_REPAIRS_PER_TOOL;
  // Per-tool attempt counter for the lifetime of this handler (one agent run).
  const repairsByTool = new Map<string, number>();

  return async ({toolCall, tools, error, system, messages}) => {
    // A wrong tool NAME cannot be fixed by correcting arguments.
    if (NoSuchToolError.isInstance(error)) return null;

    const tool = tools[toolCall.toolName];
    if (!tool) return null;

    // Stop repairing a tool that keeps failing, so one bad call cannot fan out
    // into an unbounded series of repair sub-requests.
    const priorRepairs = repairsByTool.get(toolCall.toolName) ?? 0;
    if (priorRepairs >= maxRepairsPerTool) {
      console.warn(
        `[repairToolCall] giving up on "${toolCall.toolName}" after ${priorRepairs} repair attempt(s)`,
      );
      return null;
    }
    repairsByTool.set(toolCall.toolName, priorRepairs + 1);

    // Diagnostic: an invalid tool call reached the repair path. The raw model
    // arguments and validation error go to the console (not the parent model).
    console.warn(
      `[repairToolCall] repairing invalid call to "${toolCall.toolName}": ${error.message}`,
    );

    // `toolCall.input` is a JSON string; the assistant tool-call message part
    // expects the parsed object (providers reject a raw string here). Schema
    // validation, not JSON parsing, is what failed, so it still parses.
    let failedInput: unknown;
    try {
      failedInput =
        typeof toolCall.input === 'string'
          ? JSON.parse(toolCall.input)
          : toolCall.input;
    } catch {
      failedInput = {};
    }

    try {
      const result = await generateText({
        model,
        system,
        // Only the failing tool, and stripped of `execute` so regenerating the
        // call cannot run the tool's side effects.
        tools: {[toolCall.toolName]: {...tool, execute: undefined}},
        toolChoice: {type: 'tool', toolName: toolCall.toolName},
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                input: failedInput,
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                output: {
                  type: 'error-text',
                  value: `Your arguments failed schema validation and must be corrected: ${error.message}. Re-call the tool with corrected arguments that satisfy the schema and preserve the original intent.`,
                },
              },
            ],
          },
        ],
      });

      const fixed = result.toolCalls.find(
        (call) => call.toolName === toolCall.toolName,
      );
      if (!fixed) {
        console.warn(
          `[repairToolCall] repair of "${toolCall.toolName}" produced no corrected call`,
        );
        return null;
      }

      console.warn(
        `[repairToolCall] repaired "${toolCall.toolName}" -> ${JSON.stringify(fixed.input)}`,
      );
      return {...toolCall, input: JSON.stringify(fixed.input)};
    } catch (repairError) {
      // Repair is best-effort: on failure, let the original error surface.
      console.warn(
        `[repairToolCall] repair of "${toolCall.toolName}" failed: ${
          repairError instanceof Error
            ? repairError.message
            : String(repairError)
        }`,
      );
      return null;
    }
  };
}
