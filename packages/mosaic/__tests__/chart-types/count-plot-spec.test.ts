import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';
import {createCountPlotSpec} from '../../src/charts/chart-types/count-plot/spec';
import type {CountPlotChartSettings} from '../../src/charts/chart-types/count-plot/schema';

describe('createCountPlotSpec', () => {
  const mockDataTable: DataTable = {
    table: makeQualifiedTableName({
      database: 'attached',
      schema: 'main',
      table: 'roads',
    }),
    tableName: 'roads',
    schema: 'main',
    isView: false,
    columns: [
      {name: 'class', type: 'VARCHAR'},
      {name: 'length_m', type: 'DOUBLE'},
    ],
  };

  it('generates a count plot with auto-derived left margin by default', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
      selectionName: 'test_selection',
    }) as any;

    expect(spec.plot[0].x).toEqual({count: null});
    for (const mark of spec.plot.slice(0, 3)) {
      expect(mark.y).toBe('class');
      expect(mark.sort).toEqual({y: '-x', limit: 10});
    }
    expect(spec.xLabel).toBe('Count');
    expect(spec.height).toBe(512);
    expect(spec.yPaddingInner).toBeCloseTo(10 / 42);
    expect(spec.margins.left).toBeGreaterThan(50);
    expect(spec.plot[3]).toEqual({select: 'intervalY', as: '$brush'});
  });

  it('applies ascending value sorting', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      sort: 'value-asc',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].sort).toEqual({y: 'x', limit: 10});
  });

  it('can sort categories by label', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      sort: 'label-asc',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].sort).toEqual({y: 'y', limit: 10});
  });

  it('can aggregate a numeric value column', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      metric: 'aggregate',
      valueField: 'length_m',
      aggregate: 'avg',
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].x).toEqual({avg: 'length_m'});
    expect(spec.plot[2].text).toEqual({avg: 'length_m'});
    expect(spec.plot[0].sort).toEqual({y: '-x', limit: 10});
    expect(spec.xLabel).toBe('AVG length_m');
  });

  it('uses maxBars for category limiting and plot height', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      maxBars: 6,
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].sort).toEqual({y: '-x', limit: 6});
    expect(spec.height).toBe(344);
  });

  it('uses visible category count for plot height when provided', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      maxBars: 10,
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
      visibleCategoryCount: 3,
    }) as any;

    expect(spec.plot[0].sort).toEqual({y: '-x', limit: 10});
    expect(spec.height).toBe(218);
  });

  it('keeps the same row geometry for a single visible category', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      maxBars: 10,
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
      visibleCategoryCount: 1,
    }) as any;

    expect(spec.height).toBe(134);
    expect(spec.yPaddingInner).toBeCloseTo(10 / 42);
    expect(spec.yPaddingOuter).toBeCloseTo(16 / 42);
  });

  it('uses manual left margin when provided', () => {
    const settings: CountPlotChartSettings = {
      field: 'class',
      leftMargin: 140,
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.margins.left).toBe(140);
  });
});
