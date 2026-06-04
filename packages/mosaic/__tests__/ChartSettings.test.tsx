import {describe, expect, it, jest, beforeEach, afterEach} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import {MosaicChartSettings} from '../src/charts/chart-settings/MosaicChartSettings';
import type {ChartConfig} from '../src/charts/chart-types';
import type {TableColumn} from '@sqlrooms/duckdb';

describe('MosaicChartSettings Compound Components', () => {
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

  describe('MosaicChartSettings.Root', () => {
    it('provides context to children', () => {
      const config: ChartConfig = {
        chartType: 'histogram',
        settings: {field: 'amount'},
      };

      const markup = renderToStaticMarkup(
        <MosaicChartSettings.Root
          tableName="test_table"
          config={config}
          columns={mockColumns}
          onChange={mockOnChange}
        >
          <div>Child content</div>
        </MosaicChartSettings.Root>,
      );

      expect(markup).toContain('Child content');
    });

    it('renders with different chart types', () => {
      const chartTypes: ChartConfig['chartType'][] = [
        'histogram',
        'count-plot',
        'line-chart',
        'heatmap',
        'box-plot',
        'bubble-chart',
      ];

      chartTypes.forEach((chartType) => {
        const config: ChartConfig = {
          chartType,
          settings: {},
        };

        const markup = renderToStaticMarkup(
          <MosaicChartSettings.Root
            tableName="test_table"
            config={config}
            columns={mockColumns}
            onChange={mockOnChange}
          >
            <div>Test content</div>
          </MosaicChartSettings.Root>,
        );

        expect(markup).toContain('Test content');
      });
    });

    it('handles empty columns', () => {
      const config: ChartConfig = {
        chartType: 'histogram',
        settings: {field: 'amount'},
      };

      const markup = renderToStaticMarkup(
        <MosaicChartSettings.Root
          tableName="test_table"
          config={config}
          columns={[]}
          onChange={mockOnChange}
        >
          <div>Empty columns test</div>
        </MosaicChartSettings.Root>,
      );

      expect(markup).toContain('Empty columns test');
    });
  });
});
