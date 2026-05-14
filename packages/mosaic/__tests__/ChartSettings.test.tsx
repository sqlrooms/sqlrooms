import {describe, expect, it, jest, beforeEach, afterEach} from '@jest/globals';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChartSettings} from '../src/chart/chart-settings/ChartSettings';
import type {ChartConfig} from '../src/chart-types';
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
      const config: ChartConfig = {
        chartType: 'histogram',
        settings: {field: 'amount'},
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
          <ChartSettings.Root
            tableName="test_table"
            config={config}
            columns={mockColumns}
            onChange={mockOnChange}
          >
            <div>Test content</div>
          </ChartSettings.Root>,
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
        <ChartSettings.Root
          tableName="test_table"
          config={config}
          columns={[]}
          onChange={mockOnChange}
        >
          <div>Empty columns test</div>
        </ChartSettings.Root>,
      );

      expect(markup).toContain('Empty columns test');
    });
  });
});
