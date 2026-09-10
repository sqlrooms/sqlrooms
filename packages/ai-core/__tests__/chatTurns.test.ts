import type {UIMessage} from 'ai';
import {
  getAnalysisResultsFromUiMessages,
  getChatTurnCompletedAt,
  getChatTurnsFromUiMessages,
  setChatRequestErrorMessage,
  setChatTurnCompletedAt,
} from '../src/chatTurns';

describe('chat turn derivation', () => {
  it('groups each user message with following assistant messages', () => {
    const messages: UIMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        parts: [{type: 'text', text: 'first'}],
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{type: 'text', text: 'answer'}],
      },
      {
        id: 'user-2',
        role: 'user',
        parts: [{type: 'text', text: 'second'}],
      },
    ];

    const turns = getChatTurnsFromUiMessages(messages);

    expect(turns).toMatchObject([
      {
        id: 'user-1',
        prompt: 'first',
        assistantMessages: [{id: 'assistant-1'}],
        isCompleted: true,
      },
      {
        id: 'user-2',
        prompt: 'second',
        assistantMessages: [],
        isCompleted: false,
      },
    ]);
  });

  it('derives legacy result-shaped data from UI messages and metadata errors', () => {
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'prompt'}],
    };
    setChatRequestErrorMessage(userMessage, {error: 'Request failed'});

    expect(getAnalysisResultsFromUiMessages([userMessage])).toEqual([
      {
        id: 'user-1',
        prompt: 'prompt',
        isCompleted: true,
        errorMessage: {error: 'Request failed'},
      },
    ]);
  });

  it('treats migrated legacy errors as completed even with stale incomplete metadata', () => {
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      metadata: {
        sqlrooms: {
          errorMessage: {error: 'Request failed'},
          isCompleted: false,
        },
      },
      parts: [{type: 'text', text: 'prompt'}],
    };

    expect(getAnalysisResultsFromUiMessages([userMessage])).toEqual([
      {
        id: 'user-1',
        prompt: 'prompt',
        isCompleted: true,
        errorMessage: {error: 'Request failed'},
      },
    ]);
  });

  it('carries the recorded completion time onto the turn', () => {
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'prompt'}],
    };
    setChatTurnCompletedAt(userMessage, 1_700_000_000_000);

    expect(getChatTurnCompletedAt(userMessage)).toBe(1_700_000_000_000);
    expect(
      getChatTurnsFromUiMessages([
        userMessage,
        {
          id: 'assistant-1',
          role: 'assistant',
          parts: [{type: 'text', text: 'answer'}],
        },
      ]),
    ).toMatchObject([{id: 'user-1', completedAt: 1_700_000_000_000}]);
  });

  it('leaves the completion time absent for turns that never recorded one', () => {
    expect(
      getChatTurnsFromUiMessages([
        {id: 'user-1', role: 'user', parts: [{type: 'text', text: 'prompt'}]},
      ])[0]?.completedAt,
    ).toBeUndefined();
  });

  it('uses migrated legacy completion metadata for prompt-only completed turns', () => {
    const userMessage: UIMessage = {
      id: 'user-1',
      role: 'user',
      metadata: {
        sqlrooms: {
          isCompleted: true,
        },
      },
      parts: [{type: 'text', text: 'prompt'}],
    };

    expect(getAnalysisResultsFromUiMessages([userMessage])).toEqual([
      {
        id: 'user-1',
        prompt: 'prompt',
        isCompleted: true,
      },
    ]);
  });
});
