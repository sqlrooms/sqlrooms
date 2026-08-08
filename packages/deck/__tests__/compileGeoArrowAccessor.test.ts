import {describe, expect, test} from '@jest/globals';
import {Field, Int64, Schema, Table, vectorFromArray} from 'apache-arrow';
import {compileGeoArrowAccessor} from '../src/json/compileGeoArrowAccessor';

describe('compileGeoArrowAccessor', () => {
  test('coerces Int64 bigint column values so numeric expressions work', () => {
    const table = new Table(new Schema([new Field('value', new Int64())]), {
      value: vectorFromArray([10n, 25n, 40n], new Int64()),
    });

    const accessor = compileGeoArrowAccessor('Math.max(0, value - 10)', table);
    const batch = table.batches[0]!;

    expect(
      accessor({
        index: 0,
        data: {data: batch},
        target: [],
      }),
    ).toBe(0);
    expect(
      accessor({
        index: 1,
        data: {data: batch},
        target: [],
      }),
    ).toBe(15);
    expect(
      accessor({
        index: 2,
        data: {data: batch},
        target: [],
      }),
    ).toBe(30);
  });

  test('returns Number for a plain Int64 column reference', () => {
    const table = new Table(new Schema([new Field('value', new Int64())]), {
      value: vectorFromArray([7n], new Int64()),
    });

    const accessor = compileGeoArrowAccessor('value', table);
    const result = accessor({
      index: 0,
      data: {data: table.batches[0]!},
      target: [],
    });

    expect(typeof result).toBe('number');
    expect(result).toBe(7);
  });
});
