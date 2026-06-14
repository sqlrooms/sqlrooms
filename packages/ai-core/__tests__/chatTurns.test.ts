import type {UIMessage} from 'ai';
import {
  getAnalysisResultsFromUiMessages,
  getChatTurnsFromUiMessages,
  setChatRequestErrorMessage,
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
});
