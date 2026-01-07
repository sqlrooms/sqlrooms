/**
 * Tests for backwards compatibility of utility functions with AI SDK v5 data.
 */
import {
  isToolPart,
  isDynamicToolPart,
  isTextPart,
  isReasoningPart,
} from '../src/utils';
import type {UIMessagePart} from '@sqlrooms/ai-config';

describe('Type guards v5 compatibility', () => {
  it('isToolPart works with v5 and v6 states', () => {
    const states = [
      'input-streaming',
      'input-available',
      'output-available',
      'output-error',
      'approval-requested',
    ];
    for (const state of states) {
      const part = {
        type: 'tool-x',
        toolCallId: 'c1',
        state,
        input: {},
      } as UIMessagePart;
      expect(isToolPart(part)).toBe(true);
    }
    expect(isToolPart({type: 'text', text: 'hi'} as UIMessagePart)).toBe(false);
    expect(
      isToolPart({
        type: 'dynamic-tool',
        toolName: 'x',
        toolCallId: 'c1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart),
    ).toBe(false);
  });

  it('isDynamicToolPart works with v5 format', () => {
    const part = {
      type: 'dynamic-tool',
      toolName: 'dyn',
      toolCallId: 'c1',
      state: 'output-available',
      input: {},
      output: {},
    } as UIMessagePart;
    expect(isDynamicToolPart(part)).toBe(true);
    expect(
      isDynamicToolPart({
        type: 'tool-x',
        toolCallId: 'c1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart),
    ).toBe(false);
  });

  it('isTextPart and isReasoningPart work with v5 format', () => {
    expect(isTextPart({type: 'text', text: 'hi'} as UIMessagePart)).toBe(true);
    expect(
      isReasoningPart({type: 'reasoning', text: 'think'} as UIMessagePart),
    ).toBe(true);
    expect(isTextPart({type: 'reasoning', text: 'x'} as UIMessagePart)).toBe(
      false,
    );
    expect(isReasoningPart({type: 'text', text: 'x'} as UIMessagePart)).toBe(
      false,
    );
  });
});
