import {describe, expect, it} from 'vitest';
import {createTableName} from './fileIngestion';

describe('createTableName', () => {
  it('sanitizes source file names without adding a random suffix', () => {
    expect(createTableName('Revenue by Region (Q1).csv')).toBe(
      'Revenue_by_Region_Q1',
    );
  });

  it('falls back when a file name has no usable table characters', () => {
    expect(createTableName('!!!.csv')).toBe('uploaded_file');
  });

  it('prefixes names that would otherwise start with a number', () => {
    expect(createTableName('2026 sales.csv')).toBe('_2026_sales');
  });
});
