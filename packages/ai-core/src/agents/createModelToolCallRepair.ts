import {
  generateText,
  NoSuchToolError,
  type LanguageModel,
  type LanguageModelUsage,
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
   * (one agent run — see {@link createModelToolCallRepair}). Defaults to
   * {@link DEFAULT_MAX_REPAIRS_PER_TOOL}.
   */
  maxRepairsPerTool?: number;
  /**
   * Abort signal for the repair sub-request. Pass the same signal the outer run
   * uses so stopping the chat (or a run/idle timeout) also cancels a pending
   * repair request instead of leaving it running and billable.
   */
  abortSignal?: AbortSignal;
  /**
   * Provider options for the repair sub-request. Pass the same options the outer
   * run uses so the repair inherits caching/reasoning/tool-call configuration
   * rather than falling back to provider defaults.
   */
  providerOptions?: Parameters<typeof generateText>[0]['providerOptions'];
  /**
   * Called with the token usage of each repair sub-request that runs, so callers
   * can fold repair cost into the session's reported usage (the outer agent only
   * accounts for its own steps).
   */
  onRepairUsage?: (usage: LanguageModelUsage) => void;
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
 * - The failing tool is passed as a schema-only definition (no `execute` and no
 *   input-lifecycle/approval callbacks), so regenerating the call only produces
 *   arguments and never triggers the tool's side effects.
 * - Repairs are capped per tool ({@link ModelToolCallRepairOptions.maxRepairsPerTool}),
 *   so a persistently-failing tool cannot spend unbounded extra LLM requests.
 * - The outer agent's own step limit is untouched; repair does not add steps.
 * - The repair sub-request honors {@link ModelToolCallRepairOptions.abortSignal},
 *   so cancelling the run cancels a pending repair.
 *
 * The returned handler is single-run: its per-tool counter lives in the closure,
 * so construct a fresh handler for each agent run (both first-party call sites —
 * the local chat transport and Desktop's per-invocation sub-agents — do exactly
 * that).
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
  const {abortSignal, providerOptions, onRepairUsage} = options ?? {};
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

    // Diagnostic only. Do NOT log the validation error text or the regenerated
    // arguments: they can carry user data, and the original error still surfaces
    // to the caller when repair returns null.
    console.warn(
      `[repairToolCall] repairing invalid arguments for "${toolCall.toolName}"`,
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

    // Schema-only copy of the failing tool: no `execute` AND no input-lifecycle
    // or approval callbacks, so producing the repaired call cannot run any tool
    // side effects (`onInputAvailable`, approval prompts, etc.).
    const schemaOnlyTool = {
      ...tool,
      execute: undefined,
      onInputStart: undefined,
      onInputDelta: undefined,
      onInputAvailable: undefined,
      needsApproval: undefined,
    };

    try {
      const result = await generateText({
        model,
        system,
        abortSignal,
        ...(providerOptions ? {providerOptions} : {}),
        tools: {[toolCall.toolName]: schemaOnlyTool},
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

      // Account for the repair request's tokens even if it produced no usable
      // call, so session usage does not undercount repaired turns. Isolated from
      // the repair boundary: a throwing caller callback must NOT discard an
      // otherwise-valid repaired call or swallow the original error.
      if (result.totalUsage && onRepairUsage) {
        try {
          onRepairUsage(result.totalUsage);
        } catch {
          console.warn(
            `[repairToolCall] onRepairUsage callback threw for "${toolCall.toolName}"`,
          );
        }
      }

      const fixed = result.toolCalls.find(
        (call) => call.toolName === toolCall.toolName,
      );
      if (!fixed) {
        console.warn(
          `[repairToolCall] repair of "${toolCall.toolName}" produced no corrected call`,
        );
        return null;
      }

      console.warn(`[repairToolCall] repaired "${toolCall.toolName}"`);
      return {...toolCall, input: JSON.stringify(fixed.input)};
    } catch {
      // Repair is best-effort: on failure, let the original error surface. The
      // repair error itself is intentionally not logged (it may carry payloads).
      console.warn(
        `[repairToolCall] repair request for "${toolCall.toolName}" failed`,
      );
      return null;
    }
  };
}
