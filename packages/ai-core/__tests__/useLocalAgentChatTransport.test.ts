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

  it('converts text file parts before forwarding them to a local agent', () => {
    const messages: UIMessage[] = [
      {
        id: 'message-1',
        role: 'user',
        parts: [
          {type: 'text', text: 'Summarize this'},
          {
            type: 'file',
            filename: 'notes.txt',
            mediaType: 'text/plain',
            url: 'data:text/plain;base64,aGVsbG8=',
          },
          {
            type: 'file',
            filename: 'chart.png',
            mediaType: 'image/png',
            url: 'data:image/png;base64,aW1hZ2U=',
          },
        ],
      },
    ];

    expect(parseLocalAgentUiMessages(JSON.stringify({messages}))).toEqual([
      {
        id: 'message-1',
        role: 'user',
        parts: [
          {type: 'text', text: 'Summarize this'},
          {type: 'text', text: 'Attached file: notes.txt\n\nhello'},
          expect.objectContaining({
            type: 'file',
            filename: 'chart.png',
          }),
        ],
      },
    ]);
  });

  it('returns an empty list for malformed or unexpected bodies', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(parseLocalAgentUiMessages('not json')).toEqual([]);
    expect(parseLocalAgentUiMessages(new URLSearchParams())).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2);

    warn.mockRestore();
  });
});
