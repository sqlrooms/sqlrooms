/**
 * Tests for backwards compatibility with AI SDK v5 data format.
 * These tests ensure that persisted v5 UIMessage data can be loaded
 * and validated with the v6 schema.
 */

import {
  UIMessageSchema,
  UIMessagePartSchema,
} from '../src/schema/UIMessageSchema';

describe('UIMessageSchema v5 compatibility', () => {
  describe('ToolUIPart states', () => {
    it('should validate v5 input-streaming state', () => {
      const v5ToolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-123',
        state: 'input-streaming',
        input: {query: 'test'},
      };

      const result = UIMessagePartSchema.safeParse(v5ToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v5 input-available state', () => {
      const v5ToolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-123',
        state: 'input-available',
        input: {query: 'test'},
      };

      const result = UIMessagePartSchema.safeParse(v5ToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v5 output-available state', () => {
      const v5ToolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-123',
        state: 'output-available',
        input: {query: 'test'},
        output: {result: 'success'},
      };

      const result = UIMessagePartSchema.safeParse(v5ToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v5 output-error state', () => {
      const v5ToolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-123',
        state: 'output-error',
        input: {query: 'test'},
        errorText: 'Something went wrong',
      };

      const result = UIMessagePartSchema.safeParse(v5ToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v5 tool part with providerExecuted field', () => {
      const v5ToolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-123',
        state: 'output-available',
        input: {query: 'test'},
        output: {result: 'success'},
        providerExecuted: true,
      };

      const result = UIMessagePartSchema.safeParse(v5ToolPart);
      expect(result.success).toBe(true);
    });
  });

  describe('DynamicToolUIPart states', () => {
    it('should validate v5 dynamic-tool input-streaming state', () => {
      const v5DynamicToolPart = {
        type: 'dynamic-tool',
        toolName: 'dynamicTool',
        toolCallId: 'call-456',
        state: 'input-streaming',
      };

      const result = UIMessagePartSchema.safeParse(v5DynamicToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v5 dynamic-tool output-available state', () => {
      const v5DynamicToolPart = {
        type: 'dynamic-tool',
        toolName: 'dynamicTool',
        toolCallId: 'call-456',
        state: 'output-available',
        input: {param: 'value'},
        output: {data: 'result'},
      };

      const result = UIMessagePartSchema.safeParse(v5DynamicToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v5 dynamic-tool output-error state', () => {
      const v5DynamicToolPart = {
        type: 'dynamic-tool',
        toolName: 'dynamicTool',
        toolCallId: 'call-456',
        state: 'output-error',
        input: {param: 'value'},
        errorText: 'Tool execution failed',
      };

      const result = UIMessagePartSchema.safeParse(v5DynamicToolPart);
      expect(result.success).toBe(true);
    });
  });

  describe('Full UIMessage v5 format', () => {
    it('should validate a complete v5 assistant message with tool calls', () => {
      const v5Message = {
        id: 'msg-123',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'I will help you with that.',
          },
          {
            type: 'tool-analyzeSql',
            toolCallId: 'call-789',
            state: 'output-available',
            input: {sql: 'SELECT * FROM users'},
            output: {rowCount: 100},
          },
          {
            type: 'text',
            text: 'The query returned 100 rows.',
          },
        ],
      };

      const result = UIMessageSchema.safeParse(v5Message);
      expect(result.success).toBe(true);
    });

    it('should validate a v5 user message', () => {
      const v5Message = {
        id: 'msg-user-123',
        role: 'user',
        parts: [
          {
            type: 'text',
            text: 'Analyze this SQL query',
          },
        ],
      };

      const result = UIMessageSchema.safeParse(v5Message);
      expect(result.success).toBe(true);
    });

    it('should validate v5 message with reasoning part', () => {
      const v5Message = {
        id: 'msg-456',
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: 'Thinking about the query...',
          },
          {
            type: 'text',
            text: 'Here is my analysis.',
          },
        ],
      };

      const result = UIMessageSchema.safeParse(v5Message);
      expect(result.success).toBe(true);
    });
  });

  describe('v6 new states', () => {
    it('should validate v6 approval-requested state', () => {
      const v6ToolPart = {
        type: 'tool-dangerousAction',
        toolCallId: 'call-999',
        state: 'approval-requested',
        input: {action: 'delete'},
        approval: {
          state: 'requested',
        },
      };

      const result = UIMessagePartSchema.safeParse(v6ToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v6 approval-responded state', () => {
      const v6ToolPart = {
        type: 'tool-dangerousAction',
        toolCallId: 'call-999',
        state: 'approval-responded',
        input: {action: 'delete'},
        approval: {
          state: 'approved',
          reason: 'User confirmed action',
        },
      };

      const result = UIMessagePartSchema.safeParse(v6ToolPart);
      expect(result.success).toBe(true);
    });

    it('should validate v6 output-denied state', () => {
      const v6ToolPart = {
        type: 'tool-dangerousAction',
        toolCallId: 'call-999',
        state: 'output-denied',
        input: {action: 'delete'},
        approval: {
          state: 'denied',
          reason: 'User rejected action',
        },
      };

      const result = UIMessagePartSchema.safeParse(v6ToolPart);
      expect(result.success).toBe(true);
    });
  });
});
