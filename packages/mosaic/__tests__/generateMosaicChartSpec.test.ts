import {describe, expect, it, jest} from '@jest/globals';
import {generateMosaicChartSpec} from '../src/dashboard/generateMosaicChartSpec';
import {mosaicChartTypes} from '../src/chart-types';

describe('generateMosaicChartSpec', () => {
  it('returns null when tableName is undefined', () => {
    const result = generateMosaicChartSpec(undefined, 'histogram', {
      field: 'amount',
    });
    expect(result).toBeNull();
  });

  it('returns null for unknown chart type', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = generateMosaicChartSpec('sales', 'unknown-type' as any, {});

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown chart type: unknown-type'),
    );

    consoleSpy.mockRestore();
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
      y: 'value',
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

  it('returns null for box-plot because it creates a custom dashboard panel', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const result = generateMosaicChartSpec('data', 'box-plot', {
      x: 'category',
      y: 'value',
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('does not create a vgplot spec'),
    );

    consoleSpy.mockRestore();
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

  it('handles createSpec throwing an error', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    // Mock a chart type that throws
    const createSpecSpy = jest
      .spyOn(mosaicChartTypes.histogram, 'createSpec')
      .mockImplementation(() => {
        throw new Error('Test error');
      });

    const result = generateMosaicChartSpec('sales', 'histogram', {
      field: 'amount',
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to generate spec'),
      expect.any(Error),
    );

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
