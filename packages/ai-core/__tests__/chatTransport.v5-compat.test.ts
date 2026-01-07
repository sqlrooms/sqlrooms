/**
 * Tests for backwards compatibility of completeIncompleteToolCalls with AI SDK v5 data.
 * Contains a copy of the function to avoid ESM module resolution issues.
 */

type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<Record<string, unknown>>;
};

// Copy of completeIncompleteToolCalls for isolated testing
function completeIncompleteToolCalls(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant' || !message.parts) return message;

    type ToolPart = {
      type: string;
      toolCallId: string;
      toolName?: string;
      input?: unknown;
      state?: string;
    };
    const isToolPart = (part: unknown): part is ToolPart => {
      if (typeof part !== 'object' || part === null) return false;
      const p = part as Record<string, unknown>;
      const t = typeof p.type === 'string' ? p.type : '';
      return (
        !!t &&
        'toolCallId' in p &&
        (t === 'dynamic-tool' || t.startsWith('tool-'))
      );
    };

    const updatedParts = [...message.parts];
    let sawAnyTool = false;
    for (let i = updatedParts.length - 1; i >= 0; i--) {
      const current = updatedParts[i] as unknown;
      if (!isToolPart(current)) {
        if (sawAnyTool) break;
        continue;
      }
      sawAnyTool = true;
      if (current.state?.startsWith('output')) continue;

      const base = {
        toolCallId: current.toolCallId,
        state: 'output-error' as const,
        input: current.input ?? {},
        errorText: 'Operation cancelled by user',
        providerExecuted: false,
      };
      updatedParts[i] =
        current.type === 'dynamic-tool'
          ? {
              type: 'dynamic-tool' as const,
              toolName: current.toolName || 'unknown',
              ...base,
            }
          : {type: current.type, ...base};
    }
    return {...message, parts: updatedParts};
  });
}

describe('completeIncompleteToolCalls v5 compatibility', () => {
  it('should not modify v5 completed states (output-*)', () => {
    const msg: UIMessage = {
      id: 'm1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-x',
          toolCallId: 'c1',
          state: 'output-available',
          input: {},
          output: {},
        },
      ],
    };
    const result = completeIncompleteToolCalls([msg]);
    expect(result[0].parts[0]).toMatchObject({state: 'output-available'});
  });

  it('should complete v5 incomplete states (input-*) with output-error', () => {
    for (const state of ['input-streaming', 'input-available']) {
      const msg: UIMessage = {
        id: 'm1',
        role: 'assistant',
        parts: [{type: 'tool-x', toolCallId: 'c1', state, input: {}}],
      };
      const result = completeIncompleteToolCalls([msg]);
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Operation cancelled by user',
      });
    }
  });

  it('should handle v6 new states correctly', () => {
    // output-denied should not be modified (starts with output)
    const denied: UIMessage = {
      id: 'm1',
      role: 'assistant',
      parts: [
        {type: 'tool-x', toolCallId: 'c1', state: 'output-denied', input: {}},
      ],
    };
    expect(completeIncompleteToolCalls([denied])[0].parts[0]).toMatchObject({
      state: 'output-denied',
    });

    // approval-* should be completed
    const approval: UIMessage = {
      id: 'm2',
      role: 'assistant',
      parts: [
        {
          type: 'tool-x',
          toolCallId: 'c1',
          state: 'approval-requested',
          input: {},
        },
      ],
    };
    expect(completeIncompleteToolCalls([approval])[0].parts[0]).toMatchObject({
      state: 'output-error',
    });
  });

  it('should handle v5 dynamic-tool parts', () => {
    const msg: UIMessage = {
      id: 'm1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolName: 'dyn',
          toolCallId: 'c1',
          state: 'input-available',
          input: {},
        },
      ],
    };
    const result = completeIncompleteToolCalls([msg]);
    expect(result[0].parts[0]).toMatchObject({
      type: 'dynamic-tool',
      toolName: 'dyn',
      state: 'output-error',
    });
  });
});
