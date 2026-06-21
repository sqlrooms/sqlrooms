import {jest} from '@jest/globals';
import type {UIMessage} from 'ai';
import {parseLocalAgentUiMessages} from '../src/hooks/useLocalAgentChatTransport';

describe('parseLocalAgentUiMessages', () => {
  it('extracts UI messages from the useChat request body', () => {
    const messages: UIMessage[] = [
      {
        id: 'message-1',
        role: 'user',
        parts: [{type: 'text', text: 'hello'}],
      },
    ];

    expect(
      parseLocalAgentUiMessages(JSON.stringify({messages, other: true})),
    ).toEqual(messages);
  });

  it('returns an empty list for malformed or unexpected bodies', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseLocalAgentUiMessages('not json')).toEqual([]);
    expect(parseLocalAgentUiMessages(new URLSearchParams())).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockRestore();
  });
});
