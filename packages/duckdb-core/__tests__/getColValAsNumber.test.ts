import type * as arrow from 'apache-arrow';
import {getColValAsNumber} from '../src/duckdb-utils';

function tableWithValue(value: unknown): arrow.Table {
  return {
    getChildAt: () => ({get: () => value}),
    getChild: () => ({get: () => value}),
  } as unknown as arrow.Table;
}

describe('getColValAsNumber', () => {
  it.each([
    ['multi-digit integer string', '557', 557],
    ['decimal string', '0.5', 0.5],
    ['negative decimal string', '-122.42', -122.42],
    ['number', 557, 557],
    ['bigint', 557n, 557],
    ['array-wrapped bigint', [557n], 557],
  ])('converts a %s', (_description, value, expected) => {
    expect(getColValAsNumber(tableWithValue(value))).toBe(expected);
  });

  it.each([null, undefined])('returns NaN for %s', (value) => {
    expect(getColValAsNumber(tableWithValue(value))).toBeNaN();
  });
});
