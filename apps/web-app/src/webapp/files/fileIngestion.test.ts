import {describe, expect, it, vi} from 'vitest';
import {createTableName} from './fileIngestion';

describe('createTableName', () => {
  it('sanitizes source file names and appends a short random suffix', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '12345678-1234-4000-9000-123456789abc',
    );

    expect(createTableName('Revenue by Region (Q1).csv')).toBe(
      'Revenue_by_Region_Q1_12345678',
    );
  });

  it('falls back when a file name has no usable table characters', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      'abcdef12-1234-4000-9000-123456789abc',
    );

    expect(createTableName('!!!.csv')).toBe('uploaded_file_abcdef12');
  });
});
