import {createLineChartSpec} from '../../src/charts/chart-types/line-chart/spec';
import {LineChartSettings} from '../../src/charts/chart-types/line-chart/schema';
import {DataTableWithColumns} from '../../src/charts/chart-types/base-types';

describe('createLineChartSpec', () => {
  const mockDataTable: DataTableWithColumns = {
    table: {table: 'test_table'},
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
    });

    // Verify legend mark exists
    const legendMark = spec.plot.find((mark: any) => mark.mark === 'legend');
    expect(legendMark).toBeDefined();
    expect(legendMark.as).toBe('$legend');
    expect(legendMark.for).toBe('color');
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
    });

    // Verify legend mark exists by default
    const legendMark = spec.plot.find((mark: any) => mark.mark === 'legend');
    expect(legendMark).toBeDefined();
  });
});
