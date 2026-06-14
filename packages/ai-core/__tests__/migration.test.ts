import {
  ChatSessionSchema,
  getAiRunContextPrimaryItem,
} from '@sqlrooms/ai-config';

/** Minimal valid base fields required by the schema after migration */
const baseFields = {
  id: 'session-1',
  name: 'Test',
  modelProvider: 'openai',
  model: 'gpt-4',
};

describe('ChatSession migration', () => {
  describe('needsV0_26_0Migration guard', () => {
    it('does NOT re-migrate a fully migrated session (has uiMessages, no legacy keys)', () => {
      const existingMessages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          parts: [{type: 'text', text: 'hello'}],
        },
      ];
      const raw = {
        ...baseFields,
        uiMessages: existingMessages,
      };
      const result = ChatSessionSchema.parse(raw);
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.id).toBe('msg-1');
      expect(result).not.toHaveProperty('analysisResults');
    });

    it('DOES migrate a pre-v0.26.0 session that has no uiMessages', () => {
      const raw = {
        ...baseFields,
        analysisResults: [
          {
            id: 'r1',
            prompt: 'What is 2+2?',
            isCompleted: true,
            errorMessage: {error: 'Request failed'},
            streamMessage: {parts: []},
          },
        ],
      };
      const result = ChatSessionSchema.parse(raw);
      expect(Array.isArray(result.uiMessages)).toBe(true);
      expect(result.uiMessages.some((m) => m.role === 'user')).toBe(true);
      expect(result.uiMessages[0]?.metadata).toEqual({
        sqlrooms: {
          errorMessage: {error: 'Request failed'},
          isCompleted: true,
        },
      });
      expect(result).not.toHaveProperty('analysisResults');
    });

    it('preserves legacy result error and completion metadata before dropping analysisResults', () => {
      const raw = {
        ...baseFields,
        uiMessages: [
          {
            id: 'r1',
            role: 'user' as const,
            parts: [{type: 'text', text: 'Why did this fail?'}],
          },
        ],
        analysisResults: [
          {
            id: 'r1',
            prompt: 'Why did this fail?',
            isCompleted: true,
            errorMessage: {error: 'Request cancelled'},
            streamMessage: {parts: []},
          },
        ],
      };

      const result = ChatSessionSchema.parse(raw);
      expect(result.uiMessages[0]?.metadata).toEqual({
        sqlrooms: {
          errorMessage: {error: 'Request cancelled'},
          isCompleted: true,
        },
      });
      expect(result).not.toHaveProperty('analysisResults');
    });

    it('strips legacy toolAdditionalData without duplicating existing uiMessages', () => {
      const existingMessages = [
        {
          id: 'msg-1',
          role: 'user' as const,
          parts: [{type: 'text', text: 'hello'}],
        },
      ];
      const raw = {
        ...baseFields,
        uiMessages: existingMessages,
        toolAdditionalData: {'call-1': {someEdit: true}},
      };
      const result = ChatSessionSchema.parse(raw);
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.id).toBe('msg-1');
      expect(
        (result as Record<string, unknown>).toolAdditionalData,
      ).toBeUndefined();
    });

    it('parses cleanly when uiMessages is present and no legacy keys exist', () => {
      const existingMessages = [
        {
          id: 'msg-2',
          role: 'user' as const,
          parts: [{type: 'text', text: 'hi'}],
        },
      ];
      const raw = {
        ...baseFields,
        uiMessages: existingMessages,
      };
      const result = ChatSessionSchema.parse(raw);
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.id).toBe('msg-2');
    });

    it('migrates optional legacy artifact run context', () => {
      const raw = {
        ...baseFields,
        uiMessages: [],
        runContext: {
          kind: 'artifact',
          id: 'map-1',
          type: 'map',
          title: 'Map A',
          capturedAt: 123,
        },
      };
      const result = ChatSessionSchema.parse(raw);
      expect(result.runContext).toEqual({
        items: [
          {
            kind: 'artifact',
            id: 'map-1',
            type: 'map',
            title: 'Map A',
          },
        ],
        capturedAt: 123,
      });
    });

    it('preserves ordered multi-item run context', () => {
      const raw = {
        ...baseFields,
        uiMessages: [],
        runContext: {
          items: [
            {
              kind: 'artifact',
              id: 'map-1',
              type: 'map',
              title: 'Map A',
            },
            {
              kind: 'artifact',
              id: 'dashboard-1',
              type: 'dashboard',
              title: 'Dashboard',
            },
          ],
          capturedAt: 123,
        },
      };
      const result = ChatSessionSchema.parse(raw);
      expect(result.runContext).toEqual(raw.runContext);
      expect(getAiRunContextPrimaryItem(result.runContext)?.id).toBe('map-1');
    });

    it('uses primaryItemId when present in run context', () => {
      const raw = {
        ...baseFields,
        uiMessages: [],
        runContext: {
          primaryItemId: 'dashboard-1',
          items: [
            {
              kind: 'artifact',
              id: 'map-1',
              type: 'map',
              title: 'Map A',
            },
            {
              kind: 'artifact',
              id: 'dashboard-1',
              type: 'dashboard',
              title: 'Dashboard',
            },
          ],
          capturedAt: 123,
        },
      };
      const result = ChatSessionSchema.parse(raw);
      expect(getAiRunContextPrimaryItem(result.runContext)?.id).toBe(
        'dashboard-1',
      );
    });

    it('keeps run context optional for old sessions', () => {
      const result = ChatSessionSchema.parse({
        ...baseFields,
        uiMessages: [],
      });
      expect(result.runContext).toBeUndefined();
    });
  });
});
