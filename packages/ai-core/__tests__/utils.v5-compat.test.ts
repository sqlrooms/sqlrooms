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
  describe('isToolPart', () => {
    it('should return true for v5 tool-* parts', () => {
      const v5ToolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart;

      expect(isToolPart(v5ToolPart)).toBe(true);
    });

    it('should return true for v5 tool parts with any state', () => {
      const states = [
        'input-streaming',
        'input-available',
        'output-available',
        'output-error',
      ];

      for (const state of states) {
        const part = {
          type: 'tool-analyze',
          toolCallId: 'call-1',
          state,
          input: {},
        } as UIMessagePart;

        expect(isToolPart(part)).toBe(true);
      }
    });

    it('should return true for v6 tool parts with new states', () => {
      const v6States = [
        'approval-requested',
        'approval-responded',
        'output-denied',
      ];

      for (const state of v6States) {
        const part = {
          type: 'tool-action',
          toolCallId: 'call-1',
          state,
          input: {},
          approval: {state: 'requested'},
        } as UIMessagePart;

        expect(isToolPart(part)).toBe(true);
      }
    });

    it('should return false for dynamic-tool parts', () => {
      const dynamicToolPart = {
        type: 'dynamic-tool',
        toolName: 'myTool',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart;

      expect(isToolPart(dynamicToolPart)).toBe(false);
    });

    it('should return false for text parts', () => {
      const textPart = {
        type: 'text',
        text: 'Hello',
      } as UIMessagePart;

      expect(isToolPart(textPart)).toBe(false);
    });
  });

  describe('isDynamicToolPart', () => {
    it('should return true for v5 dynamic-tool parts', () => {
      const v5DynamicToolPart = {
        type: 'dynamic-tool',
        toolName: 'myDynamicTool',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart;

      expect(isDynamicToolPart(v5DynamicToolPart)).toBe(true);
    });

    it('should return true for v6 dynamic-tool parts with new states', () => {
      const v6DynamicToolPart = {
        type: 'dynamic-tool',
        toolName: 'myDynamicTool',
        toolCallId: 'call-1',
        state: 'approval-requested',
        input: {},
        approval: {state: 'requested'},
      } as UIMessagePart;

      expect(isDynamicToolPart(v6DynamicToolPart)).toBe(true);
    });

    it('should return false for tool-* parts', () => {
      const toolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart;

      expect(isDynamicToolPart(toolPart)).toBe(false);
    });

    it('should return false for text parts', () => {
      const textPart = {
        type: 'text',
        text: 'Hello',
      } as UIMessagePart;

      expect(isDynamicToolPart(textPart)).toBe(false);
    });
  });

  describe('isTextPart', () => {
    it('should return true for text parts', () => {
      const textPart = {
        type: 'text',
        text: 'Hello world',
      } as UIMessagePart;

      expect(isTextPart(textPart)).toBe(true);
    });

    it('should return true for text parts with optional state', () => {
      const textPart = {
        type: 'text',
        text: 'Hello world',
        state: 'done',
      } as UIMessagePart;

      expect(isTextPart(textPart)).toBe(true);
    });

    it('should return false for tool parts', () => {
      const toolPart = {
        type: 'tool-myTool',
        toolCallId: 'call-1',
        state: 'output-available',
        input: {},
        output: {},
      } as UIMessagePart;

      expect(isTextPart(toolPart)).toBe(false);
    });
  });

  describe('isReasoningPart', () => {
    it('should return true for reasoning parts', () => {
      const reasoningPart = {
        type: 'reasoning',
        text: 'Thinking about the problem...',
      } as UIMessagePart;

      expect(isReasoningPart(reasoningPart)).toBe(true);
    });

    it('should return true for reasoning parts with state', () => {
      const reasoningPart = {
        type: 'reasoning',
        text: 'Analyzing...',
        state: 'streaming',
      } as UIMessagePart;

      expect(isReasoningPart(reasoningPart)).toBe(true);
    });

    it('should return false for text parts', () => {
      const textPart = {
        type: 'text',
        text: 'Hello',
      } as UIMessagePart;

      expect(isReasoningPart(textPart)).toBe(false);
    });
  });
});
