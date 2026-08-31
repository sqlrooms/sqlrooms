import type {UIMessage} from 'ai';
import {estimateMessageTokens} from '../src/components/ContextUsageIndicator';

describe('ContextUsageIndicator fallback estimates', () => {
  it('counts text attachment content as labeled model input', () => {
    const message: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [
        {
          type: 'file',
          filename: 'report.md',
          mediaType: 'text/markdown',
          url: `data:text/markdown;base64,${Buffer.from(
            'Revenue grew 18%.',
          ).toString('base64')}`,
        },
      ],
    };

    // Four message-overhead tokens plus eleven estimated content tokens for
    // "Attached file: report.md\n\nRevenue grew 18%.".
    expect(estimateMessageTokens(message)).toBe(15);
  });

  it('reserves a conservative fallback budget for image attachments', () => {
    const message: UIMessage = {
      id: 'user-1',
      role: 'user',
      parts: [
        {
          type: 'file',
          filename: 'chart.png',
          mediaType: 'image/png',
          url: 'data:image/png;base64,aW1hZ2U=',
        },
      ],
    };

    expect(estimateMessageTokens(message)).toBe(4_100);
  });
});
