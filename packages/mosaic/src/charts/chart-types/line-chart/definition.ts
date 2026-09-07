import type {SpecChartTypeDefinition} from '../base-types';
import {LineChartConfig, LineChartSettings} from './schema';
import {titleFromDescription} from '../../../chart-builders/chartTypeUtils';
import {LineChartSettingsComponent} from './LineChartSettings';
import {createLineChartAiTool} from './tool';
import {LineChart} from 'lucide-react';
import {createLineChartSpec} from './spec';
import {DEFAULT_CHART_MAX_DATA_POINTS} from '../../../chart-runtime';

const DESCRIPTION = 'Create a line chart of numeric measures or row counts';

export const lineChartChartType: SpecChartTypeDefinition<LineChartConfig> = {
  id: 'line-chart',
  label: 'Line Chart',
  description: DESCRIPTION,
  aiDescription: `${DESCRIPTION} - trends over time or ordered variable (use with aggregations for >10k rows)`,
  icon: LineChart,
  schema: LineChartSettings,
  settingsComponent: LineChartSettingsComponent,
  buildTitle: titleFromDescription(DESCRIPTION),
  createTool: createLineChartAiTool,
  // Count queries can still return one point per distinct X value. Limit the
  // result, even with an interval: binning does not guarantee low cardinality.
  getDataPolicy: ({config}) =>
    config.settings.metric !== 'count' && config.settings.xInterval
      ? null
      : {
          maxRows: DEFAULT_CHART_MAX_DATA_POINTS,
          reason:
            'Line charts render one point per result row. Use a coarser temporal interval or reduce the distinct X values for larger results.',
        },
  createSpec: createLineChartSpec,
};
