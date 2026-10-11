import {getChatErrorMessageForDisplay} from '../src/chatTransport';

describe('getChatErrorMessageForDisplay', () => {
  it('preserves top-level budget retry errors from the pre-skills path', () => {
    const message =
      'Failed after 3 attempts. Last error: Budget has been exceeded! Current cost: 1.0374696, Max budget: 1.0';

    expect(getChatErrorMessageForDisplay(new Error(message))).toBe(message);
  });

  it('extracts LiteLLM error messages from provider response bodies', () => {
    const error = Object.assign(new Error('An error occurred.'), {
      responseBody: JSON.stringify({
        error: {
          message:
            'Budget has been exceeded! Current cost: 186.0979088000002, Max budget: 100.0',
          type: 'budget_exceeded',
          param: null,
          code: '429',
        },
      }),
    });

    expect(getChatErrorMessageForDisplay(error)).toBe(
      'Budget has been exceeded! Current cost: 186.0979088000002, Max budget: 100.0',
    );
  });

  it('falls back to the regular error message', () => {
    expect(getChatErrorMessageForDisplay(new Error('Network error'))).toBe(
      'Network error',
    );
  });
});
