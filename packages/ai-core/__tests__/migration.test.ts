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
  describe('toolAdditionalData → toolEditState rename', () => {
    it('renames toolAdditionalData to toolEditState when toolEditState is absent', () => {
      const raw = {
        ...baseFields,
        uiMessages: [],
        toolAdditionalData: {'call-1': {someData: true}},
      };
      const result = AnalysisSessionSchema.parse(raw);
      expect(result.toolEditState).toEqual({'call-1': {someData: true}});
      expect('toolAdditionalData' in result).toBe(false);
    });

    it('preserves existing toolEditState and ignores toolAdditionalData when both present', () => {
      const raw = {
        ...baseFields,
        uiMessages: [],
        toolEditState: {'call-1': {editData: 42}},
        toolAdditionalData: {'call-1': {oldData: true}},
      };
      const result = AnalysisSessionSchema.parse(raw);
      // toolEditState wins; toolAdditionalData is discarded
      expect(result.toolEditState).toEqual({'call-1': {editData: 42}});
    });
  });

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

    it('does NOT re-migrate when uiMessages is present and toolAdditionalData is used instead of toolEditState', () => {
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
        // uses old field name — v0.26.0 migration should NOT re-run and duplicate messages
        toolAdditionalData: {'call-1': {x: 1}},
      };
      const result = AnalysisSessionSchema.parse(raw);
      expect(result.uiMessages).toHaveLength(1);
      expect(result.toolEditState).toEqual({'call-1': {x: 1}});
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
