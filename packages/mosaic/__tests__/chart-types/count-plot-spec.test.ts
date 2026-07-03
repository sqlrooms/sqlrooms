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
    expect(spec.height).toBe(400);
    expect(spec.yPaddingInner).toBe(0.7);
    expect(spec.margins.left).toBeGreaterThan(50);
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
      barMaxHeight: 32,
    };

    const spec = createCountPlotSpec({
      dataTable: mockDataTable,
      settings,
    }) as any;

    expect(spec.plot[0].sort).toEqual({y: '-x', limit: 6});
    expect(spec.height).toBe(286);
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
