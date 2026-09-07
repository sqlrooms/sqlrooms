import {describe, expect, test} from '@jest/globals';
import {likePatternToRegex} from '../mcpCapabilityUtils';

describe('CLI room capability helpers', () => {
  test('treats regex metacharacters as literal LIKE pattern text', () => {
    const regex = likePatternToRegex('events*?.%');

    expect(regex.test('events*?.2026')).toBe(true);
    expect(regex.test('eventsXXa.2026')).toBe(false);
  });

  test('supports SQL LIKE percent and underscore wildcards', () => {
    const regex = likePatternToRegex('trip_%');

    expect(regex.test('trip_a')).toBe(true);
    expect(regex.test('trip')).toBe(false);
  });
});
