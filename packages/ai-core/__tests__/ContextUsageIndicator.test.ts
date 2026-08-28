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
});
