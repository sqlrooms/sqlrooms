/**
 * Tests for backwards compatibility of chatTransport functions with AI SDK v5 data.
 *
 * This test file contains a copy of the completeIncompleteToolCalls function
 * to avoid ESM/CommonJS module resolution issues with the full chatTransport module.
 */

// Simplified type for testing purposes
type UIMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: Array<Record<string, unknown>>;
};

/**
 * Copy of completeIncompleteToolCalls for isolated testing.
 * This avoids importing the full chatTransport module which has many dependencies.
 */
function completeIncompleteToolCalls(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== 'assistant' || !message.parts) {
      return message;
    }

    type ToolPart = {
      type: string;
      toolCallId: string;
      toolName?: string;
      input?: unknown;
      state?: string;
    };

    const isToolPart = (part: unknown): part is ToolPart => {
      if (typeof part !== 'object' || part === null) return false;
      const p = part as Record<string, unknown> & {type?: unknown};
      const typeVal =
        typeof p.type === 'string' ? (p.type as string) : undefined;
      return (
        !!typeVal &&
        'toolCallId' in p &&
        (typeVal === 'dynamic-tool' || typeVal.startsWith('tool-'))
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
      const toolPart = current as ToolPart;
      const hasOutput = toolPart.state?.startsWith('output');
      if (hasOutput) {
        continue;
      }

      const base = {
        toolCallId: toolPart.toolCallId,
        state: 'output-error' as const,
        input: toolPart.input ?? {},
        errorText: 'Operation cancelled by user',
        providerExecuted: false,
      };

      const syntheticPart =
        toolPart.type === 'dynamic-tool'
          ? {
              type: 'dynamic-tool' as const,
              toolName: toolPart.toolName || 'unknown',
              ...base,
            }
          : {type: toolPart.type as string, ...base};

      updatedParts[i] =
        syntheticPart as unknown as (typeof message.parts)[number];
    }

    return {...message, parts: updatedParts};
  });
}

describe('completeIncompleteToolCalls v5 compatibility', () => {
  describe('v5 tool states', () => {
    it('should not modify completed v5 output-available tool calls', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-myTool',
              toolCallId: 'call-1',
              state: 'output-available',
              input: {query: 'test'},
              output: {result: 'success'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-available',
        output: {result: 'success'},
      });
    });

    it('should not modify completed v5 output-error tool calls', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-myTool',
              toolCallId: 'call-1',
              state: 'output-error',
              input: {query: 'test'},
              errorText: 'Original error',
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Original error',
      });
    });

    it('should complete v5 input-streaming tool calls with output-error', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-myTool',
              toolCallId: 'call-1',
              state: 'input-streaming',
              input: {query: 'test'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Operation cancelled by user',
      });
    });

    it('should complete v5 input-available tool calls with output-error', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-myTool',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {query: 'test'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Operation cancelled by user',
      });
    });
  });

  describe('v5 dynamic-tool states', () => {
    it('should not modify completed v5 dynamic-tool output-available', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'dynamicTool',
              toolCallId: 'call-1',
              state: 'output-available',
              input: {param: 'value'},
              output: {data: 'result'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        state: 'output-available',
      });
    });

    it('should complete v5 dynamic-tool input-available with output-error', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'dynamicTool',
              toolCallId: 'call-1',
              state: 'input-available',
              input: {param: 'value'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts[0]).toMatchObject({
        type: 'dynamic-tool',
        toolName: 'dynamicTool',
        state: 'output-error',
        errorText: 'Operation cancelled by user',
      });
    });
  });

  describe('v6 new states', () => {
    it('should not modify completed v6 output-denied tool calls', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-dangerousAction',
              toolCallId: 'call-1',
              state: 'output-denied',
              input: {action: 'delete'},
              approval: {state: 'denied'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      // output-denied starts with 'output', so should not be modified
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-denied',
      });
    });

    it('should complete v6 approval-requested tool calls with output-error', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-dangerousAction',
              toolCallId: 'call-1',
              state: 'approval-requested',
              input: {action: 'delete'},
              approval: {state: 'requested'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      // approval-requested doesn't start with 'output', so should be completed
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Operation cancelled by user',
      });
    });

    it('should complete v6 approval-responded tool calls with output-error', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {
              type: 'tool-dangerousAction',
              toolCallId: 'call-1',
              state: 'approval-responded',
              input: {action: 'delete'},
              approval: {state: 'approved'},
            },
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      // approval-responded doesn't start with 'output', so should be completed
      expect(result[0].parts[0]).toMatchObject({
        state: 'output-error',
        errorText: 'Operation cancelled by user',
      });
    });
  });

  describe('mixed messages', () => {
    it('should handle v5 messages with text and tool parts', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          parts: [
            {type: 'text', text: 'Let me analyze that.'},
            {
              type: 'tool-analyze',
              toolCallId: 'call-1',
              state: 'output-available',
              input: {sql: 'SELECT *'},
              output: {rows: 100},
            },
            {type: 'text', text: 'Found 100 rows.'},
          ],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result[0].parts).toHaveLength(3);
      expect(result[0].parts[0]).toMatchObject({type: 'text'});
      expect(result[0].parts[1]).toMatchObject({state: 'output-available'});
      expect(result[0].parts[2]).toMatchObject({type: 'text'});
    });

    it('should not modify user messages', () => {
      const messages: UIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          parts: [{type: 'text', text: 'Hello'}],
        },
      ];

      const result = completeIncompleteToolCalls(messages);
      expect(result).toEqual(messages);
    });
  });
});
