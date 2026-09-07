import {describe, expect, test} from '@jest/globals';
import type {TableColumn} from '@sqlrooms/duckdb';
import {resolveColorScaleFieldAndType} from '../src/MapSettings';

const columns: TableColumn[] = [
  {name: 'name', type: 'VARCHAR'},
  {name: 'magnitude', type: 'DOUBLE'},
  {name: 'is_active', type: 'BOOLEAN'},
];

describe('resolveColorScaleFieldAndType', () => {
  test('forces categorical for boolean fields', () => {
    expect(
      resolveColorScaleFieldAndType(columns, 'sequential', 'is_active'),
    ).toEqual({field: 'is_active', type: 'categorical'});
  });

  test('forces categorical when falling back to a string-only field', () => {
    const stringOnly: TableColumn[] = [{name: 'name', type: 'VARCHAR'}];
    expect(resolveColorScaleFieldAndType(stringOnly, 'sequential')).toEqual({
      field: 'name',
      type: 'categorical',
    });
  });

  test('keeps sequential for numeric fields', () => {
    expect(
      resolveColorScaleFieldAndType(columns, 'sequential', 'magnitude'),
    ).toEqual({field: 'magnitude', type: 'sequential'});
  });
});
