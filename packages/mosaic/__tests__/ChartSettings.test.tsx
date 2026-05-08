import {describe, expect, it, jest} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChartSettings} from '../src/dashboard/chart-settings';
import type {VgPlotChartConfig} from '../src/chart-types';
import type {TableColumn} from '@sqlrooms/duckdb';

describe('ChartSettings Compound Components', () => {
  const mockColumns: TableColumn[] = [
    {name: 'id', type: 'INTEGER'},
    {name: 'name', type: 'VARCHAR'},
    {name: 'amount', type: 'DOUBLE'},
  ];

  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ChartSettings.Root', () => {
    it('provides context to children', () => {
      const config: VgPlotChartConfig = {
        chartType: 'histogram',
        settings: {field: 'amount'},
        vgplot: null,
      };

      const markup = renderToStaticMarkup(
        <ChartSettings.Root
          tableName="test_table"
          config={config}
          columns={mockColumns}
          onChange={mockOnChange}
        >
          <div>Child content</div>
        </ChartSettings.Root>,
      );

      expect(markup).toContain('Child content');
    });
  });

  describe('ChartSettings.Fields', () => {
    it('shows error for unknown chart type', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      const config = {
        chartType: 'unknown-type',
        settings: {},
        vgplot: null,
      } as any;

      const markup = renderToStaticMarkup(
        <ChartSettings.Root
          tableName="test_table"
          config={config}
          columns={mockColumns}
          onChange={mockOnChange}
        >
          <ChartSettings.Fields />
        </ChartSettings.Root>,
      );

      expect(markup).toContain('Unknown chart type');
      expect(markup).toContain('unknown-type');
    });

    it('shows error for empty columns', () => {
      const config: VgPlotChartConfig = {
        chartType: 'histogram',
        settings: {},
        vgplot: null,
      };

      const markup = renderToStaticMarkup(
        <ChartSettings.Root
          tableName="test_table"
          config={config}
          columns={[]}
          onChange={mockOnChange}
        >
          <ChartSettings.Fields />
        </ChartSettings.Root>,
      );

      expect(markup).toContain('No columns available');
    });

    it('renders for valid histogram config', () => {
      const config: VgPlotChartConfig = {
        chartType: 'histogram',
        settings: {field: 'amount'},
        vgplot: null,
      };

      const markup = renderToStaticMarkup(
        <ChartSettings.Root
          tableName="test_table"
          config={config}
          columns={mockColumns}
          onChange={mockOnChange}
        >
          <ChartSettings.Fields />
        </ChartSettings.Root>,
      );

      expect(markup).toBeDefined();
      expect(markup).not.toContain('Unknown chart type');
      expect(markup).not.toContain('No columns available');
    });

    it('renders for all chart types', () => {
      const chartTypes: Array<{
        type: VgPlotChartConfig['chartType'];
        settings: any;
      }> = [
        {type: 'histogram', settings: {field: 'amount'}},
        {type: 'count-plot', settings: {field: 'name'}},
        {type: 'line-chart', settings: {x: 'id', y: 'amount'}},
        {type: 'heatmap', settings: {x: 'name', y: 'id'}},
        {type: 'box-plot', settings: {x: 'name', y: 'amount'}},
        {type: 'bubble-chart', settings: {x: 'id', y: 'amount', size: 'id'}},
      ];

      chartTypes.forEach(({type, settings}) => {
        const config: VgPlotChartConfig = {
          chartType: type,
          settings,
          vgplot: null,
        };

        const markup = renderToStaticMarkup(
          <ChartSettings.Root
            tableName="test_table"
            config={config}
            columns={mockColumns}
            onChange={mockOnChange}
          >
            <ChartSettings.Fields />
          </ChartSettings.Root>,
        );

        expect(markup).toBeDefined();
        expect(markup).not.toContain('Unknown chart type');
      });
    });
  });
});
