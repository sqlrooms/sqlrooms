import {describe, expect, test} from 'vitest';
import {AUTHENTICATED_FILE_CACHE_CONTROL} from './fileReadResponse';

describe('authenticated file responses', () => {
  test('cannot be reused after an account switch', () => {
    expect(AUTHENTICATED_FILE_CACHE_CONTROL).toBe('no-store');
  });
});
