import type {UIMessage} from 'ai';
import {fixIncompleteToolCalls} from '../src/utils';
import {TOOL_CALL_CANCELLED} from '../src/constants';

type AnyPart = Record<string, unknown>;

function assistantMessage(parts: AnyPart[]): UIMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    parts: parts as UIMessage['parts'],
  };
}

describe('fixIncompleteToolCalls', () => {
  it('clears partial input on a cancelled output-error tool part', () => {
    // Reproduces the real-world bug: a `query` tool call cancelled while its
    // input was still streaming, so only the partial `reasoning` field arrived
    // and the required `sqlQuery` was never emitted.
    const messages = [
      assistantMessage([
        {type: 'step-start'},
        {
          type: 'tool-query',
          toolCallId: 'tooluse_partial',
          state: 'output-error',
          input: {reasoning: 'Analyze the distribution of land use types'},
          errorText: TOOL_CALL_CANCELLED,
          providerExecuted: false,
        },
      ]),
    ];

    const [fixed] = fixIncompleteToolCalls(messages);
    const part = fixed.parts[1] as AnyPart;

    expect(part.state).toBe('output-error');
    // input must be undefined so the AI SDK skips schema validation
    expect(part.input).toBeUndefined();
    // the partial input is preserved under rawInput
    expect(part.rawInput).toEqual({
      reasoning: 'Analyze the distribution of land use types',
    });
    expect(part.errorText).toBe(TOOL_CALL_CANCELLED);
  });

  it('preserves existing rawInput when present', () => {
    const messages = [
      assistantMessage([
        {
          type: 'tool-query',
          toolCallId: 'tooluse_raw',
          state: 'output-error',
          input: undefined,
          rawInput: 'not valid json {',
          errorText: 'bad input',
        },
      ]),
    ];

    const [fixed] = fixIncompleteToolCalls(messages);
    const part = fixed.parts[0] as AnyPart;

    // input was already undefined, so it stays undefined and rawInput is kept
    expect(part.input).toBeUndefined();
    expect(part.rawInput).toBe('not valid json {');
  });

  it('synthesizes an output-error result for an in-flight (input-streaming) tool call', () => {
    const messages = [
      assistantMessage([
        {
          type: 'tool-query',
          toolCallId: 'tooluse_inflight',
          state: 'input-streaming',
          input: {reasoning: 'partial only'},
        },
      ]),
    ];

    const [fixed] = fixIncompleteToolCalls(messages);
    const part = fixed.parts[0] as AnyPart;

    expect(part.state).toBe('output-error');
    expect(part.input).toBeUndefined();
    expect(part.rawInput).toEqual({reasoning: 'partial only'});
    expect(part.errorText).toBe(TOOL_CALL_CANCELLED);
  });

  it('leaves completed (output-available) tool parts untouched', () => {
    const messages = [
      assistantMessage([
        {
          type: 'tool-query',
          toolCallId: 'tooluse_ok',
          state: 'output-available',
          input: {sqlQuery: 'SELECT 1'},
          output: {success: true},
        },
      ]),
    ];

    const [fixed] = fixIncompleteToolCalls(messages);
    const part = fixed.parts[0] as AnyPart;

    expect(part.state).toBe('output-available');
    expect(part.input).toEqual({sqlQuery: 'SELECT 1'});
    expect(part.output).toEqual({success: true});
  });

  it('handles dynamic-tool parts the same way', () => {
    const messages = [
      assistantMessage([
        {
          type: 'dynamic-tool',
          toolName: 'agent-h3-hub-analysis',
          toolCallId: 'tooluse_dyn',
          state: 'input-streaming',
          input: {prompt: 'partial'},
        },
      ]),
    ];

    const [fixed] = fixIncompleteToolCalls(messages);
    const part = fixed.parts[0] as AnyPart;

    expect(part.type).toBe('dynamic-tool');
    expect(part.toolName).toBe('agent-h3-hub-analysis');
    expect(part.state).toBe('output-error');
    expect(part.input).toBeUndefined();
    expect(part.rawInput).toEqual({prompt: 'partial'});
  });
});
