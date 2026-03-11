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

    it('renames toolAdditionalData to toolEditState without duplicating existing uiMessages', () => {
      // Sessions persisted by an intermediate build that wrote toolAdditionalData
      // instead of toolEditState but already had uiMessages synthesized.
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
        // no toolEditState
      };
      const result = AnalysisSessionSchema.parse(raw);
      // Messages must not be duplicated
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.id).toBe('msg-1');
      // Legacy key must be promoted to toolEditState
      expect(result.toolEditState).toEqual({'call-1': {someEdit: true}});
    });

    it('adds empty toolEditState when uiMessages is present but no tool state key exists', () => {
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
        // neither toolEditState nor toolAdditionalData
      };
      const result = AnalysisSessionSchema.parse(raw);
      // Messages must not be duplicated
      expect(result.uiMessages).toHaveLength(1);
      expect(result.uiMessages[0]?.id).toBe('msg-2');
      // toolEditState must default to empty record
      expect(result.toolEditState).toEqual({});
    });
  });
});
