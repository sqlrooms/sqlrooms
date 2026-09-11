/**
 * Unit tests for the tool-call repair handler. Only `generateText` is stubbed
 * (the rest of `ai` — including `NoSuchToolError` — stays real), so the test
 * drives the re-ask logic without issuing a real model request.
 */
import {jest} from '@jest/globals';

const actualAi = await import('ai');

const generateText = jest.fn();

jest.unstable_mockModule('ai', () => ({
  ...actualAi,
  generateText,
}));

const {NoSuchToolError} = actualAi;
const {createModelToolCallRepair} =
  await import('../src/agents/createModelToolCallRepair');

const TOOL_NAME = 'create_block_document_chart_scatter_plot';

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    toolCall: {
      type: 'tool-call' as const,
      toolCallId: 'call-1',
      toolName: TOOL_NAME,
      input: '{"settings":{"x":"Depth","y":"Magnitude","size":null}}',
    },
    tools: {
      [TOOL_NAME]: {
        inputSchema: {},
        execute: jest.fn(),
        onInputAvailable: jest.fn(),
      },
    },
    error: new Error('Type validation failed: aggregate'),
    system: undefined,
    messages: [],
    ...overrides,
  } as never;
}

describe('createModelToolCallRepair', () => {
  beforeEach(() => {
    generateText.mockReset();
    generateText.mockResolvedValue({
      toolCalls: [
        {toolName: TOOL_NAME, input: {settings: {x: 'Depth', y: 'Magnitude'}}},
      ],
      totalUsage: {inputTokens: 10, outputTokens: 5, totalTokens: 15},
    } as never);
  });

  it('re-asks the model and returns the corrected call as a JSON-string input', async () => {
    const repair = createModelToolCallRepair('fake-model' as never);

    const result = await repair(makeArgs());

    expect(generateText).toHaveBeenCalledTimes(1);
    const opts = generateText.mock.calls[0][0] as Record<string, any>;
    // Repair forces a fresh call to the SAME tool.
    expect(opts.toolChoice).toEqual({type: 'tool', toolName: TOOL_NAME});
    expect(result).toEqual({
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: TOOL_NAME,
      input: JSON.stringify({settings: {x: 'Depth', y: 'Magnitude'}}),
    });
  });

  it('passes the failing tool as a schema-only definition (no execute or input-lifecycle callbacks)', async () => {
    const repair = createModelToolCallRepair('fake-model' as never);

    await repair(makeArgs());

    const opts = generateText.mock.calls[0][0] as Record<string, any>;
    const repairTool = opts.tools[TOOL_NAME];
    expect(repairTool.execute).toBeUndefined();
    expect(repairTool.onInputAvailable).toBeUndefined();
    expect(repairTool.onInputStart).toBeUndefined();
    expect(repairTool.needsApproval).toBeUndefined();
  });

  it('forwards abortSignal and providerOptions to the repair request', async () => {
    const abortSignal = new AbortController().signal;
    const providerOptions = {openai: {reasoningEffort: 'low'}};
    const repair = createModelToolCallRepair('fake-model' as never, {
      abortSignal,
      providerOptions: providerOptions as never,
    });

    await repair(makeArgs());

    const opts = generateText.mock.calls[0][0] as Record<string, any>;
    expect(opts.abortSignal).toBe(abortSignal);
    expect(opts.providerOptions).toEqual(providerOptions);
  });

  it('reports repair token usage through onRepairUsage', async () => {
    const onRepairUsage = jest.fn();
    const repair = createModelToolCallRepair('fake-model' as never, {
      onRepairUsage: onRepairUsage as never,
    });

    await repair(makeArgs());

    expect(onRepairUsage).toHaveBeenCalledWith({
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15,
    });
  });

  it('does not attempt to repair an unknown tool name', async () => {
    const repair = createModelToolCallRepair('fake-model' as never);

    const result = await repair(
      makeArgs({error: new NoSuchToolError({toolName: 'nope'} as never)}),
    );

    expect(result).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns null when the tool is not in the tool set', async () => {
    const repair = createModelToolCallRepair('fake-model' as never);

    const result = await repair(makeArgs({tools: {}}));

    expect(result).toBeNull();
    expect(generateText).not.toHaveBeenCalled();
  });

  it('returns null when the re-ask produces no corrected call', async () => {
    generateText.mockResolvedValueOnce({
      toolCalls: [],
      totalUsage: {inputTokens: 3, outputTokens: 0, totalTokens: 3},
    } as never);
    const repair = createModelToolCallRepair('fake-model' as never);

    expect(await repair(makeArgs())).toBeNull();
  });

  it('still accounts usage when the repair produced no corrected call', async () => {
    generateText.mockResolvedValueOnce({
      toolCalls: [],
      totalUsage: {inputTokens: 3, outputTokens: 0, totalTokens: 3},
    } as never);
    const onRepairUsage = jest.fn();
    const repair = createModelToolCallRepair('fake-model' as never, {
      onRepairUsage: onRepairUsage as never,
    });

    await repair(makeArgs());

    expect(onRepairUsage).toHaveBeenCalledWith({
      inputTokens: 3,
      outputTokens: 0,
      totalTokens: 3,
    });
  });

  it('surfaces the original error (returns null) when the repair request throws', async () => {
    generateText.mockRejectedValueOnce(new Error('provider down') as never);
    const repair = createModelToolCallRepair('fake-model' as never);

    expect(await repair(makeArgs())).toBeNull();
  });

  it('stops repairing the same tool after the per-tool cap and stops calling the model', async () => {
    const repair = createModelToolCallRepair('fake-model' as never, {
      maxRepairsPerTool: 2,
    });

    // First two failures for the same tool are repaired...
    expect(await repair(makeArgs())).not.toBeNull();
    expect(await repair(makeArgs())).not.toBeNull();
    expect(generateText).toHaveBeenCalledTimes(2);

    // ...the third gives up without another repair sub-request.
    expect(await repair(makeArgs())).toBeNull();
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
