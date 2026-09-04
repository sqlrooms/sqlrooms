import {describe, expect, test} from 'vitest';
import {resolveOpenRouterModel} from './openRouterModel';

describe('resolveOpenRouterModel', () => {
  test('uses OPENROUTER_MODEL for the default fast mode', () => {
    expect(
      resolveOpenRouterModel('fast', {
        OPENROUTER_MODEL: 'anthropic/claude-sonnet-4',
      }),
    ).toBe('anthropic/claude-sonnet-4');
  });

  test('keeps the dedicated deep model for deep mode', () => {
    expect(
      resolveOpenRouterModel('deep', {
        OPENROUTER_MODEL: 'anthropic/claude-sonnet-4',
      }),
    ).toBe('deepseek/deepseek-v4-pro');
  });
});
