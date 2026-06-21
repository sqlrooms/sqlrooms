import {createLineChartSpec} from '../../src/charts/chart-types/line-chart/spec';
import {LineChartSettings} from '../../src/charts/chart-types/line-chart/schema';
import {makeQualifiedTableName, type DataTable} from '@sqlrooms/duckdb';

describe('createLineChartSpec', () => {
  const mockDataTable: DataTable = {
    table: makeQualifiedTableName({
      database: 'attached',
      schema: 'main',
      table: 'test_table',
    }),
    tableName: 'test_table',
    schema: 'main',
    isView: false,
    columns: [
      {name: 'date', type: 'TIMESTAMP'},
      {name: 'sales', type: 'DOUBLE'},
      {name: 'revenue', type: 'DOUBLE'},
    ],
  };

  it('generates spec without legend when showLegend is false', () => {
    const settings: LineChartSettings = {
      x: 'date',
      xInterval: 'day',
      yFields: [{field: 'sales', aggregate: 'sum'}],
      showLegend: false,
    };

    const spec = createLineChartSpec({
      dataTable: mockDataTable,
      settings,
      selectionName: 'test_selection',
    });

    // Verify legend is not present
    const hasLegend = spec.plot.some((mark: any) => 'legend' in mark);
    expect(hasLegend).toBe(false);
  });

  it('uses the Mosaic query table reference in generated data sources', () => {
    const settings: LineChartSettings = {
      x: 'date',
      yFields: [{field: 'sales'}],
      showLegend: false,
    };

    const spec = createLineChartSpec({
      dataTable: mockDataTable,
      settings,
      selectionName: 'test_selection',
    }) as any;

    expect(spec.plot[0].data.from).toBe('"main"."test_table"');
    expect(JSON.parse(JSON.stringify(spec)).plot[0].data.from).toBe(
      '"main"."test_table"',
    );
  });

  it('preserves dotted table-name parts in generated data sources', () => {
    const settings: LineChartSettings = {
      x: 'date',
      yFields: [{field: 'sales'}],
      showLegend: false,
    };

    const spec = createLineChartSpec({
      dataTable: {
        ...mockDataTable,
        table: makeQualifiedTableName({
          database: 'attached',
          schema: 'main',
          table: 'events.2026',
        }),
      },
      settings,
      selectionName: 'test_selection',
    }) as any;

    expect(spec.plot[0].data.from).toBe('"main"."events.2026"');
    expect(JSON.parse(JSON.stringify(spec)).plot[0].data.from).toBe(
      '"main"."events.2026"',
    );
  });

  it('generates spec with legend when showLegend is true', () => {
    const settings: LineChartSettings = {
      x: 'date',
      xInterval: 'day',
      yFields: [
        {field: 'sales', aggregate: 'sum', color: '#ea7c5c'},
        {field: 'revenue', aggregate: 'avg', color: '#2a9d8f'},
      ],
      showLegend: true,
    };

    const spec = createLineChartSpec({
      dataTable: mockDataTable,
      settings,
      selectionName: 'test_selection',
    }) as any;

    // Verify VConcat structure with legend
    expect(spec.vconcat).toBeDefined();
    expect(spec.vconcat.length).toBe(2);

    // Second element should be the legend
    const legendSpec = spec.vconcat[1];
    expect(legendSpec.legend).toBe('color');
    expect(legendSpec.for).toBe('lineChart');
    expect(legendSpec.columns).toBe(2);
  });

  it('generates spec with legend by default', () => {
    const settings: LineChartSettings = {
      x: 'date',
      yFields: [{field: 'sales'}],
      // showLegend not specified, should default to true
    };

    const spec = createLineChartSpec({
      dataTable: mockDataTable,
      settings,
      selectionName: 'test_selection',
    }) as any;

    // Verify VConcat structure exists by default (showLegend defaults to true)
    expect(spec.vconcat).toBeDefined();
    expect(spec.vconcat.length).toBe(2);
    expect(spec.vconcat[1].legend).toBe('color');
  });
});
