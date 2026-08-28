import type {FileUIPart, UIMessage} from 'ai';
import {
  getChatAttachmentText,
  getChatMessageAttachments,
  isMarkdownAttachment,
  textAttachmentToModelText,
} from '../src/chatAttachments';
import {sanitizeMessagesForLLM} from '../src/utils';

function textAttachment(text: string, filename = 'notes.md'): FileUIPart {
  return {
    type: 'file',
    filename,
    mediaType: filename.endsWith('.md') ? 'text/markdown' : 'text/plain',
    url: `data:text/plain;base64,${Buffer.from(text).toString('base64')}`,
  };
}

describe('chat attachments', () => {
  it('decodes UTF-8 text and identifies Markdown', () => {
    const attachment = textAttachment('# Zürich\n\nHello 👋');

    expect(getChatAttachmentText(attachment)).toBe('# Zürich\n\nHello 👋');
    expect(isMarkdownAttachment(attachment)).toBe(true);
    expect(textAttachmentToModelText(attachment)).toBe(
      'Attached file: notes.md\n\n# Zürich\n\nHello 👋',
    );
  });

  it('keeps file parts on the UI message', () => {
    const attachment = textAttachment('hello', 'notes.txt');
    const message: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'Read this'}, attachment],
    };

    expect(getChatMessageAttachments(message)).toEqual([attachment]);
    expect(message.parts[1]).toBe(attachment);
  });

  it('converts text files to labeled model text but preserves images', () => {
    const text = textAttachment('alpha\nbeta', 'data.txt');
    const image: FileUIPart = {
      type: 'file',
      filename: 'plot.png',
      mediaType: 'image/png',
      url: 'data:image/png;base64,aW1hZ2U=',
    };
    const message: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [{type: 'text', text: 'Compare these'}, text, image],
    };

    expect(sanitizeMessagesForLLM([message])).toEqual([
      {
        ...message,
        parts: [
          {type: 'text', text: 'Compare these'},
          {type: 'text', text: 'Attached file: data.txt\n\nalpha\nbeta'},
          image,
        ],
      },
    ]);
    expect(message.parts).toEqual([
      {type: 'text', text: 'Compare these'},
      text,
      image,
    ]);
  });
});
