/**
 * Tests for backwards compatibility with AI SDK v5 data format.
 */
import {
  UIMessageSchema,
  UIMessagePartSchema,
} from '../src/schema/UIMessageSchema';

describe('UIMessageSchema v5 compatibility', () => {
  it('should validate all v5 tool states', () => {
    const v5States = [
      {state: 'input-streaming', input: {q: 'test'}},
      {state: 'input-available', input: {q: 'test'}},
      {state: 'output-available', input: {q: 'test'}, output: {r: 1}},
      {state: 'output-error', input: {q: 'test'}, errorText: 'err'},
    ];

    for (const s of v5States) {
      const part = {type: 'tool-myTool', toolCallId: 'c1', ...s};
      expect(UIMessagePartSchema.safeParse(part).success).toBe(true);
    }
  });

  it('should validate v5 dynamic-tool states', () => {
    const part = {
      type: 'dynamic-tool',
      toolName: 'dyn',
      toolCallId: 'c1',
      state: 'output-available',
      input: {},
      output: {},
    };
    expect(UIMessagePartSchema.safeParse(part).success).toBe(true);
  });

  it('should validate complete v5 assistant message', () => {
    const msg = {
      id: 'm1',
      role: 'assistant',
      parts: [
        {type: 'text', text: 'Hello'},
        {
          type: 'tool-sql',
          toolCallId: 'c1',
          state: 'output-available',
          input: {},
          output: {},
        },
      ],
    };
    expect(UIMessageSchema.safeParse(msg).success).toBe(true);
  });

  it('should validate v6 new states (additive compatibility)', () => {
    const v6States = [
      {state: 'approval-requested', approval: {state: 'requested'}},
      {state: 'approval-responded', approval: {state: 'approved'}},
      {state: 'output-denied', approval: {state: 'denied'}},
    ];

    for (const s of v6States) {
      const part = {type: 'tool-action', toolCallId: 'c1', input: {}, ...s};
      expect(UIMessagePartSchema.safeParse(part).success).toBe(true);
    }
  });
});
