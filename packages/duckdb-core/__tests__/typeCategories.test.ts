import * as arrow from 'apache-arrow';
import {
  columnTypeCategoryToSelectorType,
  getArrowColumnTypeCategory,
  getDuckDbTypeCategory,
  isColumnCategorical,
  isColumnNumeric,
  isColumnQuantitative,
  isColumnTemporal,
} from '../src/schema-tree/typeCategories';

describe('typeCategories', () => {
  it('classifies DuckDB type strings into shared semantic categories', () => {
    expect(getDuckDbTypeCategory('DECIMAL(10, 2)')).toBe('number');
    expect(getDuckDbTypeCategory('REAL')).toBe('number');
    expect(getDuckDbTypeCategory('VARCHAR(255)')).toBe('string');
    expect(getDuckDbTypeCategory('ENUM')).toBe('string');
    expect(getDuckDbTypeCategory('TIMESTAMP_MS')).toBe('datetime');
    expect(getDuckDbTypeCategory('DOUBLE[]')).toBe('struct');
    expect(getDuckDbTypeCategory('GEOMETRY')).toBe('geometry');
  });

  it('classifies Arrow data types into shared semantic categories', () => {
    expect(getArrowColumnTypeCategory(new arrow.Int32())).toBe('number');
    expect(getArrowColumnTypeCategory(new arrow.Float64())).toBe('number');
    expect(getArrowColumnTypeCategory(new arrow.TimestampMillisecond())).toBe(
      'datetime',
    );
    expect(getArrowColumnTypeCategory(new arrow.Bool())).toBe('boolean');
    expect(getArrowColumnTypeCategory(new arrow.Binary())).toBe('binary');
    expect(getArrowColumnTypeCategory(new arrow.Utf8())).toBe('string');
  });

  it('exposes selector-facing predicates over the shared categories', () => {
    expect(isColumnNumeric({name: 'magnitude', type: 'DOUBLE'})).toBe(true);
    expect(isColumnNumeric('DECIMAL(10, 2)')).toBe(true);
    expect(isColumnNumeric('BIT')).toBe(true);
    expect(isColumnTemporal('TIMESTAMP_NS')).toBe(true);
    expect(isColumnQuantitative('DATE')).toBe(true);
    expect(isColumnCategorical('VARCHAR')).toBe(true);
    expect(isColumnCategorical('BLOB')).toBe(true);
    expect(isColumnCategorical('BOOLEAN')).toBe(false);
  });

  it('maps semantic categories to selector-compatible type strings', () => {
    expect(columnTypeCategoryToSelectorType('number')).toBe('DOUBLE');
    expect(columnTypeCategoryToSelectorType('datetime')).toBe('TIMESTAMP');
    expect(columnTypeCategoryToSelectorType('string')).toBe('VARCHAR');
    expect(columnTypeCategoryToSelectorType('boolean')).toBe('BOOLEAN');
    expect(columnTypeCategoryToSelectorType('binary')).toBe('BLOB');
  });
});
