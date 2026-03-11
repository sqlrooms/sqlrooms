import {AnalysisSessionSchema} from '@sqlrooms/ai-config';

/** Minimal valid base fields required by the schema after migration */
const baseFields = {
  id: 'session-1',
  name: 'Test',
  modelProvider: 'openai',
  model: 'gpt-4',
  analysisResults: [],
};

describe('AnalysisSession migration', () => {
  describe('needsV0_26_0Migration guard', () => {
    it('does NOT re-migrate a fully migrated session (has uiMessages + toolEditState)', () => {
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
        toolEditState: {},
      };
      const result = AnalysisSessionSchema.parse(raw);
      // uiMessages should not be extended — no duplication
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.id).toBe('msg-1');
    });

    it('DOES migrate a pre-v0.26.0 session that has no uiMessages', () => {
      const raw = {
        ...baseFields,
        // no uiMessages, no toolEditState — this is a pre-migration session
        analysisResults: [
          {
            id: 'r1',
            prompt: 'What is 2+2?',
            isCompleted: true,
            streamMessage: {parts: []},
          },
        ],
      };
      const result = AnalysisSessionSchema.parse(raw);
      expect(Array.isArray(result.uiMessages)).toBe(true);
      // One user message synthesized from the prompt
      expect(result.uiMessages.some((m) => m.role === 'user')).toBe(true);
    });
  });
});
