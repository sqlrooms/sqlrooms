import {describe, expect, test} from '@jest/globals';
import {availableLeadCount} from '../forecast-availability';

describe('ECMWF forecast availability', () => {
  const leadHours = [0, 3, 6, 9, 12];

  test('uses the ingestion coordinate when it is populated', () => {
    expect(availableLeadCount(leadHours, 5, 6 * 3600)).toBe(3);
  });

  test('falls back to the populated temperature prefix', () => {
    expect(
      availableLeadCount(
        leadHours,
        5,
        Number.NaN,
        Float32Array.of(10, 11, 12, Number.NaN, Number.NaN),
      ),
    ).toBe(3);
  });

  test('reports no forecast when neither signal has values', () => {
    expect(
      availableLeadCount(
        leadHours,
        5,
        Number.NaN,
        new Float32Array(5).fill(Number.NaN),
      ),
    ).toBe(0);
  });
});
