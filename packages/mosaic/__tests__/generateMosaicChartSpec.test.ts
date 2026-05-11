import {describe, expect, it, jest} from '@jest/globals';
import {generateMosaicChartSpec} from '../src/dashboard/generateMosaicChartSpec';
import {mosaicChartTypes} from '../src/chart-types';
import {
  MissingTableError,
  UnknownChartTypeError,
  SpecGenerationError,
} from '../src/chart-types/errors';

describe('generateMosaicChartSpec', () => {
  it('throws MissingTableError when tableName is undefined', () => {
    expect(() =>
      generateMosaicChartSpec(undefined, 'histogram', {
        field: 'amount',
      }),
    ).toThrow(MissingTableError);
  });

  it('throws UnknownChartTypeError for unknown chart type', () => {
    expect(() =>
      generateMosaicChartSpec('sales', 'unknown-type' as any, {}),
    ).toThrow(UnknownChartTypeError);
  });

  it('generates spec for histogram chart type', () => {
    const result = generateMosaicChartSpec('sales', 'histogram', {
      field: 'amount',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('generates spec for count-plot chart type', () => {
    const result = generateMosaicChartSpec('sales', 'count-plot', {
      field: 'category',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('generates spec for line-chart chart type', () => {
    const result = generateMosaicChartSpec('timeseries', 'line-chart', {
      x: 'date',
      yFields: [{field: 'value', aggregate: 'sum'}],
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('generates spec for ecdf chart type', () => {
    const result = generateMosaicChartSpec('data', 'ecdf', {
      field: 'value',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('generates spec for heatmap chart type', () => {
    const result = generateMosaicChartSpec('matrix', 'heatmap', {
      x: 'col',
      y: 'row',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('generates spec for box-plot chart type', () => {
    const result = generateMosaicChartSpec('data', 'box-plot', {
      x: 'category',
      y: 'value',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('generates spec for bubble-chart chart type', () => {
    const result = generateMosaicChartSpec('data', 'bubble-chart', {
      x: 'xval',
      y: 'yval',
      size: 'amount',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('plot');
  });

  it('throws SpecGenerationError when createSpec throws', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Mock a chart type that throws
    const createSpecSpy = jest
      .spyOn(mosaicChartTypes.histogram, 'createSpec')
      .mockImplementation(() => {
        throw new Error('Test error');
      });

    expect(() =>
      generateMosaicChartSpec('sales', 'histogram', {
        field: 'amount',
      }),
    ).toThrow(SpecGenerationError);

    // Restore
    createSpecSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('accepts Record<string, unknown> as settings', () => {
    const result = generateMosaicChartSpec('sales', 'histogram', {
      field: 'amount',
      extraProp: 'ignored',
    });

    expect(result).toBeDefined();
    expect(result).not.toBeNull();
  });

  it('passes settings correctly to createSpec', () => {
    const settings = {field: 'test_field'};
    const result = generateMosaicChartSpec('test_table', 'histogram', settings);

    expect(result).toBeDefined();
    // Verify the spec contains reference to the table and field
    const specString = JSON.stringify(result);
    expect(specString).toContain('test_table');
    expect(specString).toContain('test_field');
  });
});
