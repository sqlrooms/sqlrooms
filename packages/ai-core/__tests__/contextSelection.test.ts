import {getEffectiveSessionContextItemIds} from '../src/contextSelection';
import type {AnalysisSessionSchema} from '@sqlrooms/ai-config';

function createSession(
  props: Partial<AnalysisSessionSchema> = {},
): AnalysisSessionSchema {
  return {
    id: 'session-1',
    name: 'Session 1',
    modelProvider: 'openai',
    model: 'gpt-4.1',
    analysisResults: [],
    uiMessages: [],
    messagesRevision: 0,
    prompt: '',
    isRunning: false,
    ...props,
  };
}

describe('context selection', () => {
  it('honors an explicit empty draft context over implicit items', () => {
    expect(
      getEffectiveSessionContextItemIds(
        createSession({draftContextItemIds: []}),
        {implicitItemIds: ['map-a']},
      ),
    ).toEqual([]);
  });
});
